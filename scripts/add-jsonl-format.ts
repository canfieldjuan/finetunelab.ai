/**
 * Migration script: Add JSONL format to conversation_exports
 * Run with: npx tsx scripts/add-jsonl-format.ts
 *
 * Note: This needs to be run manually in Supabase SQL Editor
 * This script generates the SQL and shows instructions
 */

console.log('====================================================');
console.log('JSONL Format Migration');
console.log('====================================================\n');

console.log('To add JSONL format support, run this SQL in Supabase SQL Editor:');
console.log('(https://supabase.com/dashboard/project/_/sql)\n');

const sql = `-- Add JSONL format to conversation_exports
-- Drop the existing check constraint
ALTER TABLE conversation_exports
DROP CONSTRAINT IF EXISTS conversation_exports_format_check;

-- Add new check constraint with 'jsonl' included
ALTER TABLE conversation_exports
ADD CONSTRAINT conversation_exports_format_check
CHECK (format IN ('pdf', 'markdown', 'json', 'txt', 'html', 'jsonl'));

-- Update column comment
COMMENT ON COLUMN conversation_exports.format IS 'Export format: pdf, markdown, json, txt, html, or jsonl';`;

console.log(sql);
console.log('\n====================================================');
console.log('After running the SQL, the JSONL export will work!');
console.log('====================================================');
