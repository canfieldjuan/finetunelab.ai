const { createClient } = require('@supabase/supabase-js');

const serviceKey = process.argv[2];
const supabase = createClient('https://tkizlemssfmrfluychsn.supabase.co', serviceKey, { auth: { persistSession: false } });

(async () => {
  try {
    const { data, error } = await supabase
      .from('llm_traces')
      .select('operation_type')
      .limit(100);

    if (error) {
      console.log('Error querying:', error.message);
    } else {
      const types = data ? [...new Set(data.map(t => t.operation_type))].filter(Boolean) : [];
      console.log('Existing operation_types found:', types.length > 0 ? types.join(', ') : 'NO TRACES YET');
    }
  } catch (e) {
    console.log('Exception:', e.message);
  }
  process.exit(0);
})();
