# Recharge & Planning System Implementation Plan

**Version**: 1.0
**Date**: 2026-01-21
**Status**: Planning Phase - Awaiting Validation

---

## Executive Summary

This plan extends the Context-Aware Timesheet System to support:
1. **Inter-company Recharge**: Track CAPEX/OPEX for different funding entities (VSS, SUN, LOCAL_KR)
2. **Resource Planning**: Replace Excel-based FTE planning with database-driven allocation
3. **Plan vs. Actual**: Enable comparison between planned and actual resource utilization
4. **IO Framework Integration**: Auto-classify projects based on IO naming conventions

---

## Problem Statement

### Current Pain Points

1. **Complex Excel Management**:
   - `PCAS Eng._Monthly Headcounts` contains manual FTE allocations
   - Wide format (columns: Jan, Feb, Mar...) is hard to query
   - No version control or audit trail

2. **Recharge Complexity**:
   - Not all CAPEX is NPI
   - Projects like Sustaining, CIP, Support can be CAPEX if Division-specific
   - Need to track "who pays the bill" (VSS vs SUN vs Local)

3. **Planning vs. Actuals Gap**:
   - Planning happens in Excel
   - Actuals logged in timesheet system
   - No easy way to compare or track variance

---

## Solution Architecture

### 1. Enhanced Project Master (Financial Routing)

#### New Columns in `projects` Table

```sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS
    funding_entity_id VARCHAR(50),          -- Who owns the budget (VSS, SUN, LOCAL_KR)
    recharge_status VARCHAR(20),            -- BILLABLE, NON_BILLABLE, INTERNAL
    io_category_code VARCHAR(100),          -- Maps to "Programme" (Field Failure, Operations Support)
    is_capitalizable BOOLEAN DEFAULT FALSE, -- CAPEX vs OPEX flag
    gl_account_code VARCHAR(50);            -- General Ledger account for ERP integration
```

#### Funding Entity Dimension

```sql
CREATE TABLE dim_funding_entity (
    id VARCHAR(50) PRIMARY KEY,
    entity_code VARCHAR(20) UNIQUE NOT NULL,  -- VSS, SUN, LOCAL_KR
    entity_name VARCHAR(100) NOT NULL,
    legal_entity VARCHAR(100),                -- Full legal name
    country_code VARCHAR(3),                  -- ISO country code
    currency_code VARCHAR(3),                 -- USD, EUR, KRW
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert standard funding entities
INSERT INTO dim_funding_entity (id, entity_code, entity_name, legal_entity, country_code, currency_code) VALUES
('ENTITY_VSS', 'VSS', 'VSS Division', 'VSS Legal Entity Name', 'USA', 'USD'),
('ENTITY_SUN', 'SUN', 'SUN Division', 'SUN Legal Entity Name', 'USA', 'USD'),
('ENTITY_LOCAL_KR', 'LOCAL_KR', 'Local Korea', 'Edwards Korea Legal Name', 'KOR', 'KRW'),
('ENTITY_SHARED', 'SHARED', 'Shared Services', 'Shared Services Entity', 'USA', 'USD');
```

#### IO Category Dimension

```sql
CREATE TABLE dim_io_category (
    id VARCHAR(50) PRIMARY KEY,
    category_code VARCHAR(50) UNIQUE NOT NULL,
    category_name VARCHAR(200) NOT NULL,
    parent_category_id VARCHAR(50),           -- For hierarchy
    is_billable BOOLEAN DEFAULT FALSE,
    default_funding_entity_id VARCHAR(50) REFERENCES dim_funding_entity(id),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (parent_category_id) REFERENCES dim_io_category(id)
);

-- Sample data (to be populated from IO Framework CSV)
INSERT INTO dim_io_category (id, category_code, category_name, is_billable, default_funding_entity_id) VALUES
('IO_CAT_FIELD_FAILURE', 'FIELD_FAILURE', 'Field Failure Escalation', TRUE, 'ENTITY_VSS'),
('IO_CAT_OPS_SUPPORT', 'OPS_SUPPORT', 'Operations Support', TRUE, 'ENTITY_VSS'),
('IO_CAT_NPI', 'NPI', 'New Product Introduction', FALSE, 'ENTITY_LOCAL_KR'),
('IO_CAT_SUSTAINING', 'SUSTAINING', 'Sustaining Engineering', TRUE, 'ENTITY_VSS'),
('IO_CAT_CIP', 'CIP', 'Continuous Improvement Project', TRUE, NULL);
```

