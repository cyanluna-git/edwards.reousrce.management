-- ============================================================================
-- Recharge & Planning System: Part 3 - Projects Table Enhancement
-- ============================================================================
-- Version: 1.0
-- Date: 2026-01-21
-- Database: PostgreSQL 15+
-- Purpose: Add recharge and funding tracking columns to projects table
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ADD NEW COLUMNS TO PROJECTS TABLE
-- ----------------------------------------------------------------------------

ALTER TABLE projects ADD COLUMN IF NOT EXISTS
    funding_entity_id VARCHAR(50),
    recharge_status VARCHAR(20),
    io_category_code VARCHAR(100),
    is_capitalizable BOOLEAN DEFAULT FALSE,
    gl_account_code VARCHAR(50);

-- Add foreign key constraints
ALTER TABLE projects
    DROP CONSTRAINT IF EXISTS projects_funding_entity_fkey,
    ADD CONSTRAINT projects_funding_entity_fkey
        FOREIGN KEY (funding_entity_id)
        REFERENCES dim_funding_entity(id)
        ON DELETE SET NULL;

-- Add check constraint for recharge_status
ALTER TABLE projects
    DROP CONSTRAINT IF EXISTS projects_recharge_status_check,
    ADD CONSTRAINT projects_recharge_status_check
        CHECK (recharge_status IN ('BILLABLE', 'NON_BILLABLE', 'INTERNAL'));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_proj_funding_entity ON projects(funding_entity_id);
CREATE INDEX IF NOT EXISTS idx_proj_recharge_status ON projects(recharge_status);
CREATE INDEX IF NOT EXISTS idx_proj_capitalizable ON projects(is_capitalizable);

-- Add comments
COMMENT ON COLUMN projects.funding_entity_id IS 'Who pays the bill for this project (VSS, SUN, LOCAL_KR)';
COMMENT ON COLUMN projects.recharge_status IS 'BILLABLE=Inter-company recharge, NON_BILLABLE=Local CAPEX, INTERNAL=Overhead';
COMMENT ON COLUMN projects.io_category_code IS 'Maps to IO Framework Programme (e.g., Field Failure, Operations Support)';
COMMENT ON COLUMN projects.is_capitalizable IS 'TRUE=CAPEX (can be capitalized), FALSE=OPEX (expensed immediately)';
COMMENT ON COLUMN projects.gl_account_code IS 'General Ledger account number for ERP integration';

-- ----------------------------------------------------------------------------
-- 2. AUTO-CLASSIFICATION FUNCTION
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION auto_classify_project_funding(
    p_project_code VARCHAR,
    p_project_name VARCHAR,
    p_project_type_id VARCHAR
)
RETURNS TABLE (
    funding_entity_id VARCHAR,
    recharge_status VARCHAR,
    io_category_code VARCHAR,
    is_capitalizable BOOLEAN
) AS $$
BEGIN
    -- Rule 1: IO codes containing 'VSS' → VSS entity, BILLABLE
    IF p_project_code ILIKE '%VSS%' OR p_project_name ILIKE '%VSS%' THEN
        RETURN QUERY SELECT
            'ENTITY_VSS'::VARCHAR,
            'BILLABLE'::VARCHAR,
            'FIELD_FAILURE'::VARCHAR,
            TRUE;

    -- Rule 2: IO codes containing 'SUN' → SUN entity, BILLABLE
    ELSIF p_project_code ILIKE '%SUN%' OR p_project_name ILIKE '%SUN%' THEN
        RETURN QUERY SELECT
            'ENTITY_SUN'::VARCHAR,
            'BILLABLE'::VARCHAR,
            'OPS_SUPPORT'::VARCHAR,
            TRUE;

    -- Rule 3: NPI projects → Local Korea, NON_BILLABLE, CAPEX
    ELSIF p_project_type_id = 'NPI' THEN
        RETURN QUERY SELECT
            'ENTITY_LOCAL_KR'::VARCHAR,
            'NON_BILLABLE'::VARCHAR,
            'NPI'::VARCHAR,
            TRUE;

    -- Rule 4: ETO projects → Local Korea, NON_BILLABLE, CAPEX
    ELSIF p_project_type_id = 'ETO' THEN
        RETURN QUERY SELECT
            'ENTITY_LOCAL_KR'::VARCHAR,
            'NON_BILLABLE'::VARCHAR,
            'NPI'::VARCHAR,
            TRUE;

    -- Rule 5: SUPPORT projects → Check if division-specific
    ELSIF p_project_type_id = 'SUPPORT' THEN
        -- If project name contains division name, assume billable
        IF p_project_name ILIKE '%field%' OR p_project_name ILIKE '%customer%' THEN
            RETURN QUERY SELECT
                'ENTITY_VSS'::VARCHAR,
                'BILLABLE'::VARCHAR,
                'FIELD_FAILURE'::VARCHAR,
                TRUE;
        ELSE
            -- Generic support is overhead
            RETURN QUERY SELECT
                'ENTITY_LOCAL_KR'::VARCHAR,
                'INTERNAL'::VARCHAR,
                'OPS_SUPPORT'::VARCHAR,
                FALSE;
        END IF;

    -- Rule 6: SUSTAINING projects → Usually billable CAPEX to VSS
    ELSIF p_project_type_id = 'SUSTAINING' THEN
        RETURN QUERY SELECT
            'ENTITY_VSS'::VARCHAR,
            'BILLABLE'::VARCHAR,
            'SUSTAINING'::VARCHAR,
            TRUE;

    -- Rule 7: TEAM_TASK, INTERNAL → Local overhead
    ELSIF p_project_type_id IN ('TEAM_TASK', 'INTERNAL') THEN
        RETURN QUERY SELECT
            'ENTITY_LOCAL_KR'::VARCHAR,
            'INTERNAL'::VARCHAR,
            'INTERNAL_TOOLS'::VARCHAR,
            FALSE;

    -- Default: Local Korea, Internal, OPEX
    ELSE
        RETURN QUERY SELECT
            'ENTITY_LOCAL_KR'::VARCHAR,
            'INTERNAL'::VARCHAR,
            NULL::VARCHAR,
            FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION auto_classify_project_funding IS 'Auto-classify project funding based on IO code naming convention and project type';

