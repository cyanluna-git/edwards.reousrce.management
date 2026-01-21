-- ============================================================================
-- Recharge & Planning System: Part 5 - Enhanced Classification Functions
-- ============================================================================
-- Version: 1.0
-- Date: 2026-01-21
-- Database: PostgreSQL 15+
-- Purpose: Enhanced classification logic with recharge detection
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ENHANCED CLASSIFICATION WITH RECHARGE LOGIC
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION classify_with_recharge(
    p_user_id VARCHAR,
    p_project_id VARCHAR,
    p_activity_code_id VARCHAR,
    p_work_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    cost_bucket_id VARCHAR,
    cost_bucket_name VARCHAR,
    allocation_rule_id INT,
    rule_name VARCHAR,
    confidence_score DECIMAL,
    is_rechargeable BOOLEAN,
    funding_entity_id VARCHAR,
    funding_entity_name VARCHAR,
    recharge_reason TEXT
) AS $$
DECLARE
    v_user_entity_id VARCHAR;
    v_user_dept_name VARCHAR;
    v_project_entity_id VARCHAR;
    v_project_recharge_status VARCHAR;
    v_project_code VARCHAR;
    v_base_classification RECORD;
BEGIN
    -- Step 1: Get user's entity (from department)
    SELECT d.funding_entity_id, d.department_name
    INTO v_user_entity_id, v_user_dept_name
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE u.id = p_user_id;

    -- Step 2: Get project's funding entity and recharge status
    SELECT p.funding_entity_id, p.recharge_status, p.code
    INTO v_project_entity_id, v_project_recharge_status, v_project_code
    FROM projects p
    WHERE p.id = p_project_id;

    -- Step 3: Get base classification (from existing function)
    SELECT * INTO v_base_classification
    FROM classify_timesheet_entry(p_user_id, p_project_id, p_activity_code_id, p_work_date);

    -- ========================================================================
    -- Step 4: RECHARGE LOGIC (The Core Algorithm)
    -- ========================================================================

    -- Rule 1: BILLABLE project + Cross-entity work = Recharge CAPEX
    IF v_project_recharge_status = 'BILLABLE'
       AND v_user_entity_id IS DISTINCT FROM v_project_entity_id
       AND v_project_entity_id IS NOT NULL THEN

        -- Override classification: This is inter-company recharge
        RETURN QUERY SELECT
            'BUCKET_DIRECT_PROJ'::VARCHAR AS cost_bucket_id,
            'Direct Project Work (Recharge)'::VARCHAR AS cost_bucket_name,
            v_base_classification.allocation_rule_id,
            ('Recharge: ' || v_base_classification.rule_name)::VARCHAR AS rule_name,
            GREATEST(v_base_classification.confidence_score, 85.0) AS confidence_score,
            TRUE AS is_rechargeable,
            v_project_entity_id,
            (SELECT entity_name FROM dim_funding_entity WHERE id = v_project_entity_id) AS funding_entity_name,
            format('Cross-entity work: %s team supporting %s project (%s)',
                   v_user_dept_name,
                   (SELECT entity_name FROM dim_funding_entity WHERE id = v_project_entity_id),
                   v_project_code
            ) AS recharge_reason;

    -- Rule 2: NON_BILLABLE project (Local CAPEX) = Direct Product/Project
    ELSIF v_project_recharge_status = 'NON_BILLABLE' THEN

        RETURN QUERY SELECT
            v_base_classification.cost_bucket_id,
            v_base_classification.cost_bucket_name,
            v_base_classification.allocation_rule_id,
            v_base_classification.rule_name,
            v_base_classification.confidence_score,
            FALSE AS is_rechargeable,
            COALESCE(v_project_entity_id, v_user_entity_id) AS funding_entity_id,
            (SELECT entity_name FROM dim_funding_entity WHERE id = COALESCE(v_project_entity_id, v_user_entity_id)) AS funding_entity_name,
            'Local CAPEX - no inter-company recharge' AS recharge_reason;

    -- Rule 3: INTERNAL project (Overhead) = No recharge
    ELSIF v_project_recharge_status = 'INTERNAL' THEN

        -- Force to overhead bucket if not already
        RETURN QUERY SELECT
            CASE
                WHEN v_base_classification.cost_bucket_id IN ('BUCKET_DIRECT_PROD', 'BUCKET_DIRECT_PROJ')
                THEN 'BUCKET_OVERHEAD'::VARCHAR
                ELSE v_base_classification.cost_bucket_id
            END AS cost_bucket_id,
            CASE
                WHEN v_base_classification.cost_bucket_id IN ('BUCKET_DIRECT_PROD', 'BUCKET_DIRECT_PROJ')
                THEN 'General Overhead'::VARCHAR
                ELSE v_base_classification.cost_bucket_name
            END AS cost_bucket_name,
            v_base_classification.allocation_rule_id,
            v_base_classification.rule_name,
            v_base_classification.confidence_score,
            FALSE AS is_rechargeable,
            v_user_entity_id AS funding_entity_id,
            (SELECT entity_name FROM dim_funding_entity WHERE id = v_user_entity_id) AS funding_entity_name,
            'Internal project - overhead allocation' AS recharge_reason;

    -- Rule 4: Same entity or no project entity = No recharge (use base classification)
    ELSE

        RETURN QUERY SELECT
            v_base_classification.cost_bucket_id,
            v_base_classification.cost_bucket_name,
            v_base_classification.allocation_rule_id,
            v_base_classification.rule_name,
            v_base_classification.confidence_score,
            FALSE AS is_rechargeable,
            COALESCE(v_project_entity_id, v_user_entity_id) AS funding_entity_id,
            (SELECT entity_name FROM dim_funding_entity WHERE id = COALESCE(v_project_entity_id, v_user_entity_id)) AS funding_entity_name,
            'Same-entity work - no recharge needed' AS recharge_reason;

    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION classify_with_recharge IS 'Enhanced classification with inter-company recharge detection. Returns cost bucket, funding entity, and recharge reasoning.';

