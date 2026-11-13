# Project Manager - Monitoring Configuration
# Phase 4: DM-003 Monitoring & Alerting

## Health Check Endpoint
# GET /health (no auth required)
# Returns: { status, database, uptime, memory, cpu, timestamp }

## Metrics Endpoint
# GET /api/monitoring/metrics (auth required)
# Returns: { total_projects, total_tasks, total_users, total_canvases, tasks_by_status, tasks_by_priority, db_size_bytes }

## Alert Rules
alerts:
  - name: health_check_failure
    condition: "health.status != 'ok' for > 2 minutes"
    severity: critical
    action: "Page on-call engineer"

  - name: high_5xx_rate
    condition: "HTTP 5xx rate > 1% over 5 minutes"
    severity: warning
    action: "Notify team channel"

  - name: db_growth_anomaly
    condition: "DB file size > 2x previous day"
    severity: warning
    action: "Notify team channel"

  - name: memory_high
    condition: "Memory usage > 80%"
    severity: warning
    action: "Notify team channel"

  - name: container_restart
    condition: "Container restart detected"
    severity: info
    action: "Log to monitoring"

## Log Aggregation
# - Application logs: stdout/stderr (captured by Docker)
# - Rotation: > 50 MB/day
# - Format: JSON structured logs

## Docker Health Check
# Configured in docker-compose.yml:
#   test: curl -f http://localhost:4000/health
#   interval: 30s
#   timeout: 10s
#   retries: 3
#   start_period: 10s