#### Auto-Classification Logic (Based on IO Framework)

```sql
-- Function to auto-tag projects based on IO naming convention
CREATE OR REPLACE FUNCTION auto_classify_project_funding(p_project_code VARCHAR, p_project_name VARCHAR)
RETURNS TABLE (
    funding_entity_id VARCHAR,
    recharge_status VARCHAR,
    io_category_code VARCHAR
) AS $$
BEGIN
    -- Rule 1: If code contains 'VSS', assign to VSS entity
    IF p_project_code LIKE '%VSS%' OR p_project_name LIKE '%VSS%' THEN
        RETURN QUERY SELECT 'ENTITY_VSS'::VARCHAR, 'BILLABLE'::VARCHAR, NULL::VARCHAR;

    -- Rule 2: If code contains 'SUN', assign to SUN entity
    ELSIF p_project_code LIKE '%SUN%' OR p_project_name LIKE '%SUN%' THEN
        RETURN QUERY SELECT 'ENTITY_SUN'::VARCHAR, 'BILLABLE'::VARCHAR, NULL::VARCHAR;

    -- Rule 3: If project_type = 'NPI', local Korea funding
    ELSIF EXISTS (SELECT 1 FROM projects WHERE code = p_project_code AND project_type_id = 'NPI') THEN
        RETURN QUERY SELECT 'ENTITY_LOCAL_KR'::VARCHAR, 'NON_BILLABLE'::VARCHAR, 'NPI'::VARCHAR;

    -- Rule 4: Support projects - check if division-specific
    ELSIF EXISTS (SELECT 1 FROM projects WHERE code = p_project_code AND project_type_id = 'SUPPORT') THEN
        -- If has owner_department, might be billable
        RETURN QUERY SELECT 'ENTITY_VSS'::VARCHAR, 'BILLABLE'::VARCHAR, 'SUPPORT'::VARCHAR;

    -- Default: Shared/Local funding
    ELSE
        RETURN QUERY SELECT 'ENTITY_LOCAL_KR'::VARCHAR, 'INTERNAL'::VARCHAR, NULL::VARCHAR;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Batch update existing projects
UPDATE projects p
SET (funding_entity_id, recharge_status, io_category_code) = (
    SELECT * FROM auto_classify_project_funding(p.code, p.name)
)
WHERE funding_entity_id IS NULL;
```

---

### 2. Resource Plan Entity (Planning Table)

#### Core Table: `resource_plans`

```sql
CREATE TABLE resource_plans (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,

    -- WHO (Resource)
    user_id VARCHAR(36) REFERENCES users(id),
    position_id VARCHAR(50) REFERENCES job_positions(id),  -- For future hires

    -- WHERE (Project/Activity)
    project_id VARCHAR(36) REFERENCES projects(id),
    activity_code_id VARCHAR(20) REFERENCES dim_activity_code(id),

    -- WHEN (Time Period)
    plan_year INT NOT NULL,
    plan_month INT NOT NULL CHECK (plan_month BETWEEN 1 AND 12),
    plan_week INT,  -- Optional: for weekly granularity

    -- WHAT (Allocation)
    planned_fte DECIMAL(5,2) NOT NULL CHECK (planned_fte >= 0 AND planned_fte <= 1),  -- 0.1, 0.5, 1.0
    planned_hours DECIMAL(7,2),  -- Alternative: direct hours (e.g., 40h)

    -- CLASSIFICATION (Mirrors timesheet classification)
    cost_bucket_id VARCHAR(50) REFERENCES dim_cost_bucket(id),
    allocation_rule_id INT REFERENCES allocation_rules(id),
    confidence_score DECIMAL(5,2),

    -- METADATA
    plan_version VARCHAR(20) DEFAULT 'v1',  -- For versioning plans
    plan_status VARCHAR(20) DEFAULT 'DRAFT' CHECK (plan_status IN ('DRAFT', 'APPROVED', 'LOCKED', 'ARCHIVED')),
    notes TEXT,

    created_by VARCHAR(36) REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Ensure no duplicate allocations per user/project/month
    UNIQUE(user_id, project_id, activity_code_id, plan_year, plan_month, plan_version)
);

-- Indexes for fast queries
CREATE INDEX idx_rp_user_month ON resource_plans(user_id, plan_year, plan_month);
CREATE INDEX idx_rp_project_month ON resource_plans(project_id, plan_year, plan_month);
CREATE INDEX idx_rp_cost_bucket ON resource_plans(cost_bucket_id);
CREATE INDEX idx_rp_status ON resource_plans(plan_status);
```

