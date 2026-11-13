-- PM-P7-05: replay lineage field (replayed_from).
--
-- The replayed_from column and idx_executions_replayed_from index are defined
-- in schema.sql for fresh databases and added by applyCompatibilityMigrations()
-- for existing databases. This migration is a version marker only; its SQL is
-- intentionally a no-op so it can run on databases bootstrapped from any prior
-- schema version without failing on a missing column.

SELECT 1;