-- ----------------------------------------------------------------------------
-- 2. UPDATE TIMESHEET TRIGGER TO USE RECHARGE LOGIC
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION auto_classify_timesheet_entry_with_recharge()
RETURNS TRIGGER AS $$
DECLARE
    v_classification RECORD;
BEGIN
    -- Only auto-classify if not manual override
    IF NEW.is_manual_override = FALSE OR NEW.is_manual_override IS NULL THEN
        -- Call enhanced classification function
        SELECT * INTO v_classification
        FROM classify_with_recharge(
            NEW.user_id,
            NEW.project_id,
            NEW.activity_code_id,
            NEW.work_date
        );

        -- Update entry with classification result
        NEW.cost_bucket_id := v_classification.cost_bucket_id;
        NEW.allocation_rule_id := v_classification.allocation_rule_id;
        NEW.confidence_score := v_classification.confidence_score;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Replace existing trigger
DROP TRIGGER IF EXISTS trg_auto_classify ON timesheet_entries;
CREATE TRIGGER trg_auto_classify
    BEFORE INSERT OR UPDATE ON timesheet_entries
    FOR EACH ROW
    EXECUTE FUNCTION auto_classify_timesheet_entry_with_recharge();

COMMENT ON FUNCTION auto_classify_timesheet_entry_with_recharge IS 'Enhanced trigger function with recharge logic';

-- ----------------------------------------------------------------------------
-- 3. RECHARGE DETECTION VIEW
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_recharge_entries AS
SELECT
    te.id AS entry_id,
    te.work_date,
    u.name AS user_name,
    u_dept.department_name AS user_department,
    u_entity.entity_name AS user_entity,
    p.code AS project_code,
    p.name AS project_name,
    p_entity.entity_name AS project_entity,
    p.recharge_status,
    ac.name AS activity_name,
    te.hours_logged,
    cb.bucket_name AS cost_bucket,
    jp.std_hourly_rate AS hourly_rate,
    te.hours_logged * jp.std_hourly_rate AS recharge_amount,
    CASE
        WHEN u_dept.funding_entity_id IS DISTINCT FROM p.funding_entity_id
             AND p.recharge_status = 'BILLABLE'
        THEN TRUE
        ELSE FALSE
    END AS is_cross_entity_recharge
FROM timesheet_entries te
JOIN users u ON te.user_id = u.id
JOIN departments u_dept ON u.department_id = u_dept.id
JOIN dim_funding_entity u_entity ON u_dept.funding_entity_id = u_entity.id
JOIN projects p ON te.project_id = p.id
LEFT JOIN dim_funding_entity p_entity ON p.funding_entity_id = p_entity.id
JOIN dim_activity_code ac ON te.activity_code_id = ac.id
JOIN dim_cost_bucket cb ON te.cost_bucket_id = cb.id
LEFT JOIN job_positions jp ON u.position_id = jp.id
WHERE p.recharge_status = 'BILLABLE'
ORDER BY te.work_date DESC, u.name;

COMMENT ON VIEW v_recharge_entries IS 'Identifies recharge entries for inter-company billing. Includes hourly rate and amount.';