#### Planning Scenarios (For What-If Analysis)

```sql
CREATE TABLE planning_scenarios (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    scenario_name VARCHAR(200) NOT NULL,
    scenario_type VARCHAR(20) DEFAULT 'BASELINE' CHECK (scenario_type IN ('BASELINE', 'OPTIMISTIC', 'CONSERVATIVE', 'CUSTOM')),
    fiscal_year INT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(36) REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Link resource plans to scenarios
ALTER TABLE resource_plans ADD COLUMN scenario_id VARCHAR(36) REFERENCES planning_scenarios(id);
CREATE INDEX idx_rp_scenario ON resource_plans(scenario_id);
```

---

### 3. Recharge Rule Algorithm

#### Enhanced Classification Function

```sql
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
    funding_entity_id VARCHAR
) AS $$
DECLARE
    v_user_entity_id VARCHAR;
    v_project_entity_id VARCHAR;
    v_project_recharge_status VARCHAR;
    v_base_classification RECORD;
BEGIN
    -- Step 1: Get user's entity (from department or direct assignment)
    SELECT d.funding_entity_id INTO v_user_entity_id
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE u.id = p_user_id;

    -- Step 2: Get project's funding entity
    SELECT p.funding_entity_id, p.recharge_status
    INTO v_project_entity_id, v_project_recharge_status
    FROM projects p
    WHERE p.id = p_project_id;

    -- Step 3: Get base classification (from existing function)
    SELECT * INTO v_base_classification
    FROM classify_timesheet_entry(p_user_id, p_project_id, p_activity_code_id, p_work_date);

    -- Step 4: Apply recharge logic
    -- Rule: If project is BILLABLE and user's entity != project's entity → Rechargeable
    IF v_project_recharge_status = 'BILLABLE'
       AND v_user_entity_id IS DISTINCT FROM v_project_entity_id
       AND v_project_entity_id IS NOT NULL THEN

        -- Override classification: This is Direct Project Cost (Recharge CAPEX)
        RETURN QUERY SELECT
            'BUCKET_DIRECT_PROJ'::VARCHAR,
            'Direct Project Work (Recharge)'::VARCHAR,
            v_base_classification.allocation_rule_id,
            'Recharge: ' || v_base_classification.rule_name,
            v_base_classification.confidence_score,
            TRUE,  -- is_rechargeable
            v_project_entity_id;

    -- Rule: If project is INTERNAL or same entity → Not rechargeable
    ELSE
        RETURN QUERY SELECT
            v_base_classification.cost_bucket_id,
            v_base_classification.cost_bucket_name,
            v_base_classification.allocation_rule_id,
            v_base_classification.rule_name,
            v_base_classification.confidence_score,
            FALSE,  -- is_rechargeable
            v_user_entity_id;  -- Stays in user's entity
    END IF;
END;
$$ LANGUAGE plpgsql;
```

#### Recharge Decision Matrix

```
┌─────────────────────────────────────────────────────────────────────┐
│  RECHARGE CLASSIFICATION LOGIC                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Scenario 1: Division-Specific Support (Rechargeable CAPEX)        │
│  ─────────────────────────────────────────────────────────────────  │
│  IF:                                                                │
│    - Project.recharge_status = 'BILLABLE'                           │
│    - Project.funding_entity = 'VSS'                                 │
│    - User.entity = 'LOCAL_KR'                                       │
│    - Activity = FIELD_SUPPORT or SUSTAINING                         │
│  THEN:                                                              │
│    → Cost Bucket: DIRECT_PROJECT (Recharge)                         │
│    → Capitalizable: TRUE                                            │
│    → Bill To: VSS                                                   │
│                                                                     │
│  Scenario 2: Generic Support (Overhead)                            │
│  ─────────────────────────────────────────────────────────────────  │
│  IF:                                                                │
│    - Project.recharge_status = 'INTERNAL'                           │
│    - OR Project.funding_entity = User.entity                        │
│  THEN:                                                              │
│    → Cost Bucket: INDIRECT or OVERHEAD                              │
│    → Capitalizable: FALSE                                           │
│    → Bill To: User's entity (LOCAL_KR)                              │
│                                                                     │
│  Scenario 3: NPI (Local CAPEX)                                     │
│  ─────────────────────────────────────────────────────────────────  │
│  IF:                                                                │
│    - Project.type = 'NPI'                                           │
│    - Project.funding_entity = 'LOCAL_KR'                            │
│  THEN:                                                              │
│    → Cost Bucket: DIRECT_PRODUCT                                    │
│    → Capitalizable: TRUE                                            │
│    → Bill To: LOCAL_KR                                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 4. Data Migration Strategy (Excel → Database)

#### Excel Structure (Current State)

```
PCAS Eng._Monthly Headcounts:

