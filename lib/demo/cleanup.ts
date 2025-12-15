/**
 * Demo Cleanup Service
 * Functions for cleaning up expired demo sessions
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Cleanup expired demo sessions
 * Called by cron job or on app startup
 */
export async function cleanupExpiredDemoSessions(): Promise<{
  sessionsDeleted: number;
  configsDeleted: number;
  resultsDeleted: number;
}> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const now = new Date().toISOString();

  // Find expired sessions
  const { data: expiredSessions, error: findError } = await supabase
    .from('demo_model_configs')
    .select('session_id')
    .lt('expires_at', now);

  if (findError || !expiredSessions || expiredSessions.length === 0) {
    return { sessionsDeleted: 0, configsDeleted: 0, resultsDeleted: 0 };
  }

  const sessionIds = expiredSessions.map(s => s.session_id);
  console.log(`[DemoCleanup] Found ${sessionIds.length} expired sessions to clean up`);

  let resultsDeleted = 0;
  let runsDeleted = 0;

  // Delete results
  const { data: deletedResults } = await supabase
    .from('demo_batch_test_results')
    .delete()
    .in('demo_session_id', sessionIds)
    .select('id');

  resultsDeleted = deletedResults?.length || 0;

  // Delete runs
  const { data: deletedRuns } = await supabase
    .from('demo_batch_test_runs')
    .delete()
    .in('demo_session_id', sessionIds)
    .select('id');

  runsDeleted = deletedRuns?.length || 0;

  // Delete configs
  const { data: deletedConfigs } = await supabase
    .from('demo_model_configs')
    .delete()
    .lt('expires_at', now)
    .select('id');

  const configsDeleted = deletedConfigs?.length || 0;

  console.log(`[DemoCleanup] Cleaned up expired sessions:`, {
    sessionsDeleted: sessionIds.length,
    configsDeleted,
    resultsDeleted,
    runsDeleted,
  });

  return {
    sessionsDeleted: sessionIds.length,
    configsDeleted,
    resultsDeleted,
  };
}
