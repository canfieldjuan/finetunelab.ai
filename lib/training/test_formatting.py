"""
Unit tests for dataset formatting functions in standalone_trainer.py
Date: 2025-11-02
Purpose: Verify ChatML and text formatting works correctly
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

import unittest
from typing import Dict, Any
from datasets import Dataset


class MockToolTrainer:
    """Mock ToolTrainer class to test formatting functions in isolation."""

    def __init__(self, train_dataset: Dataset):
        self.train_dataset = train_dataset
        self.eval_dataset = Dataset.from_list([])

    def _format_chat_messages(self, example: Dict[str, Any]) -> str:
        """
        Format ChatML messages to training text.
        (Copied from standalone_trainer.py for testing)
        """
        if 'messages' not in example:
            return ""

        messages = example['messages']
        if not isinstance(messages, list):
            return ""

        formatted_parts = []
        for msg in messages:
            if not isinstance(msg, dict):
                continue

            role = msg.get('role', 'user')
            content = msg.get('content', '')

            # Use ChatML-style formatting: <|role|>\ncontent\n
            formatted_parts.append(f"<|{role}|>\n{content}\n")

        result = "".join(formatted_parts)
        return result

    def _format_text(self, example: Dict[str, Any]) -> str:
        """
        Format standard text examples.
        (Copied from standalone_trainer.py for testing)
        """
        if 'text' in example:
            return str(example['text'])
        return ""

    def _get_formatting_function(self):
        """
        Get appropriate formatting function based on dataset structure.
        (Copied from standalone_trainer.py for testing)
        """
        if len(self.train_dataset) == 0:
            return self._format_text

        # Check first example to determine format
        first_example = self.train_dataset[0]

        if 'messages' in first_example:
            return self._format_chat_messages
        elif 'text' in first_example:
            return self._format_text
        else:
            return self._format_text


class TestChatMLFormatting(unittest.TestCase):
    """Test ChatML message formatting."""

    def setUp(self):
        """Set up test fixtures."""
        self.trainer = MockToolTrainer(Dataset.from_list([]))

    def test_basic_chatml_formatting(self):
        """Test basic ChatML message formatting."""
        example = {
            'messages': [
                {'role': 'system', 'content': 'You are a helpful assistant.'},
                {'role': 'user', 'content': 'Hello!'},
                {'role': 'assistant', 'content': 'Hi there!'}
            ]
        }

        result = self.trainer._format_chat_messages(example)

        # Check that all roles are present
        self.assertIn('<|system|>', result)
        self.assertIn('<|user|>', result)
        self.assertIn('<|assistant|>', result)

        # Check that content is present
        self.assertIn('You are a helpful assistant.', result)
        self.assertIn('Hello!', result)
        self.assertIn('Hi there!', result)

    def test_empty_messages(self):
        """Test handling of empty messages array."""
        example = {'messages': []}
        result = self.trainer._format_chat_messages(example)
        self.assertEqual(result, "")

    def test_missing_messages_field(self):
        """Test handling of missing 'messages' field."""
        example = {'text': 'Some text'}
        result = self.trainer._format_chat_messages(example)
        self.assertEqual(result, "")

    def test_messages_not_list(self):
        """Test handling of messages field that's not a list."""
        example = {'messages': 'not a list'}
        result = self.trainer._format_chat_messages(example)
        self.assertEqual(result, "")

    def test_invalid_message_in_array(self):
        """Test handling of invalid message in messages array."""
        example = {
            'messages': [
                {'role': 'user', 'content': 'Valid message'},
                'invalid message',
                {'role': 'assistant', 'content': 'Another valid message'}
            ]
        }

        result = self.trainer._format_chat_messages(example)

        # Should skip invalid message but process valid ones
        self.assertIn('Valid message', result)
        self.assertIn('Another valid message', result)

    def test_missing_role_or_content(self):
        """Test handling of messages with missing role or content."""
        example = {
            'messages': [
                {'content': 'Content only'},
                {'role': 'assistant'},
                {'role': 'user', 'content': 'Valid'}
            ]
        }

        result = self.trainer._format_chat_messages(example)

        # Should handle missing fields gracefully
        self.assertIn('Valid', result)
        # role defaults to 'user' if missing
        self.assertIn('<|user|>', result)


class TestTextFormatting(unittest.TestCase):
    """Test standard text formatting."""

    def setUp(self):
        """Set up test fixtures."""
        self.trainer = MockToolTrainer(Dataset.from_list([]))

    def test_basic_text_formatting(self):
        """Test basic text formatting."""
        example = {'text': 'This is some training text.'}
        result = self.trainer._format_text(example)
        self.assertEqual(result, 'This is some training text.')

    def test_missing_text_field(self):
        """Test handling of missing 'text' field."""
        example = {'messages': []}
        result = self.trainer._format_text(example)
        self.assertEqual(result, "")

    def test_empty_text(self):
        """Test handling of empty text."""
        example = {'text': ''}
        result = self.trainer._format_text(example)
        self.assertEqual(result, '')

    def test_numeric_text(self):
        """Test handling of numeric text value."""
        example = {'text': 12345}
        result = self.trainer._format_text(example)
        self.assertEqual(result, '12345')


