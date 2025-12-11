#!/usr/bin/env python3
"""
Extract clean Q&A pairs from OpenAI batch API JSONL output.
Removes all API metadata and extracts only user questions and assistant answers.
"""

import json
import sys
from pathlib import Path


def extract_qa_from_batch_output(input_file: str, output_file: str, format: str = 'jsonl'):
    """
    Extract Q&A pairs from batch API output.

    Args:
        input_file: Path to batch output JSONL file
        output_file: Path to save cleaned output
        format: Output format - 'jsonl', 'json', or 'txt'
    """

    qa_pairs = []
    success_count = 0
    error_count = 0

    print(f"Reading batch output from: {input_file}")

    with open(input_file, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            try:
                # Parse the batch response line
                batch_response = json.loads(line.strip())

                # Check for errors in the batch response
                if batch_response.get('error'):
                    error_count += 1
                    print(f"Line {line_num}: Error response - {batch_response['error']}")
                    continue

                # Extract the assistant's message content
                response_body = batch_response.get('response', {}).get('body', {})
                choices = response_body.get('choices', [])

                if not choices:
                    error_count += 1
                    print(f"Line {line_num}: No choices in response")
                    continue

                # Get the assistant's content (which contains the JSON with user_question and assistant_answer)
                assistant_content = choices[0].get('message', {}).get('content', '')

                if not assistant_content:
                    error_count += 1
                    print(f"Line {line_num}: Empty assistant content")
                    continue

                # Parse the nested JSON containing user_question and assistant_answer
                try:
                    qa_data = json.loads(assistant_content)

                    qa_pair = {
                        'custom_id': batch_response.get('custom_id', f'unknown-{line_num}'),
                        'user_question': qa_data.get('user_question', ''),
                        'assistant_answer': qa_data.get('assistant_answer', '')
                    }

                    qa_pairs.append(qa_pair)
                    success_count += 1

                    if success_count % 100 == 0:
                        print(f"Processed {success_count} successful Q&A pairs...")

                except json.JSONDecodeError as e:
                    error_count += 1
                    print(f"Line {line_num}: Failed to parse assistant content as JSON - {e}")
                    continue

            except json.JSONDecodeError as e:
                error_count += 1
                print(f"Line {line_num}: Failed to parse line - {e}")
                continue

    print(f"\nExtraction complete:")
    print(f"  [SUCCESS] Extracted: {success_count} Q&A pairs")
    print(f"  [ERRORS] Encountered: {error_count}")

    # Save output in requested format
    print(f"\nSaving to: {output_file}")

    if format == 'jsonl':
        # One JSON object per line
        with open(output_file, 'w', encoding='utf-8') as f:
            for qa in qa_pairs:
                f.write(json.dumps(qa, ensure_ascii=False) + '\n')
        print(f"[OK] Saved as JSONL format")

    elif format == 'json':
        # Single JSON array
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(qa_pairs, f, indent=2, ensure_ascii=False)
        print(f"[OK] Saved as JSON array format")

    elif format == 'txt':
        # Human-readable text format
        with open(output_file, 'w', encoding='utf-8') as f:
            for i, qa in enumerate(qa_pairs, 1):
                f.write(f"{'=' * 80}\n")
                f.write(f"Q&A Pair #{i} (ID: {qa['custom_id']})\n")
                f.write(f"{'=' * 80}\n\n")
                f.write(f"QUESTION:\n{qa['user_question']}\n\n")
                f.write(f"ANSWER:\n{qa['assistant_answer']}\n\n")
        print(f"[OK] Saved as text format")

    return qa_pairs, success_count, error_count


def main():
    """Main entry point"""

    # Input file
    input_file = r'C:\Users\Juan\Desktop\Dev_Ops\web-ui\output\batch_6906407ba5648190864a426d6d8bc87e_output.jsonl'

    # Output files
    output_dir = Path(r'C:\Users\Juan\Desktop\Dev_Ops\web-ui\output')
    output_dir.mkdir(exist_ok=True)

    # Extract in all formats
    formats = {
        'jsonl': output_dir / 'cleaned_qa_pairs.jsonl',
        'json': output_dir / 'cleaned_qa_pairs.json',
        'txt': output_dir / 'cleaned_qa_pairs.txt'
    }

    print("=" * 80)
    print("OpenAI Batch Output Q&A Extractor")
    print("=" * 80)
    print()

    for format_type, output_file in formats.items():
        print(f"\n{'-' * 80}")
        print(f"Extracting as {format_type.upper()} format...")
        print(f"{'-' * 80}\n")

        qa_pairs, success, errors = extract_qa_from_batch_output(
            input_file,
            str(output_file),
            format_type
        )

        print(f"[OK] Output saved to: {output_file}")
        print(f"  File size: {output_file.stat().st_size / 1024 / 1024:.2f} MB")

    print("\n" + "=" * 80)
    print("All extractions complete!")
    print("=" * 80)


if __name__ == '__main__':
    main()
