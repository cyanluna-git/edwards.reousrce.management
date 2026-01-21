-- ============================================================================
-- CONTEXT-AWARE TIMESHEET SYSTEM: Allocation Rules & Classification Function
-- Part 2: Business Rules Implementation
-- ============================================================================
-- Version: 1.0
-- Date: 2026-01-21
-- Prerequisite: Run sql-implementation-activity-codes.sql first
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SEED ALLOCATION RULES (Starter Set - 30 Rules)
-- ----------------------------------------------------------------------------

-- Clear existing rules if re-running (optional)
-- TRUNCATE allocation_rules RESTART IDENTITY CASCADE;

-- Insert allocation rules in priority order
INSERT INTO allocation_rules (
    rule_priority,
    rule_name,
    user_department_id,
    user_sub_team_id,
    project_type_id,
    project_category,
    activity_code_id,
    activity_category,
    target_cost_bucket_id,
    allocation_percentage,
    description
) VALUES

-- ══════════════════════════════════════════════════════════════════════════
-- TIER 1: DIRECT PRODUCT DEVELOPMENT (Highest Priority)
-- ══════════════════════════════════════════════════════════════════════════

(10, 'NPI Design Work', NULL, NULL, 'NPI', NULL, 'ACT_DESIGN', NULL, 'BUCKET_DIRECT_PROD', 100,
 'All design work on NPI projects is direct product development'),

(11, 'NPI Testing Work', NULL, NULL, 'NPI', NULL, 'ACT_TEST', NULL, 'BUCKET_DIRECT_PROD', 100,
 'All testing on NPI projects is direct product development'),

(12, 'NPI Documentation', NULL, NULL, 'NPI', NULL, 'ACT_DOC', NULL, 'BUCKET_DIRECT_PROD', 100,
 'Documentation for NPI projects'),

(13, 'NPI Release Activities', NULL, NULL, 'NPI', NULL, 'ACT_RELEASE', NULL, 'BUCKET_DIRECT_PROD', 100,
 'Release and deployment for NPI projects'),

(14, 'NPI Reviews', NULL, NULL, 'NPI', NULL, 'ACT_REVIEW', NULL, 'BUCKET_DIRECT_PROD', 100,
 'Design reviews and gate reviews for NPI'),

(15, 'NPI Project Meetings', NULL, NULL, 'NPI', NULL, 'ACT_MEET', NULL, 'BUCKET_DIRECT_PROD', 100,
 'Project meetings for NPI work'),

-- ETO (Engineer-to-Order) Projects
(20, 'ETO Design Work', NULL, NULL, 'ETO', NULL, 'ACT_DESIGN', NULL, 'BUCKET_DIRECT_PROD', 100,
 'All design work on ETO projects'),

(21, 'ETO Testing Work', NULL, NULL, 'ETO', NULL, 'ACT_TEST', NULL, 'BUCKET_DIRECT_PROD', 100,
 'All testing on ETO projects'),

(22, 'ETO Documentation', NULL, NULL, 'ETO', NULL, 'ACT_DOC', NULL, 'BUCKET_DIRECT_PROD', 100,
 'Documentation for ETO projects'),

(23, 'ETO Release', NULL, NULL, 'ETO', NULL, 'ACT_RELEASE', NULL, 'BUCKET_DIRECT_PROD', 100,
 'Release activities for ETO'),

(24, 'ETO Reviews', NULL, NULL, 'ETO', NULL, 'ACT_REVIEW', NULL, 'BUCKET_DIRECT_PROD', 100,
 'Reviews for ETO projects'),

(25, 'ETO Meetings', NULL, NULL, 'ETO', NULL, 'ACT_MEET', NULL, 'BUCKET_DIRECT_PROD', 100,
 'Project meetings for ETO'),

-- Product Category (Generic)
(30, 'Product Development', NULL, NULL, NULL, 'PRODUCT', 'ACT_DESIGN', NULL, 'BUCKET_DIRECT_PROD', 100,
 'Development work on any PRODUCT category project'),

(31, 'Product Testing', NULL, NULL, NULL, 'PRODUCT', 'ACT_TEST', NULL, 'BUCKET_DIRECT_PROD', 100,
 'Testing on PRODUCT category projects'),