-- ----------------------------------------------------------------------------
-- 3. BATCH UPDATE EXISTING PROJECTS
-- ----------------------------------------------------------------------------

-- Update projects that don't have funding info
UPDATE projects p
SET (funding_entity_id, recharge_status, io_category_code, is_capitalizable) = (
    SELECT * FROM auto_classify_project_funding(p.code, p.name, p.project_type_id)
)
WHERE p.funding_entity_id IS NULL;

-- ----------------------------------------------------------------------------
-- 4. TRIGGER FOR NEW PROJECTS (Auto-classify on insert/update)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION trg_auto_classify_project()
RETURNS TRIGGER AS $$
DECLARE
    v_classification RECORD;
BEGIN
    -- Only auto-classify if fields are NULL
    IF NEW.funding_entity_id IS NULL THEN
        SELECT * INTO v_classification
        FROM auto_classify_project_funding(NEW.code, NEW.name, NEW.project_type_id);

        NEW.funding_entity_id := v_classification.funding_entity_id;
        NEW.recharge_status := v_classification.recharge_status;
        NEW.io_category_code := v_classification.io_category_code;
        NEW.is_capitalizable := v_classification.is_capitalizable;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_classify_project ON projects;
CREATE TRIGGER trg_auto_classify_project
    BEFORE INSERT OR UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION trg_auto_classify_project();

COMMENT ON FUNCTION trg_auto_classify_project IS 'Trigger function to auto-classify new projects on insert/update';

-- ----------------------------------------------------------------------------
-- 5. VALIDATION VIEW: Project Financial Classification
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_project_financial_summary AS
SELECT
    p.id,
    p.code,
    p.name,
    pt.name AS project_type,
    p.category,
    fe.entity_name AS funding_entity,
    p.recharge_status,
    p.io_category_code,
    p.is_capitalizable,
    p.gl_account_code,
    CASE
        WHEN p.is_capitalizable THEN 'CAPEX'
        ELSE 'OPEX'
    END AS accounting_category,
    CASE
        WHEN p.recharge_status = 'BILLABLE' THEN fe.entity_name || ' (Recharge)'
        WHEN p.recharge_status = 'NON_BILLABLE' THEN fe.entity_name || ' (Direct)'
        ELSE 'Overhead'
    END AS billing_description
FROM projects p
LEFT JOIN project_types pt ON p.project_type_id = pt.id
LEFT JOIN dim_funding_entity fe ON p.funding_entity_id = fe.id
ORDER BY p.code;

COMMENT ON VIEW v_project_financial_summary IS 'Human-readable summary of project financial classification';

-- ----------------------------------------------------------------------------
-- 6. VERIFICATION QUERY
-- ----------------------------------------------------------------------------

DO $$
DECLARE
    v_total_projects INT;
    v_classified_projects INT;
    v_billable_projects INT;
    v_capex_projects INT;
BEGIN
    SELECT COUNT(*) INTO v_total_projects FROM projects WHERE status = 'InProgress';
    SELECT COUNT(*) INTO v_classified_projects FROM projects WHERE funding_entity_id IS NOT NULL AND status = 'InProgress';
    SELECT COUNT(*) INTO v_billable_projects FROM projects WHERE recharge_status = 'BILLABLE' AND status = 'InProgress';
    SELECT COUNT(*) INTO v_capex_projects FROM projects WHERE is_capitalizable = TRUE AND status = 'InProgress';

    RAISE NOTICE '✅ Projects Table Enhanced';
    RAISE NOTICE '   - Active projects: %', v_total_projects;
    RAISE NOTICE '   - Classified projects: % (%.1f%%)',
        v_classified_projects,
        CASE WHEN v_total_projects > 0 THEN (v_classified_projects::DECIMAL / v_total_projects * 100) ELSE 0 END;
    RAISE NOTICE '   - Billable (Recharge): %', v_billable_projects;
    RAISE NOTICE '   - CAPEX projects: %', v_capex_projects;

    IF v_classified_projects < v_total_projects THEN
        RAISE WARNING '⚠️  Some projects not auto-classified. Review manually.';
    END IF;
END $$;

-- View classification distribution
SELECT
    recharge_status,
    is_capitalizable,
    fe.entity_name AS funding_entity,
    COUNT(*) AS project_count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS percentage
FROM projects p
LEFT JOIN dim_funding_entity fe ON p.funding_entity_id = fe.id
WHERE p.status = 'InProgress'
GROUP BY recharge_status, is_capitalizable, fe.entity_name
ORDER BY recharge_status, is_capitalizable DESC;

-- ============================================================================
-- END OF SCRIPT
-- ============================================================================
-- Next: Run sql-recharge-04-resource-plans.sql
-- ============================================================================
