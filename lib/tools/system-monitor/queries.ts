// System Monitor Tool - SQL Queries
// Date: October 20, 2025

export const getDatabaseSizeQuery = `
  SELECT
    pg_database_size(current_database()) AS total_size_bytes;
`;

export const getTableAndIndexSizeQuery = `
  SELECT
    c.relname AS table_name,
    pg_total_relation_size(c.oid) AS total_size_bytes,
    pg_relation_size(c.oid) AS table_size_bytes,
    pg_indexes_size(c.oid) AS index_size_bytes,
    (
      SELECT
        n_live_tup
      FROM
        pg_stat_user_tables
      WHERE
        relname = c.relname
    ) AS row_count
  FROM
    pg_class c
  LEFT JOIN
    pg_namespace n ON n.oid = c.relnamespace
  WHERE
    n.nspname NOT IN ('pg_catalog', 'information_schema')
    AND c.relkind = 'r'
  ORDER BY
    total_size_bytes DESC;
`;