-- ══════════════════════════════════════════════════════════════════════════
-- TIER 2: DIRECT PROJECT WORK (Lower Margin)
-- ══════════════════════════════════════════════════════════════════════════

(40, 'Project Category Development', NULL, NULL, NULL, 'PROJECT', 'ACT_DESIGN', NULL, 'BUCKET_DIRECT_PROJ', 100,
 'Development on PROJECT category items'),

(41, 'Project Category Testing', NULL, NULL, NULL, 'PROJECT', 'ACT_TEST', NULL, 'BUCKET_DIRECT_PROJ', 100,
 'Testing on PROJECT category items'),

(42, 'Project Category Meetings', NULL, NULL, NULL, 'PROJECT', 'ACT_MEET', NULL, 'BUCKET_DIRECT_PROJ', 100,
 'Meetings for PROJECT category work'),

-- ══════════════════════════════════════════════════════════════════════════
-- TIER 3: INDIRECT SUPPORT WORK
-- ══════════════════════════════════════════════════════════════════════════

-- Activity-based rules (regardless of project)
(50, 'Field Support Activities', NULL, NULL, NULL, NULL, 'ACT_FIELD', NULL, 'BUCKET_INDIRECT', 100,
 'All field support is indirect work'),

(51, 'Sales Support Activities', NULL, NULL, NULL, NULL, 'ACT_SALES', NULL, 'BUCKET_INDIRECT', 100,
 'All sales support is indirect work'),

(52, 'Triage Activities', NULL, NULL, NULL, NULL, 'ACT_TRIAGE', NULL, 'BUCKET_INDIRECT', 100,
 'Issue investigation and triage'),

-- Project-type based rules
(60, 'Support Project Type', NULL, NULL, 'SUPPORT', NULL, NULL, NULL, 'BUCKET_INDIRECT', 100,
 'All work on SUPPORT type projects'),

(61, 'Sustaining Project Type', NULL, NULL, 'SUSTAINING', NULL, NULL, NULL, 'BUCKET_INDIRECT', 100,
 'All work on SUSTAINING projects'),

(62, 'Legacy Project Type', NULL, NULL, 'LEGACY', NULL, NULL, NULL, 'BUCKET_INDIRECT', 100,
 'All work on LEGACY projects'),

-- Functional category projects
(65, 'Functional Projects', NULL, NULL, NULL, 'FUNCTIONAL', NULL, NULL, 'BUCKET_INDIRECT', 100,
 'All FUNCTIONAL category projects are indirect'),

-- Sustaining activity
(70, 'Sustaining Work Activity', NULL, NULL, NULL, NULL, 'ACT_SUSTAIN', NULL, 'BUCKET_INDIRECT', 100,
 'Bug fixes and sustaining work'),

-- Cross-department support (Example: Central Engineering)
-- Uncomment and adjust department IDs based on your organization
-- (75, 'Central Eng Cross-Team', 'DEPT_CENTRAL', NULL, NULL, NULL, NULL, NULL, 'BUCKET_INDIRECT', 100,
--  'Central Engineering supporting other teams'),

-- ══════════════════════════════════════════════════════════════════════════
-- TIER 4: GENERAL OVERHEAD (Always)
-- ══════════════════════════════════════════════════════════════════════════

(100, 'Training Activities', NULL, NULL, NULL, NULL, 'ACT_TRAINING', NULL, 'BUCKET_OVERHEAD', 100,
 'All training and learning activities'),

(101, 'Admin Work', NULL, NULL, NULL, NULL, 'ACT_ADMIN', NULL, 'BUCKET_OVERHEAD', 100,
 'Administrative work and processes'),

(102, 'Hiring Activities', NULL, NULL, NULL, NULL, 'ACT_HIRING', NULL, 'BUCKET_OVERHEAD', 100,
 'Recruiting and hiring activities'),

(103, 'Time Off', NULL, NULL, NULL, NULL, 'ACT_PTO', NULL, 'BUCKET_OVERHEAD', 100,
 'Vacation and time off'),

(110, 'Team Task Projects', NULL, NULL, 'TEAM_TASK', NULL, NULL, NULL, 'BUCKET_OVERHEAD', 100,
 'Department team tasks'),

(111, 'Internal Projects', NULL, NULL, 'INTERNAL', NULL, NULL, NULL, 'BUCKET_OVERHEAD', 100,
 'Internal improvement projects'),

