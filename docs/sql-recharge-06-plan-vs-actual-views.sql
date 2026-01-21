-- ============================================================================
-- Recharge & Planning System: Part 6 - Plan vs Actual Reporting Views
-- ============================================================================
-- Version: 1.0
-- Date: 2026-01-21
-- Database: PostgreSQL 15+
-- Purpose: Create comprehensive reporting views for plan vs actual analysis
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CORE VIEW: Plan vs Actual by User/Project/Month
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_plan_vs_actual AS
SELECT
    -- Identifiers
    p.id AS project_id,
    p.code AS project_code,
    p.name AS project_name,
    u.id AS user_id,
    u.name AS user_name,
    d.department_name,
    st.name AS sub_team_name,

    -- Time period
    rp.plan_year,
    rp.plan_month,
    rp.scenario_id,
    ps.scenario_name,

    -- Planning data
    SUM(rp.planned_fte) AS planned_fte,
    SUM(rp.planned_hours) AS planned_hours,
    SUM(rp.planned_fte) * 160 AS planned_hours_calc,  -- Assume 160h/month for 1 FTE

    -- Actual data
    COUNT(DISTINCT te.work_date) AS days_worked,
    SUM(te.hours_logged) AS actual_hours,
    SUM(te.hours_logged) / 160.0 AS actual_fte,

    -- Variance
    SUM(COALESCE(rp.planned_hours, rp.planned_fte * 160)) - COALESCE(SUM(te.hours_logged), 0) AS variance_hours,
    CASE
        WHEN SUM(COALESCE(rp.planned_hours, rp.planned_fte * 160)) > 0
        THEN ROUND((COALESCE(SUM(te.hours_logged), 0) / SUM(COALESCE(rp.planned_hours, rp.planned_fte * 160)) * 100), 1)
        ELSE 0
    END AS utilization_pct,

    -- Status indicator
    CASE
        WHEN SUM(te.hours_logged) IS NULL THEN '⚪ Not Started'
        WHEN COALESCE(SUM(te.hours_logged), 0) < SUM(COALESCE(rp.planned_hours, rp.planned_fte * 160)) * 0.8 THEN '🔴 Under-delivered'
        WHEN COALESCE(SUM(te.hours_logged), 0) > SUM(COALESCE(rp.planned_hours, rp.planned_fte * 160)) * 1.2 THEN '🟡 Over-spent'
        ELSE '🟢 On Track'
    END AS delivery_status,

    -- Cost allocation
    cb.bucket_name AS cost_bucket,
    fe.entity_name AS funding_entity,
    p.is_capitalizable,

    -- Recharge info
    p.recharge_status,
    CASE
        WHEN d.funding_entity_id IS DISTINCT FROM p.funding_entity_id
             AND p.recharge_status = 'BILLABLE'
        THEN TRUE
        ELSE FALSE
    END AS is_recharge_work,

    -- Financial data
    jp.std_hourly_rate,
    COALESCE(SUM(te.hours_logged), 0) * jp.std_hourly_rate AS actual_cost,
    SUM(COALESCE(rp.planned_hours, rp.planned_fte * 160)) * jp.std_hourly_rate AS planned_cost

FROM resource_plans rp
LEFT JOIN timesheet_entries te ON
    te.user_id = rp.user_id
    AND te.project_id = rp.project_id
    AND EXTRACT(YEAR FROM te.work_date) = rp.plan_year
    AND EXTRACT(MONTH FROM te.work_date) = rp.plan_month
LEFT JOIN planning_scenarios ps ON rp.scenario_id = ps.id
LEFT JOIN users u ON rp.user_id = u.id
LEFT JOIN departments d ON u.department_id = d.id
LEFT JOIN sub_teams st ON u.sub_team_id = st.id
LEFT JOIN projects p ON rp.project_id = p.id
LEFT JOIN dim_cost_bucket cb ON rp.cost_bucket_id = cb.id
LEFT JOIN dim_funding_entity fe ON p.funding_entity_id = fe.id
LEFT JOIN job_positions jp ON u.position_id = jp.id
WHERE rp.plan_status IN ('APPROVED', 'LOCKED')  -- Only show approved plans
GROUP BY
    p.id, p.code, p.name,
    u.id, u.name,
    d.department_name,
    st.name,
    rp.plan_year, rp.plan_month,
    rp.scenario_id, ps.scenario_name,
    cb.bucket_name,
    fe.entity_name,
    p.is_capitalizable,
    p.recharge_status,
    d.funding_entity_id,
    jp.std_hourly_rate
ORDER BY
    rp.plan_year DESC,
    rp.plan_month DESC,
    p.code,
    u.name;

COMMENT ON VIEW v_plan_vs_actual IS 'Comprehensive plan vs actual analysis by user, project, and month. Includes variance, utilization, and cost data.';

