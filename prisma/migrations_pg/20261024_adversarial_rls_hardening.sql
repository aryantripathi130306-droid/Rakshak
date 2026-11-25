-- ─────────────────────────────────────────────────────────────────────────────
-- prisma/migrations_pg/20261024_adversarial_rls_hardening.sql
-- Rakshak v3.0 — Phase 34.1 Cryptographically & Relationally Verified Tenant Context Architecture
--
-- Closes client-settable context forgery vulnerabilities.
-- 1. Creates unforgeable private_auth schema inaccessible to app runtime roles.
-- 2. Binds session state to verified Session token & Officer active credentials.
-- 3. Enforces unforgeable get_verified_department_id() and is_verified_platform_admin()
--    across AccessGrant, Case, and Evidence RLS policies.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Private Authentication Schema (Inaccessible to rakshak_app_user)
CREATE SCHEMA IF NOT EXISTS private_auth;
REVOKE ALL ON SCHEMA private_auth FROM PUBLIC, rakshak_app_user, rakshak_admin_user;
GRANT USAGE ON SCHEMA private_auth TO postgres, rakshak_migrator;

CREATE TABLE IF NOT EXISTS private_auth.session_context (
    backend_pid INT PRIMARY KEY,
    officer_id TEXT NOT NULL,
    department_id TEXT NOT NULL,
    is_platform_admin BOOLEAN NOT NULL DEFAULT FALSE,
    established_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);
REVOKE ALL ON TABLE private_auth.session_context FROM PUBLIC, rakshak_app_user, rakshak_admin_user;

-- 2. Tenant Context Setter (SECURITY DEFINER with strict validation)
CREATE OR REPLACE FUNCTION set_authenticated_tenant_context(
    p_officer_id TEXT,
    p_department_id TEXT,
    p_session_token TEXT
) RETURNS VOID AS $$
DECLARE
    v_assigned_dept TEXT;
    v_status TEXT;
    v_role TEXT;
    v_is_admin BOOLEAN := FALSE;
    v_session_valid BOOLEAN := FALSE;
