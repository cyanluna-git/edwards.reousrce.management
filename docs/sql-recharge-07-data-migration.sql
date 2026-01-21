-- ============================================================================
-- Recharge & Planning System: Part 7 - Data Migration from Excel
-- ============================================================================
-- Version: 1.0
-- Date: 2026-01-21
-- Database: PostgreSQL 15+
-- Purpose: Import historical planning data from Excel (Wide → Long format)
-- ============================================================================

-- ============================================================================
-- STEP 1: PYTHON SCRIPT FOR EXCEL TRANSFORMATION
-- ============================================================================

/*
Python script to convert Excel wide format to database-ready long format:

```python
import pandas as pd
import sys

def pivot_headcount_excel(input_file, output_file, fiscal_year=2026):
    """
    Convert wide-format headcount Excel to long-format CSV.

    Input format:
    User Name | Project | Jan | Feb | Mar | ... | Dec
    ----------|---------|-----|-----|-----|-----|----
    Aaron Oh  | NPI-001 | 0.5 | 0.5 | 0.3 | ... | 0.0
    Aaron Oh  | SUP-002 | 0.3 | 0.3 | 0.4 | ... | 0.8

    Output format:
    user_name | project_code | plan_year | plan_month | planned_fte
    ----------|--------------|-----------|------------|------------
    Aaron Oh  | NPI-001      | 2026      | 1          | 0.5
    Aaron Oh  | NPI-001      | 2026      | 2          | 0.5
    Aaron Oh  | NPI-001      | 2026      | 3          | 0.3
    """

    # Read Excel
    df = pd.read_csv(input_file)  # or pd.read_excel() if .xlsx

    # Month columns to pivot
    month_cols = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    # Verify columns exist
    missing_cols = [col for col in month_cols if col not in df.columns]
    if missing_cols:
        print(f"Warning: Missing month columns: {missing_cols}")
        month_cols = [col for col in month_cols if col in df.columns]

    # Pivot from wide to long
    df_long = df.melt(
        id_vars=['User Name', 'Project'],
        value_vars=month_cols,
        var_name='Month',
        value_name='Planned_FTE'
    )

    # Convert month names to numbers
    month_map = {
        'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
        'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
    }
    df_long['plan_month'] = df_long['Month'].map(month_map)

    # Add year
    df_long['plan_year'] = fiscal_year

    # Clean up
    df_long = df_long.rename(columns={
        'User Name': 'user_name',
        'Project': 'project_code',
        'Planned_FTE': 'planned_fte'
    })

    # Remove zero/null allocations
    df_long = df_long[df_long['planned_fte'] > 0]

    # Remove rows with missing data
    df_long = df_long.dropna(subset=['user_name', 'project_code', 'planned_fte'])

    # Select and reorder columns
    df_long = df_long[['user_name', 'project_code', 'plan_year', 'plan_month', 'planned_fte']]

    # Sort
    df_long = df_long.sort_values(['user_name', 'project_code', 'plan_year', 'plan_month'])

    # Save
    df_long.to_csv(output_file, index=False)
    print(f"✅ Converted {len(df_long)} records")
    print(f"   Users: {df_long['user_name'].nunique()}")
    print(f"   Projects: {df_long['project_code'].nunique()}")
    print(f"   Output: {output_file}")

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python pivot_headcount.py input.csv output.csv [year]")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2]
    year = int(sys.argv[3]) if len(sys.argv) > 3 else 2026

    pivot_headcount_excel(input_file, output_file, year)
```

Run:
$ python pivot_headcount.py "PCAS Eng._Monthly Headcounts.csv" resource_plans_import.csv 2026
*/

-- ============================================================================
-- STEP 2: CREATE TEMPORARY IMPORT TABLE
-- ============================================================================

