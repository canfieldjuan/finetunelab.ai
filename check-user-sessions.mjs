import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('=== CHECKING USER SESSIONS ===\n');

// Get all unique user_ids with tagged conversations
const { data: taggedConvs } = await supabase
  .from('conversations')
  .select('user_id, session_id, experiment_name')
  .not('session_id', 'is', null)
  .not('experiment_name', 'is', null)
  .order('created_at', { ascending: false });

if (taggedConvs && taggedConvs.length > 0) {
  // Group by user_id
  const userGroups = new Map();

  taggedConvs.forEach(conv => {
    if (!userGroups.has(conv.user_id)) {
      userGroups.set(conv.user_id, []);
    }
    userGroups.get(conv.user_id).push(conv);
  });

  console.log(`Found ${userGroups.size} users with tagged conversations:\n`);

  for (const [userId, convs] of userGroups.entries()) {
    // Get user email
    const { data: user } = await supabase.auth.admin.getUserById(userId);
    const email = user?.user?.email || 'unknown';

    // Group by session
    const sessionGroups = new Map();
    convs.forEach(conv => {
      const key = `${conv.session_id}-${conv.experiment_name}`;
      if (!sessionGroups.has(key)) {
        sessionGroups.set(key, {
          session_id: conv.session_id,
          experiment_name: conv.experiment_name,
          count: 0
        });
      }
      sessionGroups.get(key).count++;
    });

    console.log(`User: ${email} (${userId})`);
    console.log(`  Total tagged conversations: ${convs.length}`);
    console.log(`  Unique sessions: ${sessionGroups.size}`);
    console.log(`  Sessions:`);

    for (const session of sessionGroups.values()) {
      console.log(`    - ${session.session_id} | ${session.experiment_name} | ${session.count} convs`);
    }
    console.log('');
  }
} else {
  console.log('No tagged conversations found');
}

console.log('=== DONE ===');
