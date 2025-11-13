-- Migration: Create get_db_stats function
-- Date: October 20, 2025
--
-- This function retrieves key database statistics:
-- 1. Total database size.
-- 2. A detailed list of user tables, including their size, index size, and row count.
--
-- It is designed to be called via RPC from the system-monitor tool.

create or replace function get_db_stats()
returns json
language plpgsql
as $$
declare
  total_size_bytes bigint;
  tables_data json;
begin
  -- 1. Calculate total database size
  select pg_database_size(current_database()) into total_size_bytes;

  -- 2. Get details for each user table
  select
    json_agg(
      json_build_object(
        'table_name', c.relname,
        'total_size_bytes', pg_total_relation_size(c.oid),
        'table_size_bytes', pg_relation_size(c.oid),
        'index_size_bytes', pg_indexes_size(c.oid),
        'row_count', coalesce(t.n_live_tup, 0)
      )
    )
  into
    tables_data
  from
    pg_class c
  left join
    pg_namespace n on n.oid = c.relnamespace
  left join
    pg_stat_user_tables t on t.relname = c.relname
  where
    n.nspname not in ('pg_catalog', 'information_schema', 'storage', 'graphql', 'graphql_public', 'pgsodium', 'pgsodium_masks', 'realtime', 'vault')
    and c.relkind = 'r';

  -- 3. Combine results into a single JSON object
  return json_build_object(
    'total_size_bytes', total_size_bytes,
    'tables', coalesce(tables_data, '[]'::json)
  );
end;
$$;
