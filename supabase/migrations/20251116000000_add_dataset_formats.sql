-- Add new dataset formats to training_datasets
-- Migration: Add support for Alpaca, OpenOrca, and Unnatural Instructions formats
-- Date: 2025-11-16

-- Drop the existing check constraint
ALTER TABLE training_datasets
DROP CONSTRAINT IF EXISTS training_datasets_format_check;

-- Add new check constraint with all formats included
ALTER TABLE training_datasets
ADD CONSTRAINT training_datasets_format_check
CHECK (format IN ('chatml', 'sharegpt', 'jsonl', 'dpo', 'rlhf', 'alpaca', 'openorca', 'unnatural'));

-- Update column comment
COMMENT ON COLUMN training_datasets.format IS 'Dataset format: chatml, sharegpt, jsonl, dpo, rlhf, alpaca, openorca, or unnatural';
