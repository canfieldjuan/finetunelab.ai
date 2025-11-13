
import argparse
import json
import os
from pathlib import Path
import logging
from datasets import Dataset
from transformers import AutoTokenizer

logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(name)s] [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

def pretokenize_dataset(
    dataset_path: str,
    tokenizer_name: str,
    output_path: str,
    max_length: int = 2048
):
    """
    Loads a dataset, tokenizes it, and saves it to disk.
    """
    logger.info(f"Loading dataset from: {dataset_path}")
    with open(dataset_path, 'r', encoding='utf-8') as f:
        if dataset_path.endswith('.jsonl'):
            data = [json.loads(line) for line in f]
        else:
            data = json.load(f)

    dataset = Dataset.from_list(data)

    logger.info(f"Loading tokenizer: {tokenizer_name}")
    tokenizer = AutoTokenizer.from_pretrained(tokenizer_name, trust_remote_code=True)

    def tokenize_function(examples):
        # This assumes your dataset has a 'text' field.
        # Adjust if your dataset has a different structure.
        return tokenizer(
            examples['text'],
            truncation=True,
            max_length=max_length,
            padding="max_length",
        )

    logger.info("Tokenizing dataset...")
    tokenized_dataset = dataset.map(
        tokenize_function,
        batched=True,
        num_proc=max(os.cpu_count() - 1, 1),
        remove_columns=dataset.column_names
    )

    logger.info(f"Saving tokenized dataset to: {output_path}")
    tokenized_dataset.save_to_disk(output_path)

    logger.info("Done!")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Pre-tokenize a dataset.")
    parser.add_argument("--dataset_path", type=str, required=True, help="Path to the input dataset file (JSON or JSONL).")
    parser.add_argument("--tokenizer_name", type=str, required=True, help="Name or path of the tokenizer.")
    parser.add_argument("--output_path", type=str, required=True, help="Path to save the tokenized dataset.")
    parser.add_argument("--max_length", type=int, default=2048, help="Maximum sequence length.")
    args = parser.parse_args()

    pretokenize_dataset(
        args.dataset_path,
        args.tokenizer_name,
        args.output_path,
        args.max_length
    )