User Name | Project | Jan | Feb | Mar | Apr | ... | Dec
----------|---------|-----|-----|-----|-----|-----|----
Aaron Oh  | NPI-001 | 0.5 | 0.5 | 0.3 | 0.2 | ... | 0.0
Aaron Oh  | SUP-002 | 0.3 | 0.3 | 0.4 | 0.5 | ... | 0.8
Dana Lee  | NPI-001 | 1.0 | 1.0 | 1.0 | 1.0 | ... | 1.0
...
```

**Problem**: Wide format (12 columns for months) - hard to query and aggregate.

#### Database Structure (Target State)

```
resource_plans (Long Format):

user_id                  | project_id | plan_year | plan_month | planned_fte
-------------------------|------------|-----------|------------|------------
aaron.oh@csk.kr          | proj-npi-1 | 2026      | 1          | 0.5
aaron.oh@csk.kr          | proj-npi-1 | 2026      | 2          | 0.5
aaron.oh@csk.kr          | proj-npi-1 | 2026      | 3          | 0.3
aaron.oh@csk.kr          | proj-sup-2 | 2026      | 1          | 0.3
dana.lee@csk.kr          | proj-npi-1 | 2026      | 1          | 1.0
...
```

**Benefit**: Each row = one allocation. Easy to SUM, GROUP BY, JOIN with actuals.

#### Migration Steps

**Step 1: Data Extraction (Python/Pandas)**

```python
import pandas as pd

# Read Excel
df = pd.read_csv('PCAS Eng._Monthly Headcounts.csv')

