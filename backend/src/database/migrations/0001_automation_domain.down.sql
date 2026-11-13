-- Development-only rollback for 0001_automation_domain.sql.
-- The runner disables foreign-key enforcement for this transaction because the
-- approved schema intentionally contains circular nullable references.

DROP TABLE IF EXISTS idempotency_keys;
DROP TABLE IF EXISTS execution_steps;
DROP TABLE IF EXISTS workflow_edges;
DROP TABLE IF EXISTS approvals;
DROP TABLE IF EXISTS executions;
DROP TABLE IF EXISTS workflow_nodes;
DROP TABLE IF EXISTS workflows;
DROP TABLE IF EXISTS workflow_versions;
DROP TABLE IF EXISTS credential_references;
DROP TABLE IF EXISTS environments;