class TestFormattingFunctionSelection(unittest.TestCase):
    """Test automatic formatting function selection."""

    def test_select_chatml_formatter(self):
        """Test selection of ChatML formatter."""
        dataset = Dataset.from_list([
            {'messages': [{'role': 'user', 'content': 'Test'}]}
        ])
        trainer = MockToolTrainer(dataset)

        formatter = trainer._get_formatting_function()

        # Should return the chat messages formatter
        self.assertEqual(formatter.__name__, '_format_chat_messages')

    def test_select_text_formatter(self):
        """Test selection of text formatter."""
        dataset = Dataset.from_list([
            {'text': 'Test text'}
        ])
        trainer = MockToolTrainer(dataset)

        formatter = trainer._get_formatting_function()

        # Should return the text formatter
        self.assertEqual(formatter.__name__, '_format_text')

    def test_empty_dataset(self):
        """Test handling of empty dataset."""
        dataset = Dataset.from_list([])
        trainer = MockToolTrainer(dataset)

        formatter = trainer._get_formatting_function()

        # Should default to text formatter
        self.assertEqual(formatter.__name__, '_format_text')

    def test_unknown_format(self):
        """Test handling of unknown dataset format."""
        dataset = Dataset.from_list([
            {'unknown_field': 'Unknown format'}
        ])
        trainer = MockToolTrainer(dataset)

        formatter = trainer._get_formatting_function()

        # Should fall back to text formatter
        self.assertEqual(formatter.__name__, '_format_text')


class TestRealWorldScenarios(unittest.TestCase):
    """Test real-world scenarios with actual dataset structures."""

    def setUp(self):
        """Set up test fixtures."""
        self.trainer = MockToolTrainer(Dataset.from_list([]))

    def test_tool_use_dataset(self):
        """Test formatting of tool use dataset (from user's actual data)."""
        example = {
            'messages': [
                {
                    'role': 'system',
                    'content': 'You are a finetuning expert. Your goal is to help users finetune models for their specific tasks.'
                },
                {
                    'role': 'user',
                    'content': 'I want to finetune a model for sentiment analysis on the IMDB dataset.'
                },
                {
                    'role': 'assistant',
                    'content': '{"tool": "project.init", "args": {"project_name": "sentiment_analysis_imdb"}}'
                }
            ]
        }

        result = self.trainer._format_chat_messages(example)

        # Verify all content is present
        self.assertIn('finetuning expert', result)
        self.assertIn('IMDB dataset', result)
        self.assertIn('project.init', result)

        # Verify structure
        self.assertIn('<|system|>', result)
        self.assertIn('<|user|>', result)
        self.assertIn('<|assistant|>', result)

        # Verify it's not empty
        self.assertGreater(len(result), 0)

    def test_multi_turn_conversation(self):
        """Test formatting of multi-turn conversation."""
        example = {
            'messages': [
                {'role': 'system', 'content': 'You are helpful.'},
                {'role': 'user', 'content': 'Question 1'},
                {'role': 'assistant', 'content': 'Answer 1'},
                {'role': 'user', 'content': 'Question 2'},
                {'role': 'assistant', 'content': 'Answer 2'},
                {'role': 'user', 'content': 'Question 3'},
                {'role': 'assistant', 'content': 'Answer 3'}
            ]
        }

        result = self.trainer._format_chat_messages(example)

        # Should have all messages
        for i in range(1, 4):
            self.assertIn(f'Question {i}', result)
            self.assertIn(f'Answer {i}', result)


def run_tests():
    """Run all tests and report results."""
    print("=" * 80)
    print("Running Dataset Formatting Tests")
    print("=" * 80)

    # Create test suite
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    # Add all test classes
    suite.addTests(loader.loadTestsFromTestCase(TestChatMLFormatting))
    suite.addTests(loader.loadTestsFromTestCase(TestTextFormatting))
    suite.addTests(loader.loadTestsFromTestCase(TestFormattingFunctionSelection))
    suite.addTests(loader.loadTestsFromTestCase(TestRealWorldScenarios))

    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    # Report summary
    print("\n" + "=" * 80)
    print("Test Summary")
    print("=" * 80)
    print(f"Tests run: {result.testsRun}")
    print(f"Successes: {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print("=" * 80)

    return result.wasSuccessful()


if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