-- ----------------------------------------------------------------------------
-- 2. DEPARTMENT-LEVEL SUMMARY
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_dept_plan_vs_actual AS
SELECT
    department_name,
    plan_year,
    plan_month,
    scenario_name,
    funding_entity,

    -- Aggregated metrics
    COUNT(DISTINCT user_id) AS active_headcount,
    COUNT(DISTINCT project_id) AS active_projects,

    -- Planning
    ROUND(SUM(planned_fte), 1) AS total_planned_fte,
    ROUND(SUM(planned_hours), 0) AS total_planned_hours,

    -- Actuals
    ROUND(SUM(actual_fte), 1) AS total_actual_fte,
    ROUND(SUM(actual_hours), 0) AS total_actual_hours,

    -- Variance
    ROUND(SUM(variance_hours), 0) AS total_variance_hours,
    ROUND(AVG(utilization_pct), 1) AS avg_utilization_pct,

    -- Cost
    ROUND(SUM(planned_cost), 0) AS total_planned_cost,
    ROUND(SUM(actual_cost), 0) AS total_actual_cost,
    ROUND(SUM(actual_cost) - SUM(planned_cost), 0) AS cost_variance,

    -- Status distribution
    COUNT(CASE WHEN delivery_status = '🟢 On Track' THEN 1 END) AS on_track_count,
    COUNT(CASE WHEN delivery_status = '🔴 Under-delivered' THEN 1 END) AS under_delivered_count,
    COUNT(CASE WHEN delivery_status = '🟡 Over-spent' THEN 1 END) AS over_spent_count,
    COUNT(CASE WHEN delivery_status = '⚪ Not Started' THEN 1 END) AS not_started_count

FROM v_plan_vs_actual
GROUP BY
    department_name,
    plan_year,
    plan_month,
    scenario_name,
    funding_entity
ORDER BY
    plan_year DESC,
    plan_month DESC,
    department_name;

COMMENT ON VIEW v_dept_plan_vs_actual IS 'Department-level plan vs actual rollup. For management dashboards.';

-- ----------------------------------------------------------------------------
-- 3. PROJECT-LEVEL ROLLUP
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_project_plan_vs_actual AS
SELECT
    project_code,
    project_name,
    plan_year,
    plan_month,
    cost_bucket,
    funding_entity,
    recharge_status,
    is_capitalizable,

    -- Resource allocation
    COUNT(DISTINCT user_id) AS contributor_count,
    ROUND(SUM(planned_fte), 1) AS total_planned_fte,
    ROUND(SUM(actual_fte), 1) AS total_actual_fte,

    -- Hours
    ROUND(SUM(planned_hours_calc), 0) AS total_planned_hours,
    ROUND(SUM(actual_hours), 0) AS total_actual_hours,
    ROUND(SUM(variance_hours), 0) AS total_variance_hours,

    -- Utilization
    CASE
        WHEN SUM(planned_hours_calc) > 0
        THEN ROUND((SUM(actual_hours) / SUM(planned_hours_calc) * 100), 1)
        ELSE 0
    END AS project_utilization_pct,

    -- Cost
    ROUND(SUM(planned_cost), 0) AS total_planned_cost,
    ROUND(SUM(actual_cost), 0) AS total_actual_cost,

    -- Status
    CASE
        WHEN SUM(actual_hours) IS NULL OR SUM(actual_hours) = 0 THEN '⚪ Not Started'
        WHEN SUM(actual_hours) < SUM(planned_hours_calc) * 0.8 THEN '🔴 Under-resourced'
        WHEN SUM(actual_hours) > SUM(planned_hours_calc) * 1.2 THEN '🟡 Over-allocated'
        ELSE '🟢 On Track'
    END AS project_status

FROM v_plan_vs_actual
GROUP BY
    project_code,
    project_name,
    plan_year,
    plan_month,
    cost_bucket,
    funding_entity,
    recharge_status,
    is_capitalizable
ORDER BY
    plan_year DESC,
    plan_month DESC,
    total_actual_hours DESC;

COMMENT ON VIEW v_project_plan_vs_actual IS 'Project-level resource allocation tracking. Shows which projects are on/off track.';

-- ----------------------------------------------------------------------------
-- 4. MONTHLY VARIANCE HEATMAP DATA
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_monthly_variance_heatmap AS
SELECT
    department_name,
    user_name,
    plan_year,
    plan_month,
    ROUND(SUM(planned_fte), 2) AS planned_fte,
    ROUND(SUM(actual_fte), 2) AS actual_fte,
    ROUND(SUM(actual_fte) - SUM(planned_fte), 2) AS fte_variance,
    CASE
        WHEN ABS(SUM(actual_fte) - SUM(planned_fte)) < 0.1 THEN '🟢'
        WHEN ABS(SUM(actual_fte) - SUM(planned_fte)) < 0.3 THEN '🟡'
        ELSE '🔴'
    END AS variance_indicator,
    ROUND(AVG(utilization_pct), 1) AS avg_utilization,
    COUNT(DISTINCT project_id) AS project_count