-- Overhead activity categories (catch-all)
(120, 'All Overhead Activities', NULL, NULL, NULL, NULL, NULL, 'OVERHEAD', 'BUCKET_OVERHEAD', 100,
 'Any overhead category activity'),

-- ══════════════════════════════════════════════════════════════════════════
-- FALLBACK RULES (Lowest Priority - Department Defaults)
-- ══════════════════════════════════════════════════════════════════════════

-- Add your department-specific defaults here
-- Example: Engineering departments default to Direct Product
-- (200, 'Engineering Dept Default', 'DEPT_ACM', NULL, NULL, NULL, NULL, NULL, 'BUCKET_DIRECT_PROD', 100,
--  'Default for ACM department'),

-- (201, 'Central Eng Default', 'DEPT_CENTRAL', NULL, NULL, NULL, NULL, NULL, 'BUCKET_INDIRECT', 100,
--  'Default for Central Engineering'),

-- Global fallback (last resort)
(999, 'Global Fallback - Unclassified', NULL, NULL, NULL, NULL, NULL, NULL, 'BUCKET_UNCLASSIFIED', 100,
 'Final fallback: mark as unclassified for review')

ON CONFLICT (rule_priority) DO UPDATE
SET rule_name = EXCLUDED.rule_name,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP;

-- ----------------------------------------------------------------------------
-- 2. CLASSIFICATION FUNCTION
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION classify_timesheet_entry(
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
    confidence_score DECIMAL
) AS $$
DECLARE
    v_user_dept_id VARCHAR;
    v_user_subteam_id VARCHAR;
    v_project_type_id VARCHAR;
    v_project_category VARCHAR;
    v_activity_category VARCHAR;
    v_matched_rule RECORD;
    v_specificity_score INT;
BEGIN
    -- Step 1: Fetch user context
    SELECT u.department_id, u.sub_team_id
    INTO v_user_dept_id, v_user_subteam_id
    FROM users u
    WHERE u.id = p_user_id;

    -- Step 2: Fetch project context (if project provided)
    IF p_project_id IS NOT NULL THEN
        SELECT p.project_type_id, p.category
        INTO v_project_type_id, v_project_category
        FROM projects p
        WHERE p.id = p_project_id;
    END IF;

    -- Step 3: Fetch activity context
    SELECT ac.category
    INTO v_activity_category
    FROM dim_activity_code ac
    WHERE ac.id = p_activity_code_id;

    -- Step 4: Find matching rule (ordered by priority)
    SELECT ar.id, ar.rule_name, ar.target_cost_bucket_id, cb.bucket_name
    INTO v_matched_rule
    FROM allocation_rules ar
    JOIN dim_cost_bucket cb ON ar.target_cost_bucket_id = cb.id
    WHERE ar.is_active = TRUE
      AND ar.effective_from <= p_work_date
      AND (ar.effective_to IS NULL OR ar.effective_to >= p_work_date)
      -- Match conditions (NULL = wildcard)
      AND (ar.user_department_id IS NULL OR ar.user_department_id = v_user_dept_id)
      AND (ar.user_sub_team_id IS NULL OR ar.user_sub_team_id = v_user_subteam_id)
      AND (ar.project_type_id IS NULL OR ar.project_type_id = v_project_type_id)
      AND (ar.project_category IS NULL OR ar.project_category = v_project_category)
      AND (ar.activity_code_id IS NULL OR ar.activity_code_id = p_activity_code_id)
      AND (ar.activity_category IS NULL OR ar.activity_category = v_activity_category)
    ORDER BY ar.rule_priority ASC
    LIMIT 1;

    -- Step 5: Calculate confidence score based on rule specificity
    IF v_matched_rule.id IS NOT NULL THEN
        SELECT
            CASE WHEN user_department_id IS NOT NULL THEN 15 ELSE 0 END +
            CASE WHEN user_sub_team_id IS NOT NULL THEN 15 ELSE 0 END +
            CASE WHEN project_type_id IS NOT NULL THEN 20 ELSE 0 END +
            CASE WHEN project_category IS NOT NULL THEN 15 ELSE 0 END +
            CASE WHEN activity_code_id IS NOT NULL THEN 20 ELSE 0 END +
            CASE WHEN activity_category IS NOT NULL THEN 15 ELSE 0 END
        INTO v_specificity_score
        FROM allocation_rules
        WHERE id = v_matched_rule.id;

        -- Cap at 95% (never 100% unless manual override)
        v_specificity_score := LEAST(v_specificity_score, 95);
    ELSE
        -- No match found - this should not happen if fallback rule exists
        v_specificity_score := 0;
    END IF;

    -- Step 6: Return result
    RETURN QUERY
    SELECT
        v_matched_rule.target_cost_bucket_id,
        v_matched_rule.bucket_name,
        v_matched_rule.id,
        v_matched_rule.rule_name,
        v_specificity_score::DECIMAL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION classify_timesheet_entry IS 'Context-aware classification function. Returns cost bucket, rule applied, and confidence score.';