# Pivot from wide to long
df_long = df.melt(
    id_vars=['User Name', 'Project'],
    value_vars=['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    var_name='Month',
    value_name='Planned_FTE'
)

# Convert month names to numbers
month_map = {
    'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
    'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
}
df_long['plan_month'] = df_long['Month'].map(month_map)

# Add year (from filename or metadata)
df_long['plan_year'] = 2026

# Filter out zero/null allocations
df_long = df_long[df_long['Planned_FTE'] > 0]

# Output
df_long.to_csv('resource_plans_import.csv', index=False)
```

**Step 2: User/Project Matching**

```sql
-- Create temp table for import
CREATE TEMP TABLE temp_resource_plans_import (
    user_name VARCHAR(100),
    project_code VARCHAR(50),
    plan_year INT,
    plan_month INT,
    planned_fte DECIMAL(5,2)
);

-- Copy CSV data
COPY temp_resource_plans_import FROM '/path/to/resource_plans_import.csv' CSV HEADER;

-- Insert into resource_plans with ID lookups
INSERT INTO resource_plans (
    id,
    user_id,
    project_id,
    activity_code_id,
    plan_year,
    plan_month,
    planned_fte,
    plan_status,
    created_by
)
SELECT
    gen_random_uuid()::text,
    u.id AS user_id,
    p.id AS project_id,
    'ACT_DESIGN' AS activity_code_id,  -- Default activity
    t.plan_year,
    t.plan_month,
    t.planned_fte,
    'APPROVED' AS plan_status,
    (SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1) AS created_by
FROM temp_resource_plans_import t
LEFT JOIN users u ON u.name = t.user_name OR u.korean_name = t.user_name
LEFT JOIN projects p ON p.code = t.project_code
WHERE u.id IS NOT NULL AND p.id IS NOT NULL;

-- Report unmatched records
SELECT
    t.user_name,
    t.project_code,
    CASE
        WHEN u.id IS NULL THEN 'User not found'
        WHEN p.id IS NULL THEN 'Project not found'
    END AS issue
FROM temp_resource_plans_import t
LEFT JOIN users u ON u.name = t.user_name
LEFT JOIN projects p ON p.code = t.project_code
WHERE u.id IS NULL OR p.id IS NULL;
```

**Step 3: Activity Code Assignment**

Since Excel doesn't specify activities, we need a heuristic:

```sql
-- Update activity codes based on project type
UPDATE resource_plans rp
SET activity_code_id = CASE
    WHEN p.project_type_id IN ('NPI', 'ETO') THEN 'ACT_DESIGN'
    WHEN p.project_type_id = 'SUPPORT' THEN 'ACT_FIELD'
    WHEN p.project_type_id = 'SUSTAINING' THEN 'ACT_SUSTAIN'
    ELSE 'ACT_DESIGN'  -- Default
END
FROM projects p
WHERE rp.project_id = p.id
  AND rp.activity_code_id IS NULL;
```

**Step 4: Auto-Classify Resource Plans**

```sql
-- Apply classification to all resource plans
UPDATE resource_plans rp
SET (cost_bucket_id, allocation_rule_id, confidence_score) = (
    SELECT
        cost_bucket_id,
        allocation_rule_id,
        confidence_score
    FROM classify_timesheet_entry(
        rp.user_id,
        rp.project_id,
        rp.activity_code_id,
        DATE(rp.plan_year || '-' || rp.plan_month || '-01')
    )
)
WHERE rp.cost_bucket_id IS NULL;
```

---

## 5. Plan vs. Actual Reporting

### Key Metrics View

```sql
CREATE OR REPLACE VIEW v_plan_vs_actual AS
SELECT
    p.id AS project_id,
    p.code AS project_code,
    p.name AS project_name,
    u.id AS user_id,
    u.name AS user_name,
    d.department_name,

    -- Time period
    rp.plan_year,
    rp.plan_month,

    -- Planned
    SUM(rp.planned_fte) AS planned_fte,
    SUM(rp.planned_hours) AS planned_hours,

    -- Actual
    SUM(te.hours_logged) AS actual_hours,
    COUNT(DISTINCT te.work_date) AS days_worked,

    -- Variance
    SUM(rp.planned_hours) - SUM(te.hours_logged) AS variance_hours,
    CASE
        WHEN SUM(rp.planned_hours) > 0
        THEN ROUND((SUM(te.hours_logged) / SUM(rp.planned_hours) * 100), 1)
        ELSE 0
    END AS utilization_pct,

    -- Cost allocation
    cb.bucket_name AS cost_bucket,
    fe.entity_name AS funding_entity

FROM resource_plans rp
LEFT JOIN timesheet_entries te ON
    te.user_id = rp.user_id
    AND te.project_id = rp.project_id
    AND EXTRACT(YEAR FROM te.work_date) = rp.plan_year
    AND EXTRACT(MONTH FROM te.work_date) = rp.plan_month
JOIN users u ON rp.user_id = u.id
JOIN departments d ON u.department_id = d.id
JOIN projects p ON rp.project_id = p.id
LEFT JOIN dim_cost_bucket cb ON rp.cost_bucket_id = cb.id
LEFT JOIN dim_funding_entity fe ON p.funding_entity_id = fe.id

GROUP BY
    p.id, p.code, p.name, u.id, u.name, d.department_name,
    rp.plan_year, rp.plan_month, cb.bucket_name, fe.entity_name
ORDER BY
    rp.plan_year DESC, rp.plan_month DESC, p.code, u.name;
```

### Sample Queries

**Query 1: Department Utilization**

```sql
SELECT
    department_name,
    plan_year,
    plan_month,
    SUM(planned_hours) AS total_planned,
    SUM(actual_hours) AS total_actual,
    ROUND(AVG(utilization_pct), 1) AS avg_utilization
FROM v_plan_vs_actual
WHERE plan_year = 2026 AND plan_month = 1
GROUP BY department_name, plan_year, plan_month
ORDER BY department_name;
```

**Query 2: Project Delivery Tracking**

```sql
SELECT
    project_code,
    project_name,
    funding_entity,
    SUM(planned_fte) AS total_planned_fte,
    COUNT(DISTINCT user_id) AS actual_contributors,
    SUM(actual_hours) AS total_actual_hours,
    CASE
        WHEN SUM(actual_hours) < SUM(planned_hours) * 0.8 THEN '🔴 Under-resourced'
        WHEN SUM(actual_hours) > SUM(planned_hours) * 1.2 THEN '🟡 Over-allocated'
        ELSE '🟢 On track'
    END AS status
FROM v_plan_vs_actual
WHERE plan_year = 2026 AND plan_month BETWEEN 1 AND 3
GROUP BY project_code, project_name, funding_entity
ORDER BY project_code;
```

**Query 3: Recharge Report (Inter-company Billing)**

```sql
SELECT
    fe.entity_name AS billing_entity,
    d.department_name AS providing_department,
    SUM(te.hours_logged) AS billable_hours,
    jp.std_hourly_rate AS rate,
    SUM(te.hours_logged) * jp.std_hourly_rate AS total_amount,
    DATE_TRUNC('month', te.work_date) AS billing_month
FROM timesheet_entries te
JOIN users u ON te.user_id = u.id
JOIN departments d ON u.department_id = d.id
JOIN job_positions jp ON u.position_id = jp.id
JOIN projects p ON te.project_id = p.id
JOIN dim_funding_entity fe ON p.funding_entity_id = fe.id
WHERE p.recharge_status = 'BILLABLE'
  AND te.work_date >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY fe.entity_name, d.department_name, jp.std_hourly_rate, DATE_TRUNC('month', te.work_date)
ORDER BY fe.entity_name, d.department_name;
```

---

## 6. Implementation Steps

### Phase 1: Database Schema (Week 1)
1. ✅ Create `dim_funding_entity` table
2. ✅ Create `dim_io_category` table
3. ✅ Add columns to `projects` table
4. ✅ Create `resource_plans` table
5. ✅ Create `planning_scenarios` table
6. ✅ Add indexes and constraints

### Phase 2: Classification Logic (Week 2)
1. ✅ Implement `auto_classify_project_funding()` function
2. ✅ Enhance `classify_with_recharge()` function
3. ✅ Update allocation rules for recharge scenarios
4. ✅ Test classification with sample data

### Phase 3: Data Migration (Week 3)
1. ✅ Write Python script for Excel pivot (wide → long)
2. ✅ Create data validation scripts
3. ✅ Import historical planning data
4. ✅ Verify data quality (completeness, accuracy)

### Phase 4: Reporting & API (Week 4)
1. ✅ Create `v_plan_vs_actual` view
2. ✅ Build recharge report queries
3. ✅ Create REST API endpoints:
   - `POST /api/resource-plans` - Create plan
   - `GET /api/resource-plans/user/{userId}` - Get user's allocations
   - `GET /api/reports/plan-vs-actual` - Variance report
   - `GET /api/reports/recharge` - Inter-company billing

### Phase 5: UI Integration (Week 5-6)
1. ✅ Resource planning interface (matrix view)
2. ✅ Plan vs. Actual dashboard
3. ✅ Recharge report UI
4. ✅ Drag-and-drop FTE allocation

---

## 7. Assumptions & Constraints

### Assumptions
1. IO Framework CSV contains columns: `IO Number`, `Programme`, `Entity`
2. Headcount Excel uses month names as column headers (Jan, Feb, ...)
3. User names in Excel match database `users.name` or `users.korean_name`
4. Project codes in Excel match database `projects.code`
5. One planning version is active at a time (no multi-version comparison yet)

### Constraints
1. FTE allocation must sum to ≤ 1.0 per user per month (validation rule)
2. Resource plans cannot overlap (unique constraint on user/project/month)
3. Recharge logic requires projects to have `funding_entity_id` populated
4. Historical data migration assumes 2026 fiscal year

### Risks
1. **Data Quality**: Excel might have inconsistent naming (manual cleanup needed)
2. **Rule Complexity**: Recharge rules may need fine-tuning after pilot
3. **Performance**: Large planning datasets (10k+ rows) need index optimization
4. **Change Management**: Users accustomed to Excel may resist new system

---

## 8. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Planning accuracy | ±15% variance | Compare planned vs actual monthly |
| Data migration completeness | >95% | Matched records / Total records |
| Recharge auto-classification | >90% | Correctly classified entries |
| User adoption | >80% | % of planners using DB vs Excel |
| Report generation time | <10 sec | Time to generate Plan vs Actual |

---

## 9. Next Steps

1. **Validate this plan** with Codex (Phase 2 of skill workflow)
2. **Review with stakeholders**: Finance, Engineering Managers, PMO
3. **Obtain sample data**: Get actual IO Framework CSV and Headcount Excel
4. **Run SQL scripts** in dev environment
5. **Build proof-of-concept** with 1 department's data

---

## Appendix A: SQL Script Checklist

- [ ] `01-create-funding-entity-dimension.sql`
- [ ] `02-create-io-category-dimension.sql`
- [ ] `03-alter-projects-table.sql`
- [ ] `04-create-resource-plans-table.sql`
- [ ] `05-create-planning-scenarios.sql`
- [ ] `06-create-classification-functions.sql`
- [ ] `07-create-reporting-views.sql`
- [ ] `08-sample-data-insert.sql`

---

**Document Status**: ✅ Planning Complete - Ready for Codex Validation
**Next Phase**: Send to Codex for architectural review and gap analysis
**Owner**: Engineering Management + Finance Team
