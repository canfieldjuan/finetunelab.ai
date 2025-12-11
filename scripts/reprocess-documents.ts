/**
 * Reprocess Stuck Documents Script
 *
 * This script resets stuck documents (processed=false) and triggers reprocessing.
 * Run with: npx ts-node scripts/reprocess-documents.ts
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔍 Finding stuck documents...\n');

  // Get all unprocessed documents
  const { data: documents, error } = await supabase
    .from('documents')
    .select('*')
    .eq('processed', false)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching documents:', error);
    process.exit(1);
  }

  if (!documents || documents.length === 0) {
    console.log('✅ No stuck documents found!');
    return;
  }

  console.log(`📄 Found ${documents.length} stuck document(s):\n`);

  documents.forEach((doc, index) => {
    console.log(`${index + 1}. ${doc.filename}`);
    console.log(`   ID: ${doc.id}`);
    console.log(`   Created: ${new Date(doc.created_at).toLocaleString()}`);
    console.log(`   User: ${doc.user_id}`);
    console.log('');
  });

  // Ask for confirmation
  console.log('📋 To reprocess these documents:');
  console.log('1. Open your web app at http://localhost:3000');
  console.log('2. Log in with your account');
  console.log('3. Open browser DevTools (F12)');
  console.log('4. Go to Application > Local Storage > http://localhost:3000');
  console.log('5. Find the key starting with "sb-" (e.g., "sb-pnxxgbabkqyhhfwemgvg-auth-token")');
  console.log('6. Copy the "access_token" value');
  console.log('7. Run the following command for each document:\n');

  documents.forEach((doc) => {
    console.log(`   curl -X POST "http://localhost:3000/api/graphrag/process/${doc.id}" \\`);
    console.log(`     -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" \\`);
    console.log(`     -H "Content-Type: application/json"`);
    console.log('');
  });

  console.log('\n💡 Alternative: Reset all documents to unprocessed state');
  console.log('   This will mark them all as unprocessed so they can be reprocessed from the UI.');
  console.log('\n   To reset, uncomment the reset code in this script and re-run it.');

  // UNCOMMENT THE FOLLOWING CODE TO RESET DOCUMENTS:
  /*
  console.log('\n⚠️  Resetting documents to unprocessed state...');

  for (const doc of documents) {
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        processed: false,
        neo4j_episode_ids: [],
        updated_at: new Date().toISOString()
      })
      .eq('id', doc.id);

    if (updateError) {
      console.error(`❌ Error resetting document ${doc.filename}:`, updateError);
    } else {
      console.log(`✅ Reset ${doc.filename}`);
    }
  }

  console.log('\n✅ All documents have been reset to unprocessed state');
  console.log('   You can now reprocess them from the web UI');
  */
}

main().catch(console.error);
