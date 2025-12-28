const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkErrors() {
  console.log('🔍 CHECKING MESSAGES FOR ERRORS');
  console.log('='.repeat(60));

  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false }
    }
  );

  try {
    // Count total messages
    const { count: totalCount, error: countError } = await serviceClient
      .from('messages')
      .select('*', { count: 'exact', head: true });
    
    console.log(`Total messages: ${totalCount}`);

    // Count messages with error_type
    const { data: errorMessages, error: errorError } = await serviceClient
      .from('messages')
      .select('id, error_type')
      .not('error_type', 'is', null);

    if (errorError) {
      console.error('❌ Error fetching error messages:', errorError);
    } else {
      console.log(`Messages with error_type: ${errorMessages.length}`);
      if (errorMessages.length > 0) {
        console.log('Sample error types:', errorMessages.slice(0, 5).map(m => m.error_type));
      }
    }

  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

checkErrors();
