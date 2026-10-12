-- ─────────────────────────────────────────────────────────────────────────────
-- deploy/postgres/init.sql
-- Rakshak v3.0 — PostgreSQL Database Initialization Script
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Create dedicated schema if not exists
CREATE SCHEMA IF NOT EXISTS public;

-- 2. Configure default privileges and search path
SET search_path TO public;

-- 3. Optimization tuning parameters for digital forensics metadata
ALTER SYSTEM SET max_connections = '100';
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '768MB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = '0.9';
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = '100';

-- 4. Audit logging extensions (if available in production)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";