-- ----------------------------------------------------------------------------
-- 3. AUTO-CLASSIFICATION TRIGGER (Optional)
-- ----------------------------------------------------------------------------

-- This trigger automatically classifies entries on insert/update
CREATE OR REPLACE FUNCTION auto_classify_timesheet_entry()
RETURNS TRIGGER AS $$
DECLARE
    v_classification RECORD;
BEGIN
    -- Only auto-classify if not manual override
    IF NEW.is_manual_override = FALSE OR NEW.is_manual_override IS NULL THEN
        -- Call classification function
        SELECT * INTO v_classification
        FROM classify_timesheet_entry(
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

-- Create trigger
DROP TRIGGER IF EXISTS trg_auto_classify ON timesheet_entries;
CREATE TRIGGER trg_auto_classify
    BEFORE INSERT OR UPDATE ON timesheet_entries
    FOR EACH ROW
    EXECUTE FUNCTION auto_classify_timesheet_entry();

COMMENT ON FUNCTION auto_classify_timesheet_entry IS 'Trigger function that auto-classifies timesheet entries before insert/update.';

-- ----------------------------------------------------------------------------
-- 4. BATCH RECLASSIFICATION FUNCTION
-- ----------------------------------------------------------------------------

-- Use this to reclassify existing entries after rule changes
CREATE OR REPLACE FUNCTION reclassify_timesheet_entries(
    p_start_date DATE,
    p_end_date DATE DEFAULT CURRENT_DATE,
    p_exclude_manual_override BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
    entries_processed INT,
    entries_changed INT,
    avg_confidence DECIMAL
) AS $$
DECLARE
    v_processed INT := 0;
    v_changed INT := 0;
    v_entry RECORD;
    v_classification RECORD;
BEGIN
    FOR v_entry IN
        SELECT id, user_id, project_id, activity_code_id, work_date, cost_bucket_id
        FROM timesheet_entries
        WHERE work_date BETWEEN p_start_date AND p_end_date
          AND (NOT p_exclude_manual_override OR is_manual_override = FALSE)
    LOOP
        -- Classify entry
        SELECT * INTO v_classification
        FROM classify_timesheet_entry(
            v_entry.user_id,
            v_entry.project_id,
            v_entry.activity_code_id,
            v_entry.work_date
        );

        v_processed := v_processed + 1;

        -- Update if classification changed
        IF v_entry.cost_bucket_id IS DISTINCT FROM v_classification.cost_bucket_id THEN
            UPDATE timesheet_entries
            SET cost_bucket_id = v_classification.cost_bucket_id,
                allocation_rule_id = v_classification.allocation_rule_id,
                confidence_score = v_classification.confidence_score,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = v_entry.id;

            v_changed := v_changed + 1;
        END IF;
    END LOOP;

    RETURN QUERY
    SELECT
        v_processed,
        v_changed,
        ROUND(AVG(te.confidence_score), 2)
    FROM timesheet_entries te
    WHERE te.work_date BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reclassify_timesheet_entries IS 'Batch reclassify entries after rule changes. Returns stats: processed, changed, avg confidence.';

-- ----------------------------------------------------------------------------
-- 5. RULE TESTING QUERY
-- ----------------------------------------------------------------------------

-- Test classification for a sample scenario
-- Usage: Change the values to test different scenarios
DO $$
DECLARE
    v_result RECORD;
BEGIN
    -- Test scenario: ACM Engineer working on NPI with Design activity
    SELECT * INTO v_result
    FROM classify_timesheet_entry(
        p_user_id := (SELECT id FROM users WHERE email = 'aaron.oh@csk.kr' LIMIT 1),
        p_project_id := (SELECT id FROM projects WHERE project_type_id = 'NPI' LIMIT 1),
        p_activity_code_id := 'ACT_DESIGN',
        p_work_date := CURRENT_DATE
    );

    RAISE NOTICE 'Test Classification Result:';
    RAISE NOTICE '  Cost Bucket: % (%)', v_result.cost_bucket_name, v_result.cost_bucket_id;
    RAISE NOTICE '  Rule Applied: % (ID: %)', v_result.rule_name, v_result.allocation_rule_id;
    RAISE NOTICE '  Confidence: %', v_result.confidence_score;
END $$;

-- ----------------------------------------------------------------------------
-- 6. RULE COVERAGE ANALYSIS
-- ----------------------------------------------------------------------------

-- Check which combinations are NOT covered by rules
CREATE OR REPLACE VIEW v_rule_coverage_gaps AS
WITH activity_project_combinations AS (
    SELECT DISTINCT
        te.activity_code_id,
        ac.name AS activity_name,
        p.project_type_id,
        pt.name AS project_type_name,
        p.category AS project_category,
        COUNT(te.id) AS entry_count,
        AVG(te.confidence_score) AS avg_confidence
    FROM timesheet_entries te
    JOIN dim_activity_code ac ON te.activity_code_id = ac.id
    LEFT JOIN projects p ON te.project_id = p.id
    LEFT JOIN project_types pt ON p.project_type_id = pt.id
    WHERE te.work_date >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY te.activity_code_id, ac.name, p.project_type_id, pt.name, p.category
)
SELECT
    activity_name,
    project_type_name,
    project_category,
    entry_count,
    ROUND(avg_confidence, 2) AS avg_confidence,
    CASE
        WHEN avg_confidence < 50 THEN '🔴 Critical - Add specific rule'
        WHEN avg_confidence < 70 THEN '🟡 Warning - Review rules'
        ELSE '🟢 OK'
    END AS status
FROM activity_project_combinations
WHERE avg_confidence < 80
ORDER BY avg_confidence ASC, entry_count DESC;

-- ----------------------------------------------------------------------------
-- 7. RULE USAGE STATISTICS
-- ----------------------------------------------------------------------------

-- See which rules are firing most often
CREATE OR REPLACE VIEW v_rule_usage_stats AS
SELECT
    ar.rule_priority,
    ar.rule_name,
    cb.bucket_name,
    COUNT(te.id) AS times_applied,
    SUM(te.hours_logged) AS total_hours,
    ROUND(AVG(te.confidence_score), 2) AS avg_confidence,
    MIN(te.work_date) AS first_used,
    MAX(te.work_date) AS last_used
FROM allocation_rules ar
LEFT JOIN timesheet_entries te ON ar.id = te.allocation_rule_id
LEFT JOIN dim_cost_bucket cb ON ar.target_cost_bucket_id = cb.id
WHERE ar.is_active = TRUE
GROUP BY ar.id, ar.rule_priority, ar.rule_name, cb.bucket_name
ORDER BY times_applied DESC NULLS LAST;

-- ============================================================================
-- END OF SCRIPT
-- ============================================================================

-- VERIFICATION QUERIES
-- Run these to verify the setup:

-- 1. Check all active rules
-- SELECT * FROM v_active_allocation_rules;

-- 2. Test classification
-- SELECT * FROM classify_timesheet_entry(
--     (SELECT id FROM users LIMIT 1),
--     (SELECT id FROM projects WHERE project_type_id = 'NPI' LIMIT 1),
--     'ACT_DESIGN'
-- );

-- 3. Check rule coverage
-- SELECT * FROM v_rule_coverage_gaps;

-- 4. View rule usage
-- SELECT * FROM v_rule_usage_stats;

-- ============================================================================
-- NEXT STEPS:
-- 1. Review and customize the 30 starter rules for your business
-- 2. Add department-specific fallback rules (priority 200-900)
-- 3. Test with sample timesheet entries
-- 4. Monitor low confidence entries and refine rules
-- 5. Build UI integration using the classification function
-- ============================================================================
