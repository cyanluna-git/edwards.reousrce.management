-- ============================================================================
-- Recharge & Planning System: Part 4 - Resource Plans Table
-- ============================================================================
-- Version: 1.0
-- Date: 2026-01-21
-- Database: PostgreSQL 15+
-- Purpose: Create resource planning table to replace Excel-based FTE allocation
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PLANNING SCENARIOS (For What-If Analysis)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS planning_scenarios (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    scenario_name VARCHAR(200) NOT NULL,
    scenario_type VARCHAR(20) DEFAULT 'BASELINE' CHECK (scenario_type IN ('BASELINE', 'OPTIMISTIC', 'CONSERVATIVE', 'CUSTOM')),
    fiscal_year INT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(36) REFERENCES users(id),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(fiscal_year, scenario_name)
);

CREATE INDEX IF NOT EXISTS idx_ps_fiscal_year ON planning_scenarios(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_ps_active ON planning_scenarios(is_active) WHERE is_active = TRUE;

COMMENT ON TABLE planning_scenarios IS 'Planning scenarios for what-if analysis. One BASELINE scenario per fiscal year is recommended.';

-- Insert default scenario for current year
INSERT INTO planning_scenarios (id, scenario_name, scenario_type, fiscal_year, description, is_active)
VALUES (
    'SCENARIO_2026_BASELINE',
    '2026 Baseline Plan',
    'BASELINE',
    2026,
    'Official 2026 resource plan based on approved headcount budget',
    TRUE
)
ON CONFLICT (fiscal_year, scenario_name) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. RESOURCE PLANS TABLE
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS resource_plans (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,

    -- WHO (Resource Assignment)
    user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
    position_id VARCHAR(50) REFERENCES job_positions(id),  -- For future hires (TBH)

    -- WHERE (Project/Activity)
    project_id VARCHAR(36) REFERENCES projects(id) ON DELETE CASCADE,
    activity_code_id VARCHAR(20) REFERENCES dim_activity_code(id),

    -- WHEN (Time Period)
    plan_year INT NOT NULL CHECK (plan_year BETWEEN 2020 AND 2100),
    plan_month INT NOT NULL CHECK (plan_month BETWEEN 1 AND 12),
    plan_week INT CHECK (plan_week BETWEEN 1 AND 53),  -- Optional weekly granularity

    -- WHAT (Allocation)
    planned_fte DECIMAL(5,2) NOT NULL CHECK (planned_fte > 0 AND planned_fte <= 1),
    planned_hours DECIMAL(7,2),  -- Alternative: direct hours (e.g., 40h, 80h)

    -- CLASSIFICATION (Mirrors timesheet classification)
    cost_bucket_id VARCHAR(50) REFERENCES dim_cost_bucket(id),
    allocation_rule_id INT REFERENCES allocation_rules(id),
    confidence_score DECIMAL(5,2) CHECK (confidence_score >= 0 AND confidence_score <= 100),

    -- SCENARIO & VERSION
    scenario_id VARCHAR(36) REFERENCES planning_scenarios(id) ON DELETE CASCADE,
    plan_version VARCHAR(20) DEFAULT 'v1',

    -- STATUS
    plan_status VARCHAR(20) DEFAULT 'DRAFT' CHECK (plan_status IN ('DRAFT', 'APPROVED', 'LOCKED', 'ARCHIVED')),
    notes TEXT,

    -- METADATA
    created_by VARCHAR(36) REFERENCES users(id),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Business rules
    CONSTRAINT rp_user_or_position_required CHECK (user_id IS NOT NULL OR position_id IS NOT NULL),
    CONSTRAINT rp_project_required CHECK (project_id IS NOT NULL),
    CONSTRAINT rp_activity_required CHECK (activity_code_id IS NOT NULL),

    -- Prevent duplicate allocations (unique per user/project/month/scenario)
    UNIQUE(user_id, project_id, activity_code_id, plan_year, plan_month, scenario_id, plan_version)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_rp_user_month ON resource_plans(user_id, plan_year, plan_month);
CREATE INDEX IF NOT EXISTS idx_rp_project_month ON resource_plans(project_id, plan_year, plan_month);
CREATE INDEX IF NOT EXISTS idx_rp_cost_bucket ON resource_plans(cost_bucket_id);
CREATE INDEX IF NOT EXISTS idx_rp_status ON resource_plans(plan_status);
CREATE INDEX IF NOT EXISTS idx_rp_scenario ON resource_plans(scenario_id);

-- Composite index for plan vs actual queries
CREATE INDEX IF NOT EXISTS idx_rp_user_project_month ON resource_plans(user_id, project_id, plan_year, plan_month);

COMMENT ON TABLE resource_plans IS 'Resource planning table. Replaces Excel-based FTE allocation matrix.';
COMMENT ON COLUMN resource_plans.planned_fte IS 'Planned FTE (0-1). 0.5 = 50% allocation, 1.0 = full-time';
COMMENT ON COLUMN resource_plans.planned_hours IS 'Alternative to FTE: direct hours (e.g., 40h for half-month)';
COMMENT ON COLUMN resource_plans.plan_status IS 'DRAFT=Editable, APPROVED=Locked for reporting, ARCHIVED=Historical';
COMMENT ON COLUMN resource_plans.scenario_id IS 'Links to planning scenario for what-if analysis';

-- ----------------------------------------------------------------------------
-- 3. FTE VALIDATION TRIGGER (Prevent Over-allocation)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION validate_fte_allocation()
RETURNS TRIGGER AS $$
DECLARE
    v_total_fte DECIMAL;
    v_user_name VARCHAR;
BEGIN
    -- Skip validation for future hires (no user_id)
    IF NEW.user_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Calculate total FTE for this user in this month (including this new entry)
    SELECT COALESCE(SUM(planned_fte), 0) + NEW.planned_fte
    INTO v_total_fte
    FROM resource_plans
    WHERE user_id = NEW.user_id
      AND plan_year = NEW.plan_year
      AND plan_month = NEW.plan_month
      AND scenario_id = NEW.scenario_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000');  -- Exclude self on UPDATE

    -- Check if total exceeds 1.0 FTE
    IF v_total_fte > 1.0 THEN
        SELECT name INTO v_user_name FROM users WHERE id = NEW.user_id;

        RAISE EXCEPTION 'FTE over-allocation detected for % in %-%: %.2f FTE (max: 1.0). Please adjust allocations.',
            v_user_name,
            NEW.plan_year,
            NEW.plan_month,
            v_total_fte
            USING HINT = 'Total FTE allocation per user per month cannot exceed 1.0';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_fte_allocation ON resource_plans;
CREATE TRIGGER trg_validate_fte_allocation
    BEFORE INSERT OR UPDATE ON resource_plans
    FOR EACH ROW
    EXECUTE FUNCTION validate_fte_allocation();

COMMENT ON FUNCTION validate_fte_allocation IS 'Prevents FTE over-allocation. Ensures sum of FTE per user per month <= 1.0';

-- ----------------------------------------------------------------------------
-- 4. AUTO-CLASSIFY RESOURCE PLANS (Trigger)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION auto_classify_resource_plan()
RETURNS TRIGGER AS $$
DECLARE
    v_classification RECORD;
    v_plan_date DATE;
BEGIN
    -- Only auto-classify if not already set
    IF NEW.cost_bucket_id IS NULL THEN
        -- Use first day of plan month for classification
        v_plan_date := DATE(NEW.plan_year || '-' || LPAD(NEW.plan_month::TEXT, 2, '0') || '-01');

        -- Call existing classification function
        SELECT * INTO v_classification
        FROM classify_timesheet_entry(
            NEW.user_id,
            NEW.project_id,
            NEW.activity_code_id,
            v_plan_date
        );

        NEW.cost_bucket_id := v_classification.cost_bucket_id;
        NEW.allocation_rule_id := v_classification.allocation_rule_id;
        NEW.confidence_score := v_classification.confidence_score;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_classify_resource_plan ON resource_plans;
CREATE TRIGGER trg_auto_classify_resource_plan
    BEFORE INSERT OR UPDATE ON resource_plans
    FOR EACH ROW
    EXECUTE FUNCTION auto_classify_resource_plan();

COMMENT ON FUNCTION auto_classify_resource_plan IS 'Auto-classify resource plans using same rules as timesheet entries';

-- ----------------------------------------------------------------------------
-- 5. HELPER VIEW: Monthly FTE Summary
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_monthly_fte_summary AS
SELECT
    u.id AS user_id,
    u.name AS user_name,
    d.department_name,
    rp.plan_year,
    rp.plan_month,
    rp.scenario_id,
    ps.scenario_name,
    COUNT(DISTINCT rp.project_id) AS project_count,
    SUM(rp.planned_fte) AS total_fte,
    CASE
        WHEN SUM(rp.planned_fte) > 1.0 THEN '🔴 Over-allocated'
        WHEN SUM(rp.planned_fte) < 0.8 THEN '🟡 Under-utilized'
        ELSE '🟢 Balanced'
    END AS allocation_status
FROM resource_plans rp
JOIN users u ON rp.user_id = u.id
JOIN departments d ON u.department_id = d.id
JOIN planning_scenarios ps ON rp.scenario_id = ps.id
WHERE rp.plan_status IN ('DRAFT', 'APPROVED')
GROUP BY u.id, u.name, d.department_name, rp.plan_year, rp.plan_month, rp.scenario_id, ps.scenario_name
ORDER BY rp.plan_year DESC, rp.plan_month DESC, u.name;

COMMENT ON VIEW v_monthly_fte_summary IS 'Monthly FTE allocation summary per user. Flags over/under allocation.';

-- ----------------------------------------------------------------------------
-- 6. VERIFICATION QUERY
-- ----------------------------------------------------------------------------

DO $$
DECLARE
    v_scenario_count INT;
    v_active_plans INT;
BEGIN
    SELECT COUNT(*) INTO v_scenario_count FROM planning_scenarios WHERE is_active = TRUE;
    SELECT COUNT(*) INTO v_active_plans FROM resource_plans WHERE plan_status IN ('DRAFT', 'APPROVED');

    RAISE NOTICE '✅ Resource Plans Table Created';
    RAISE NOTICE '   - Active scenarios: %', v_scenario_count;
    RAISE NOTICE '   - Active plans: %', v_active_plans;

    IF v_scenario_count = 0 THEN
        RAISE WARNING '⚠️  No active scenarios found. Create a baseline scenario.';
    END IF;
END $$;

-- View scenarios
SELECT
    scenario_name,
    scenario_type,
    fiscal_year,
    is_active,
    created_at
FROM planning_scenarios
ORDER BY fiscal_year DESC, scenario_type;

-- ============================================================================
-- END OF SCRIPT
-- ============================================================================
-- Next: Run sql-recharge-05-classification-functions.sql
-- ============================================================================