-- ----------------------------------------------------------------------------
-- 4. MONTHLY RECHARGE REPORT QUERY
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_monthly_recharge_report AS
SELECT
    DATE_TRUNC('month', te.work_date) AS billing_month,
    p_entity.entity_code AS billing_to_entity,
    p_entity.entity_name AS billing_to_name,
    u_dept.department_name AS providing_department,
    u_entity.entity_name AS providing_entity,
    p.code AS project_code,
    p.name AS project_name,
    COUNT(DISTINCT te.user_id) AS contributor_count,
    SUM(te.hours_logged) AS total_hours,
    ROUND(AVG(jp.std_hourly_rate), 2) AS avg_hourly_rate,
    ROUND(SUM(te.hours_logged * jp.std_hourly_rate), 2) AS total_recharge_amount,
    p_entity.currency_code
FROM timesheet_entries te
JOIN users u ON te.user_id = u.id
JOIN departments u_dept ON u.department_id = u_dept.id
JOIN dim_funding_entity u_entity ON u_dept.funding_entity_id = u_entity.id
JOIN projects p ON te.project_id = p.id
JOIN dim_funding_entity p_entity ON p.funding_entity_id = p_entity.id
LEFT JOIN job_positions jp ON u.position_id = jp.id
WHERE p.recharge_status = 'BILLABLE'
  AND u_dept.funding_entity_id IS DISTINCT FROM p.funding_entity_id
  AND te.work_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '12 months'
GROUP BY
    DATE_TRUNC('month', te.work_date),
    p_entity.entity_code,
    p_entity.entity_name,
    u_dept.department_name,
    u_entity.entity_name,
    p.code,
    p.name,
    p_entity.currency_code
ORDER BY
    billing_month DESC,
    billing_to_entity,
    providing_department;

COMMENT ON VIEW v_monthly_recharge_report IS 'Monthly inter-company recharge report with amounts. Ready for invoice generation.';

-- ----------------------------------------------------------------------------
-- 5. RECHARGE SUMMARY BY ENTITY
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_recharge_summary_by_entity AS
SELECT
    billing_month,
    billing_to_entity,
    billing_to_name,
    SUM(total_hours) AS total_billable_hours,
    SUM(total_recharge_amount) AS total_amount,
    currency_code,
    COUNT(DISTINCT project_code) AS project_count,
    COUNT(DISTINCT providing_department) AS department_count
FROM v_monthly_recharge_report
GROUP BY
    billing_month,
    billing_to_entity,
    billing_to_name,
    currency_code
ORDER BY
    billing_month DESC,
    total_amount DESC;

COMMENT ON VIEW v_recharge_summary_by_entity IS 'High-level recharge summary by entity. For finance dashboard.';

-- ----------------------------------------------------------------------------
-- 6. VALIDATION & TESTING
-- ----------------------------------------------------------------------------

-- Test function with sample data
DO $$
DECLARE
    v_result RECORD;
    v_test_user_id VARCHAR;
    v_test_project_id VARCHAR;
BEGIN
    -- Get a sample user and project
    SELECT id INTO v_test_user_id FROM users LIMIT 1;
    SELECT id INTO v_test_project_id FROM projects WHERE recharge_status = 'BILLABLE' LIMIT 1;

    IF v_test_user_id IS NOT NULL AND v_test_project_id IS NOT NULL THEN
        SELECT * INTO v_result
        FROM classify_with_recharge(
            v_test_user_id,
            v_test_project_id,
            'ACT_DESIGN',
            CURRENT_DATE
        );

        RAISE NOTICE '✅ Recharge Classification Test:';
        RAISE NOTICE '   - Cost Bucket: %', v_result.cost_bucket_name;
        RAISE NOTICE '   - Is Rechargeable: %', v_result.is_rechargeable;
        RAISE NOTICE '   - Funding Entity: %', v_result.funding_entity_name;
        RAISE NOTICE '   - Reason: %', v_result.recharge_reason;
        RAISE NOTICE '   - Confidence: %', v_result.confidence_score;
    ELSE
        RAISE NOTICE '⚠️  No test data available (need users and billable projects)';
    END IF;
END $$;

-- View recharge statistics
SELECT
    'Billable Projects' AS metric,
    COUNT(*) AS count
FROM projects
WHERE recharge_status = 'BILLABLE'
UNION ALL
SELECT
    'Cross-Entity Timesheet Entries' AS metric,
    COUNT(*) AS count
FROM timesheet_entries te
JOIN users u ON te.user_id = u.id
JOIN departments d ON u.department_id = d.id
JOIN projects p ON te.project_id = p.id
WHERE d.funding_entity_id IS DISTINCT FROM p.funding_entity_id
  AND p.recharge_status = 'BILLABLE';

-- ============================================================================
-- END OF SCRIPT
-- ============================================================================
-- Next: Run sql-recharge-06-plan-vs-actual-views.sql
-- ============================================================================