FROM v_plan_vs_actual
GROUP BY
    department_name,
    user_name,
    plan_year,
    plan_month
ORDER BY
    department_name,
    user_name,
    plan_year DESC,
    plan_month DESC;

COMMENT ON VIEW v_monthly_variance_heatmap IS 'User-level FTE variance for heatmap visualization. Shows allocation accuracy.';

-- ----------------------------------------------------------------------------
-- 5. COST BUCKET DISTRIBUTION (Plan vs Actual)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_cost_bucket_plan_vs_actual AS
SELECT
    plan_year,
    plan_month,
    cost_bucket,
    funding_entity,

    -- Planning
    ROUND(SUM(planned_hours), 0) AS planned_hours,
    ROUND(SUM(planned_hours) * 100.0 / SUM(SUM(planned_hours)) OVER (PARTITION BY plan_year, plan_month), 1) AS planned_pct,

    -- Actuals
    ROUND(SUM(actual_hours), 0) AS actual_hours,
    ROUND(SUM(actual_hours) * 100.0 / SUM(SUM(actual_hours)) OVER (PARTITION BY plan_year, plan_month), 1) AS actual_pct,

    -- Variance
    ROUND(SUM(actual_hours) - SUM(planned_hours), 0) AS hours_variance,

    -- Cost
    ROUND(SUM(planned_cost), 0) AS planned_cost,
    ROUND(SUM(actual_cost), 0) AS actual_cost,
    ROUND(SUM(actual_cost) - SUM(planned_cost), 0) AS cost_variance

FROM v_plan_vs_actual
GROUP BY
    plan_year,
    plan_month,
    cost_bucket,
    funding_entity
ORDER BY
    plan_year DESC,
    plan_month DESC,
    actual_hours DESC;

COMMENT ON VIEW v_cost_bucket_plan_vs_actual IS 'Cost bucket distribution analysis. Compare planned vs actual allocation patterns.';

-- ----------------------------------------------------------------------------
-- 6. SAMPLE QUERIES FOR COMMON REPORTS
-- ----------------------------------------------------------------------------

-- Query 1: Current month department utilization
/*
SELECT
    department_name,
    total_planned_fte,
    total_actual_fte,
    avg_utilization_pct,
    on_track_count,
    under_delivered_count,
    over_spent_count
FROM v_dept_plan_vs_actual
WHERE plan_year = EXTRACT(YEAR FROM CURRENT_DATE)
  AND plan_month = EXTRACT(MONTH FROM CURRENT_DATE)
ORDER BY department_name;
*/

-- Query 2: Project delivery tracking (Q1 2026)
/*
SELECT
    project_code,
    project_name,
    SUM(total_planned_hours) AS q1_planned_hours,
    SUM(total_actual_hours) AS q1_actual_hours,
    ROUND(AVG(project_utilization_pct), 1) AS avg_utilization,
    MAX(project_status) AS overall_status
FROM v_project_plan_vs_actual
WHERE plan_year = 2026
  AND plan_month BETWEEN 1 AND 3
GROUP BY project_code, project_name
ORDER BY q1_actual_hours DESC;
*/

-- Query 3: Recharge hours by entity (for invoicing)
/*
SELECT
    funding_entity AS billing_to,
    plan_year,
    plan_month,
    SUM(actual_hours) AS billable_hours,
    ROUND(SUM(actual_cost), 2) AS billing_amount
FROM v_plan_vs_actual
WHERE is_recharge_work = TRUE
  AND plan_year = 2026
GROUP BY funding_entity, plan_year, plan_month
ORDER BY plan_year DESC, plan_month DESC, billing_amount DESC;
*/

-- ----------------------------------------------------------------------------
-- 7. VERIFICATION
-- ----------------------------------------------------------------------------

DO $$
DECLARE
    v_plan_count INT;
    v_actual_count INT;
    v_variance_records INT;
BEGIN
    SELECT COUNT(*) INTO v_plan_count FROM resource_plans WHERE plan_status IN ('APPROVED', 'LOCKED');
    SELECT COUNT(DISTINCT (user_id, project_id, DATE_TRUNC('month', work_date))) INTO v_actual_count FROM timesheet_entries;
    SELECT COUNT(*) INTO v_variance_records FROM v_plan_vs_actual;

    RAISE NOTICE '✅ Plan vs Actual Views Created';
    RAISE NOTICE '   - Approved resource plans: %', v_plan_count;
    RAISE NOTICE '   - Actual entries (unique user/project/month): %', v_actual_count;
    RAISE NOTICE '   - Plan vs Actual records: %', v_variance_records;
END $$;

-- ============================================================================
-- END OF SCRIPT
-- ============================================================================
-- Next: Run sql-recharge-07-data-migration.sql (if you have Excel data)
-- ============================================================================