CREATE TEMP TABLE IF NOT EXISTS temp_resource_plans_import (
    user_name VARCHAR(200),
    project_code VARCHAR(100),
    plan_year INT,
    plan_month INT,
    planned_fte DECIMAL(5,2),
    -- Import metadata
    import_batch_id VARCHAR(36) DEFAULT gen_random_uuid()::text,
    import_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- STEP 3: LOAD CSV DATA
-- ============================================================================

/*
-- Option A: COPY from file (requires superuser or COPY privilege)
COPY temp_resource_plans_import (user_name, project_code, plan_year, plan_month, planned_fte)
FROM '/path/to/resource_plans_import.csv'
CSV HEADER;

-- Option B: Use psql \copy (works without superuser)
-- Run in terminal:
$ psql -h localhost -p 5434 -U postgres -d edwards -c "\copy temp_resource_plans_import (user_name, project_code, plan_year, plan_month, planned_fte) FROM 'resource_plans_import.csv' CSV HEADER"
*/

-- ============================================================================
-- STEP 4: DATA VALIDATION & MATCHING
-- ============================================================================

-- Create validation report table
CREATE TEMP TABLE temp_import_validation (
    user_name VARCHAR(200),
    project_code VARCHAR(100),
    issue_type VARCHAR(50),
    issue_description TEXT,
    record_count INT
);

-- Check 1: Users not found in database
INSERT INTO temp_import_validation (user_name, issue_type, issue_description, record_count)
SELECT
    t.user_name,
    'USER_NOT_FOUND',
    'User name does not match any user in database',
    COUNT(*)
FROM temp_resource_plans_import t
LEFT JOIN users u ON (u.name = t.user_name OR u.korean_name = t.user_name)
WHERE u.id IS NULL
GROUP BY t.user_name;

-- Check 2: Projects not found in database
INSERT INTO temp_import_validation (project_code, issue_type, issue_description, record_count)
SELECT
    t.project_code,
    'PROJECT_NOT_FOUND',
    'Project code does not match any project in database',
    COUNT(*)
FROM temp_resource_plans_import t
LEFT JOIN projects p ON p.code = t.project_code
WHERE p.id IS NULL
GROUP BY t.project_code;

-- Check 3: FTE over-allocation (sum > 1.0 per user per month)
INSERT INTO temp_import_validation (user_name, issue_type, issue_description, record_count)
SELECT
    t.user_name,
    'FTE_OVERALLOCATION',
    format('Total FTE in %s-%s: %.2f (exceeds 1.0)',
           t.plan_year, t.plan_month, SUM(t.planned_fte)),
    1
FROM temp_resource_plans_import t
GROUP BY t.user_name, t.plan_year, t.plan_month
HAVING SUM(t.planned_fte) > 1.0;

-- View validation issues
SELECT
    issue_type,
    COUNT(*) AS issue_count,
    SUM(record_count) AS affected_records
FROM temp_import_validation
GROUP BY issue_type
ORDER BY issue_count DESC;

-- Detailed validation report
SELECT *
FROM temp_import_validation
ORDER BY issue_type, user_name, project_code;

-- ============================================================================
-- STEP 5: NAME MATCHING HELPER (For Fuzzy Matching)
-- ============================================================================

-- Try to auto-match users by partial name
CREATE TEMP TABLE temp_user_mapping AS
SELECT DISTINCT
    t.user_name AS import_name,
    u.id AS user_id,
    u.name AS db_name,
    u.korean_name AS db_korean_name,
    CASE
        WHEN u.name = t.user_name THEN 100
        WHEN u.korean_name = t.user_name THEN 100
        WHEN u.name ILIKE '%' || t.user_name || '%' THEN 80
        WHEN u.korean_name ILIKE '%' || t.user_name || '%' THEN 80
        WHEN t.user_name ILIKE '%' || u.name || '%' THEN 70
        ELSE 50
    END AS match_confidence
FROM temp_resource_plans_import t
CROSS JOIN users u
WHERE u.name ILIKE '%' || t.user_name || '%'
   OR u.korean_name ILIKE '%' || t.user_name || '%'
   OR t.user_name ILIKE '%' || u.name || '%'
ORDER BY t.user_name, match_confidence DESC;

-- View suggested matches
SELECT
    import_name,
    user_id,
    db_name,
    db_korean_name,
    match_confidence
FROM temp_user_mapping
WHERE match_confidence >= 70
ORDER BY import_name, match_confidence DESC;

-- ============================================================================
-- STEP 6: INSERT VALIDATED DATA INTO RESOURCE_PLANS
-- ============================================================================

-- Get or create scenario
INSERT INTO planning_scenarios (id, scenario_name, scenario_type, fiscal_year, description)
SELECT
    'SCENARIO_2026_IMPORTED',
    '2026 Imported from Excel',
    'BASELINE',
    2026,
    'Imported from PCAS Eng._Monthly Headcounts Excel on ' || CURRENT_TIMESTAMP::TEXT
WHERE NOT EXISTS (SELECT 1 FROM planning_scenarios WHERE id = 'SCENARIO_2026_IMPORTED')
ON CONFLICT (fiscal_year, scenario_name) DO NOTHING;

-- Insert resource plans (only for valid matches)
INSERT INTO resource_plans (
    id,
    user_id,
    project_id,
    activity_code_id,
    plan_year,
    plan_month,
    planned_fte,
    planned_hours,
    scenario_id,
    plan_status,
    notes,
    created_by
)
SELECT
    gen_random_uuid()::text,
    u.id AS user_id,
    p.id AS project_id,
    'ACT_DESIGN' AS activity_code_id,  -- Default activity (can be updated later)
    t.plan_year,
    t.plan_month,
    t.planned_fte,
    t.planned_fte * 160 AS planned_hours,  -- Assume 160h/month
    'SCENARIO_2026_IMPORTED' AS scenario_id,
    'APPROVED' AS plan_status,
    'Imported from Excel: ' || t.import_timestamp::TEXT AS notes,
    (SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1) AS created_by
FROM temp_resource_plans_import t
INNER JOIN users u ON (u.name = t.user_name OR u.korean_name = t.user_name)
INNER JOIN projects p ON p.code = t.project_code
WHERE t.planned_fte > 0
ON CONFLICT (user_id, project_id, activity_code_id, plan_year, plan_month, scenario_id, plan_version)
DO UPDATE
SET planned_fte = EXCLUDED.planned_fte,
    planned_hours = EXCLUDED.planned_hours,
    updated_at = CURRENT_TIMESTAMP;

-- ============================================================================
-- STEP 7: POST-IMPORT SUMMARY
-- ============================================================================

DO $$
DECLARE
    v_total_import INT;
    v_successful_import INT;
    v_failed_import INT;
    v_validation_issues INT;
BEGIN
    SELECT COUNT(*) INTO v_total_import FROM temp_resource_plans_import;
    SELECT COUNT(*) INTO v_successful_import FROM resource_plans WHERE scenario_id = 'SCENARIO_2026_IMPORTED';
    SELECT COUNT(*) INTO v_validation_issues FROM temp_import_validation;

    v_failed_import := v_total_import - v_successful_import;

    RAISE NOTICE '========================================';
    RAISE NOTICE 'DATA MIGRATION SUMMARY';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Total records in import file: %', v_total_import;
    RAISE NOTICE '✅ Successfully imported: % (%.1f%%)',
        v_successful_import,
        CASE WHEN v_total_import > 0 THEN (v_successful_import::DECIMAL / v_total_import * 100) ELSE 0 END;
    RAISE NOTICE '❌ Failed to import: %', v_failed_import;
    RAISE NOTICE '⚠️  Validation issues: %', v_validation_issues;
    RAISE NOTICE '========================================';

    IF v_validation_issues > 0 THEN
        RAISE NOTICE '';
        RAISE NOTICE 'Review validation issues:';
        RAISE NOTICE '  SELECT * FROM temp_import_validation;';
    END IF;

    IF v_successful_import > 0 THEN
        RAISE NOTICE '';
        RAISE NOTICE 'Imported data can be viewed:';
        RAISE NOTICE '  SELECT * FROM resource_plans WHERE scenario_id = ''SCENARIO_2026_IMPORTED'';';
    END IF;
END $$;

-- View import statistics by user
SELECT
    u.name AS user_name,
    d.department_name,
    COUNT(*) AS plan_entries,
    COUNT(DISTINCT rp.project_id) AS project_count,
    ROUND(AVG(rp.planned_fte), 2) AS avg_fte_per_entry,
    ROUND(SUM(rp.planned_fte), 1) AS total_fte
FROM resource_plans rp
JOIN users u ON rp.user_id = u.id
JOIN departments d ON u.department_id = d.id
WHERE rp.scenario_id = 'SCENARIO_2026_IMPORTED'
GROUP BY u.name, d.department_name
ORDER BY total_fte DESC;

-- View import statistics by project
SELECT
    p.code AS project_code,
    p.name AS project_name,
    COUNT(DISTINCT rp.user_id) AS contributor_count,
    ROUND(SUM(rp.planned_fte), 1) AS total_allocated_fte,
    COUNT(*) AS allocation_entries
FROM resource_plans rp
JOIN projects p ON rp.project_id = p.id
WHERE rp.scenario_id = 'SCENARIO_2026_IMPORTED'
GROUP BY p.code, p.name
ORDER BY total_allocated_fte DESC;

-- ============================================================================
-- STEP 8: ACTIVITY CODE ASSIGNMENT (Post-Import Cleanup)
-- ============================================================================

-- Update activity codes based on project type (better than default 'DESIGN')
UPDATE resource_plans rp
SET activity_code_id = CASE
    WHEN p.project_type_id IN ('NPI', 'ETO') THEN 'ACT_DESIGN'
    WHEN p.project_type_id = 'SUPPORT' THEN 'ACT_FIELD'
    WHEN p.project_type_id = 'SUSTAINING' THEN 'ACT_SUSTAIN'
    WHEN p.project_type_id = 'TEAM_TASK' THEN 'ACT_ADMIN'
    ELSE 'ACT_DESIGN'  -- Default fallback
END
FROM projects p
WHERE rp.project_id = p.id
  AND rp.scenario_id = 'SCENARIO_2026_IMPORTED'
  AND rp.activity_code_id = 'ACT_DESIGN';  -- Only update defaults

-- ============================================================================
-- STEP 9: CLEANUP TEMPORARY TABLES (Optional)
-- ============================================================================

/*
-- Keep temp tables for review, or drop them:
DROP TABLE IF EXISTS temp_resource_plans_import;
DROP TABLE IF EXISTS temp_import_validation;
DROP TABLE IF EXISTS temp_user_mapping;
*/

-- ============================================================================
-- END OF SCRIPT
-- ============================================================================

RAISE NOTICE '';
RAISE NOTICE '✅ Data migration script complete!';
RAISE NOTICE '';
RAISE NOTICE 'Next steps:';
RAISE NOTICE '1. Review validation issues (if any)';
RAISE NOTICE '2. Manually fix unmatched users/projects';
RAISE NOTICE '3. Update activity codes if needed';
RAISE NOTICE '4. Run: SELECT * FROM v_plan_vs_actual WHERE scenario_name = ''2026 Imported from Excel'';';
RAISE NOTICE '';

-- ============================================================================
-- BONUS: MIGRATION VALIDATION QUERIES
-- ============================================================================

-- Check for FTE over-allocation after import
SELECT
    u.name,
    rp.plan_year,
    rp.plan_month,
    SUM(rp.planned_fte) AS total_fte,
    CASE
        WHEN SUM(rp.planned_fte) > 1.0 THEN '🔴 Over-allocated'
        ELSE '🟢 OK'
    END AS status
FROM resource_plans rp
JOIN users u ON rp.user_id = u.id
WHERE rp.scenario_id = 'SCENARIO_2026_IMPORTED'
GROUP BY u.name, rp.plan_year, rp.plan_month
HAVING SUM(rp.planned_fte) > 1.0
ORDER BY total_fte DESC;

-- ============================================================================
-- END OF MIGRATION SCRIPT
-- ============================================================================
