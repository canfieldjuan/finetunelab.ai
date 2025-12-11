# Supabase Realtime + Read Access for Training Metrics

The browser still connects with the `anon` key, so even though metrics are written with the service role they remain invisible unless the `anon`/`authenticated` roles can read the tables and the tables participate in the `supabase_realtime` publication. The CLI migration in `docs/migrations/20251110000001_enable_realtime_for_training.sql` contains the exact SQL you need, but Supabase no longer exposes the legacy `exec_sql` RPC used by the automation script. Apply the statements manually using the SQL editor:

1. Sign in to the Supabase dashboard and open the project backing this workspace.
2. Navigate to **SQL Editor** → **New query**.
3. Paste the following block and run it once. It is idempotent, so re-running is safe.

```sql
-- Enable realtime on the training tables
ALTER PUBLICATION supabase_realtime ADD TABLE local_training_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE local_training_metrics;

-- Allow browser roles to read the tables + sequences
GRANT SELECT ON local_training_jobs TO anon, authenticated;
GRANT SELECT ON local_training_metrics TO anon, authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
```

## Verifying the fix

1. Open the Supabase REST explorer (or run `curl` with the **anon** key) and query `local_training_metrics?job_id=eq.<your-job-id>`. You should now see rows instead of `[]`.
2. Restart the Next.js dev server so the frontend reconnects; the charts should populate immediately.
3. Watch the browser console: once realtime events start arriving you should see `[TrainingMetricsProvider] 📊 NEW METRIC INSERT EVENT`, confirming that publication + grants are in place.

If the SQL above fails with a permission error, double-check that you are connected as a project owner (not just a member) and that the tables exist (they are created automatically when you start a training job locally).
