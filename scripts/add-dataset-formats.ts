/**
 * Migration script: Add Alpaca, OpenOrca, Unnatural formats to training_datasets
 * Run with: npx tsx scripts/add-dataset-formats.ts
 *
 * Note: This needs to be run manually in Supabase SQL Editor
 * This script generates the SQL and shows instructions
 */

console.log('====================================================');
console.log('Dataset Formats Migration');
console.log('====================================================\n');

console.log('To add Alpaca, OpenOrca, and Unnatural Instructions format support,');
console.log('run this SQL in Supabase SQL Editor:');
console.log('(https://supabase.com/dashboard/project/_/sql)\n');

const sql = `-- Add new dataset formats to training_datasets
-- Drop the existing check constraint
ALTER TABLE training_datasets
DROP CONSTRAINT IF EXISTS training_datasets_format_check;

-- Add new check constraint with all formats included
ALTER TABLE training_datasets
ADD CONSTRAINT training_datasets_format_check
CHECK (format IN ('chatml', 'sharegpt', 'jsonl', 'dpo', 'rlhf', 'alpaca', 'openorca', 'unnatural'));

-- Update column comment
COMMENT ON COLUMN training_datasets.format IS 'Dataset format: chatml, sharegpt, jsonl, dpo, rlhf, alpaca, openorca, or unnatural';`;

console.log(sql);
console.log('\n====================================================');
console.log('After running the SQL, you can upload datasets in these formats:');
console.log('- Alpaca: {"instruction": "...", "input": "...", "output": "..."}');
console.log('- Dolly: {"instruction": "...", "context": "...", "response": "..."}');
console.log('- OpenOrca: {"system_prompt": "...", "question": "...", "response": "..."}');
console.log('- Unnatural: {"instruction": "...", "instances": [...]}');
console.log('====================================================');
