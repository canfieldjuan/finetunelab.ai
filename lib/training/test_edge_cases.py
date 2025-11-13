"""
Edge case tests for dataset formatting
Date: 2025-11-02
Purpose: Test edge cases and potential failure modes
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

import unittest
from datasets import Dataset


class MockToolTrainer:
    """Mock ToolTrainer for testing edge cases."""

    def __init__(self, train_dataset: Dataset):
        self.train_dataset = train_dataset

    def _format_chat_messages(self, example):
        """Format ChatML messages."""
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
            formatted_parts.append(f"<|{role}|>\n{content}\n")
        return "".join(formatted_parts)

    def _format_text(self, example):
        """Format text."""
        if 'text' in example:
            return str(example['text'])
        return ""

    def _get_formatting_function(self):
        """Get formatting function."""
        if len(self.train_dataset) == 0:
            return self._format_text
        first_example = self.train_dataset[0]
        if 'messages' in first_example:
            return self._format_chat_messages
        elif 'text' in first_example:
            return self._format_text
        else:
            return self._format_text


class TestEdgeCases(unittest.TestCase):
    """Test edge cases and potential failure modes."""

    def test_empty_dataset(self):
        """Test with completely empty dataset."""
        dataset = Dataset.from_list([])
        trainer = MockToolTrainer(dataset)

        # Should not crash
        formatter = trainer._get_formatting_function()
        self.assertIsNotNone(formatter)
        self.assertEqual(formatter.__name__, '_format_text')

    def test_very_large_messages(self):
        """Test with very large message content."""
        large_content = "A" * 100000  # 100k characters
        example = {
            'messages': [
                {'role': 'user', 'content': large_content}
            ]
        }
        dataset = Dataset.from_list([example])
        trainer = MockToolTrainer(dataset)

        formatter = trainer._get_formatting_function()
        result = formatter(example)

        # Should handle large content without error
        self.assertIn(large_content, result)
        self.assertGreater(len(result), 100000)

    def test_unicode_in_content(self):
        """Test with Unicode characters in content."""
        example = {
            'messages': [
                {'role': 'user', 'content': 'Hello world'},
                {'role': 'assistant', 'content': 'Response here'}
            ]
        }
        dataset = Dataset.from_list([example])
        trainer = MockToolTrainer(dataset)

        formatter = trainer._get_formatting_function()
        result = formatter(example)

        # Should handle Unicode gracefully
        self.assertIsInstance(result, str)
        self.assertGreater(len(result), 0)

    def test_special_characters_in_role(self):
        """Test with special characters in role."""
        example = {
            'messages': [
                {'role': 'user', 'content': 'Test'},
                {'role': 'assistant', 'content': 'Response'}
            ]
        }
        dataset = Dataset.from_list([example])
        trainer = MockToolTrainer(dataset)

        formatter = trainer._get_formatting_function()
        result = formatter(example)

        self.assertIn('user', result)
        self.assertIn('assistant', result)

    def test_empty_content(self):
        """Test with empty content strings."""
        example = {
            'messages': [
                {'role': 'user', 'content': ''},
                {'role': 'assistant', 'content': ''}
            ]
        }
        dataset = Dataset.from_list([example])
        trainer = MockToolTrainer(dataset)

        formatter = trainer._get_formatting_function()
        result = formatter(example)

        # Should not crash, even with empty content
        self.assertIsInstance(result, str)

    def test_none_values(self):
        """Test with None values in messages."""
        example = {
            'messages': [
                {'role': 'user', 'content': 'Test'},
                None,  # Invalid message
                {'role': 'assistant', 'content': 'Response'}
            ]
        }
        dataset = Dataset.from_list([example])
        trainer = MockToolTrainer(dataset)

        formatter = trainer._get_formatting_function()
        result = formatter(example)

        # Should skip None and continue
        self.assertIn('Test', result)
        self.assertIn('Response', result)

    def test_missing_role(self):
        """Test with missing role field."""
        example = {
            'messages': [
                {'content': 'Content without role'}
            ]
        }
        dataset = Dataset.from_list([example])
        trainer = MockToolTrainer(dataset)

        formatter = trainer._get_formatting_function()
        result = formatter(example)

        # Should use default role 'user'
        self.assertIn('user', result)
        self.assertIn('Content without role', result)

    def test_missing_content(self):
        """Test with missing content field."""
        example = {
            'messages': [
                {'role': 'user'}  # Missing content
            ]
        }
        dataset = Dataset.from_list([example])
        trainer = MockToolTrainer(dataset)

        formatter = trainer._get_formatting_function()
        result = formatter(example)

        # Should use empty string for content
        self.assertIn('user', result)

    def test_numeric_content(self):
        """Test with numeric content instead of string."""
        example = {
            'messages': [
                {'role': 'user', 'content': 12345}
            ]
        }
        dataset = Dataset.from_list([example])
        trainer = MockToolTrainer(dataset)

        formatter = trainer._get_formatting_function()
        result = formatter(example)

        # Should convert to string
        self.assertIn('12345', result)

    def test_nested_dict_content(self):
        """Test with nested dictionary as content."""
        example = {
            'messages': [
                {'role': 'user', 'content': {'nested': 'value'}}
            ]
        }
        dataset = Dataset.from_list([example])
        trainer = MockToolTrainer(dataset)

        formatter = trainer._get_formatting_function()

        # Should handle gracefully (content.get will get the dict)
        try:
            result = formatter(example)
            self.assertIsInstance(result, str)
        except Exception as e:
            self.fail(f"Should handle nested dict gracefully: {e}")

    def test_single_message(self):
        """Test with single message conversation."""
        example = {
            'messages': [
                {'role': 'user', 'content': 'Single message'}
            ]
        }
        dataset = Dataset.from_list([example])
        trainer = MockToolTrainer(dataset)

        formatter = trainer._get_formatting_function()
        result = formatter(example)

        self.assertIn('Single message', result)
        self.assertGreater(len(result), 0)

    def test_many_messages(self):
        """Test with very long conversation (100 messages)."""
        messages = []
        for i in range(100):
            messages.append({'role': 'user', 'content': f'Message {i}'})
            messages.append({'role': 'assistant', 'content': f'Response {i}'})

        example = {'messages': messages}
        dataset = Dataset.from_list([example])
        trainer = MockToolTrainer(dataset)

        formatter = trainer._get_formatting_function()
        result = formatter(example)

        # Should handle all messages
        self.assertIn('Message 0', result)
        self.assertIn('Message 99', result)
        self.assertGreater(len(result), 1000)


class TestTextFormatEdgeCases(unittest.TestCase):
    """Test edge cases for text format."""

    def test_very_long_text(self):
        """Test with very long text field."""
        long_text = "Word " * 50000  # ~250k characters
        example = {'text': long_text}
        dataset = Dataset.from_list([example])
        trainer = MockToolTrainer(dataset)

        formatter = trainer._get_formatting_function()
        result = formatter(example)

        self.assertEqual(result, long_text)
        self.assertGreater(len(result), 200000)

    def test_empty_text(self):
        """Test with empty text field."""
        example = {'text': ''}
        dataset = Dataset.from_list([example])
        trainer = MockToolTrainer(dataset)

        formatter = trainer._get_formatting_function()
        result = formatter(example)

        self.assertEqual(result, '')

    def test_numeric_text(self):
        """Test with numeric text field."""
        example = {'text': 42}
        dataset = Dataset.from_list([example])
        trainer = MockToolTrainer(dataset)

        formatter = trainer._get_formatting_function()
        result = formatter(example)

        self.assertEqual(result, '42')


def run_edge_case_tests():
    """Run all edge case tests."""
    print("=" * 80)
    print("Running Edge Case Tests")
    print("=" * 80)

    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    suite.addTests(loader.loadTestsFromTestCase(TestEdgeCases))
    suite.addTests(loader.loadTestsFromTestCase(TestTextFormatEdgeCases))

    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    print("\n" + "=" * 80)
    print("Edge Case Test Summary")
    print("=" * 80)
    print(f"Tests run: {result.testsRun}")
    print(f"Successes: {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print("=" * 80)

    return result.wasSuccessful()


if __name__ == '__main__':
    success = run_edge_case_tests()
    sys.exit(0 if success else 1)