BEGIN
    IF p_officer_id IS NULL OR length(trim(p_officer_id)) = 0 THEN
        RAISE EXCEPTION 'Access Denied: Officer identity required';
    END IF;

    -- 1. Validate Officer record exists, is ACTIVE, and belongs to requested department
    SELECT "departmentId", "status", "role" INTO v_assigned_dept, v_status, v_role
    FROM public."Officer"
    WHERE "id" = trim(p_officer_id);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Access Denied: Officer record not found';
    END IF;

    IF v_status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'Access Denied: Officer account is inactive or suspended';
    END IF;

    IF p_department_id IS NULL OR v_assigned_dept IS NULL OR v_assigned_dept <> trim(p_department_id) THEN
        RAISE EXCEPTION 'Access Denied: Officer does not belong to specified department';
    END IF;

    -- 2. Validate Session token exists in OfficerSession table and is unexpired and not revoked
    v_session_valid := FALSE;
    IF p_session_token IS NOT NULL AND length(trim(p_session_token)) > 0 THEN
        PERFORM 1
        FROM public."OfficerSession"
        WHERE "token" = trim(p_session_token)
          AND "officerId" = trim(p_officer_id)
          AND "revoked" = FALSE
          AND "expiresAt" > NOW();
        IF FOUND THEN
            v_session_valid := TRUE;
        END IF;
    END IF;

    IF v_session_valid IS NOT TRUE THEN
        RAISE EXCEPTION 'Access Denied: Invalid, expired, or non-existent session token';
    END IF;

    IF v_role IN ('SYS_ADMIN', 'ADMIN') THEN
        v_is_admin := TRUE;
    END IF;

    -- 3. Write verified state to private_auth.session_context
    INSERT INTO private_auth.session_context (backend_pid, officer_id, department_id, is_platform_admin, established_at, expires_at)
    VALUES (pg_backend_pid(), trim(p_officer_id), trim(p_department_id), v_is_admin, NOW(), NOW() + INTERVAL '1 hour')
    ON CONFLICT (backend_pid) DO UPDATE
    SET officer_id = EXCLUDED.officer_id,
        department_id = EXCLUDED.department_id,
        is_platform_admin = EXCLUDED.is_platform_admin,
        established_at = NOW(),
        expires_at = EXCLUDED.expires_at;

    -- Synchronize legacy settings for compatibility
    PERFORM set_config('app.current_department_id', trim(p_department_id), true);
    PERFORM set_config('app.is_platform_admin', CASE WHEN v_is_admin THEN 'true' ELSE 'false' END, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private_auth, pg_temp;

-- 3. Clear Tenant Context (Connection Pool Hygiene)
CREATE OR REPLACE FUNCTION clear_tenant_context() RETURNS VOID AS $$
BEGIN
    DELETE FROM private_auth.session_context WHERE backend_pid = pg_backend_pid();
    PERFORM set_config('app.current_department_id', '', true);
    PERFORM set_config('app.is_platform_admin', 'false', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = private_auth, pg_temp;

-- 4. Verified Getters (Unforgeable by set_config)
CREATE OR REPLACE FUNCTION get_verified_department_id() RETURNS TEXT AS $$
DECLARE
    v_dept TEXT;
BEGIN
    SELECT department_id INTO v_dept
    FROM private_auth.session_context
    WHERE backend_pid = pg_backend_pid()
      AND expires_at > NOW();

    RETURN v_dept;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = private_auth, pg_temp;

CREATE OR REPLACE FUNCTION is_verified_platform_admin() RETURNS BOOLEAN AS $$
DECLARE
    v_admin BOOLEAN := FALSE;
BEGIN
    SELECT is_platform_admin INTO v_admin
    FROM private_auth.session_context
    WHERE backend_pid = pg_backend_pid()
      AND expires_at > NOW();

    RETURN COALESCE(v_admin, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = private_auth, pg_temp;

-- 3b. Hardened Administrative Context Setter (Restricted to rakshak_admin_user / postgres)
CREATE OR REPLACE FUNCTION set_platform_admin_context() RETURNS VOID AS $$
BEGIN
    INSERT INTO private_auth.session_context (backend_pid, officer_id, department_id, is_platform_admin, established_at, expires_at)
    VALUES (pg_backend_pid(), 'admin-system', '*', TRUE, NOW(), NOW() + INTERVAL '1 hour')
    ON CONFLICT (backend_pid) DO UPDATE
    SET officer_id = 'admin-system',
        department_id = '*',
        is_platform_admin = TRUE,
        established_at = NOW(),
        expires_at = NOW() + INTERVAL '1 hour';

    PERFORM set_config('app.is_platform_admin', 'true', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = private_auth, pg_temp;

-- Execution grants
REVOKE EXECUTE ON FUNCTION set_platform_admin_context() FROM PUBLIC, rakshak_app_user;
GRANT EXECUTE ON FUNCTION set_platform_admin_context() TO rakshak_admin_user, postgres;

GRANT EXECUTE ON FUNCTION set_authenticated_tenant_context(TEXT, TEXT, TEXT) TO rakshak_app_user, rakshak_admin_user;
GRANT EXECUTE ON FUNCTION clear_tenant_context() TO rakshak_app_user, rakshak_admin_user;
GRANT EXECUTE ON FUNCTION get_verified_department_id() TO rakshak_app_user, rakshak_admin_user;
GRANT EXECUTE ON FUNCTION is_verified_platform_admin() TO rakshak_app_user, rakshak_admin_user;

-- 5. Harden AccessGrant RLS Policy
ALTER TABLE "AccessGrant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccessGrant" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "access_grant_department_isolation" ON "AccessGrant";
CREATE POLICY "access_grant_department_isolation" ON "AccessGrant"
  FOR ALL
  TO PUBLIC
  USING (
    (is_verified_platform_admin() = TRUE)
    OR
    (get_verified_department_id() IS NOT NULL AND "granteeDepartmentId" = get_verified_department_id())
    OR
    (get_verified_department_id() IS NOT NULL AND "targetDepartmentId" = get_verified_department_id())
  )
  WITH CHECK (
    (is_verified_platform_admin() = TRUE)
    OR
    (get_verified_department_id() IS NOT NULL AND "targetDepartmentId" = get_verified_department_id())
  );

-- 6. Harden Case RLS Policy
ALTER TABLE "Case" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Case" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "p_case_tenant_isolation" ON "Case";
CREATE POLICY "p_case_tenant_isolation" ON "Case"
  FOR ALL
  TO PUBLIC
  USING (
    (is_verified_platform_admin() = TRUE)
    OR
    (get_verified_department_id() IS NOT NULL AND "departmentId" = get_verified_department_id())
  )
  WITH CHECK (
    (is_verified_platform_admin() = TRUE)
    OR
    (get_verified_department_id() IS NOT NULL AND "departmentId" = get_verified_department_id())
  );

-- 7. Harden Evidence RLS Policy
ALTER TABLE "Evidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Evidence" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "p_evidence_tenant_isolation" ON "Evidence";
CREATE POLICY "p_evidence_tenant_isolation" ON "Evidence"
  FOR ALL
  TO PUBLIC
  USING (
    (is_verified_platform_admin() = TRUE)
    OR
    EXISTS (
      SELECT 1 FROM "Case" c
      WHERE c.id = "Evidence"."caseId"
        AND (
          (is_verified_platform_admin() = TRUE)
          OR
          (get_verified_department_id() IS NOT NULL AND c."departmentId" = get_verified_department_id())
        )
    )
  );

COMMIT;
