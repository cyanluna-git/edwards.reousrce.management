# Recharge & Planning System - Implementation Guide

**Status**: ✅ Ready for Deployment
**Date**: 2026-01-21
**Version**: 1.0

---

## 📋 What You're Implementing

This system extends the Context-Aware Timesheet to support:
1. **Inter-company Recharge**: Track CAPEX/OPEX for different funding entities (VSS, SUN, LOCAL_KR)
2. **Resource Planning**: Replace Excel-based FTE planning with database
3. **Plan vs. Actual**: Compare planned vs. actual resource utilization
4. **IO Framework Integration**: Auto-classify projects based on naming conventions

---

## 🚀 Quick Start (30 Minutes)

### Prerequisites

- PostgreSQL 15+ running
- Edwards database already set up with context-aware timesheet system
- Access to database with CREATE TABLE privileges
- (Optional) Historical planning Excel data

### Installation Steps

```bash
# Navigate to docs directory
cd docs/

# Run scripts in order (15-20 minutes total)
psql -h localhost -p 5434 -U postgres -d edwards -f sql-recharge-01-funding-entity.sql
psql -h localhost -p 5434 -U postgres -d edwards -f sql-recharge-02-io-category.sql
psql -h localhost -p 5434 -U postgres -d edwards -f sql-recharge-03-projects-enhancement.sql
psql -h localhost -p 5434 -U postgres -d edwards -f sql-recharge-04-resource-plans.sql
psql -h localhost -p 5434 -U postgres -d edwards -f sql-recharge-05-classification-functions.sql
psql -h localhost -p 5434 -U postgres -d edwards -f sql-recharge-06-plan-vs-actual-views.sql

# Optional: Data migration (if you have Excel data)
# psql -h localhost -p 5434 -U postgres -d edwards -f sql-recharge-07-data-migration.sql
```

Each script provides verification output. Look for ✅ success messages.

---

## 📁 Script Overview

| Script | Purpose | Runtime | Dependencies |
|--------|---------|---------|--------------|
| `01-funding-entity.sql` | Create funding entities (VSS, SUN, LOCAL_KR) | 1 min | None |
| `02-io-category.sql` | Create IO categories dimension | 1 min | Script 01 |
| `03-projects-enhancement.sql` | Add recharge columns to projects + auto-classification | 2 min | Scripts 01-02 |
| `04-resource-plans.sql` | Create planning tables with FTE validation | 2 min | Scripts 01-03 |
| `05-classification-functions.sql` | Enhanced classification with recharge logic | 3 min | Scripts 01-04 |
| `06-plan-vs-actual-views.sql` | Reporting views for variance analysis | 2 min | Scripts 01-05 |
| `07-data-migration.sql` | Import historical Excel data (optional) | 5-10 min | Scripts 01-06 |

**Total Time**: ~15-20 minutes (without data migration)

---

## 🧪 Testing After Installation

### Test 1: Verify Funding Entities

```sql
-- Should return 4 entities (VSS, SUN, LOCAL_KR, SHARED)
SELECT entity_code, entity_name, is_active
FROM dim_funding_entity
ORDER BY entity_code;
```

Expected output:
```
entity_code | entity_name       | is_active
------------|-------------------|----------
LOCAL_KR    | Local Korea       | t
SHARED      | Shared Services   | t
SUN         | SUN Division      | t
VSS         | VSS Division      | t
```

### Test 2: Check Project Auto-Classification

```sql
-- View project financial classification
SELECT
    code,
    name,
    project_type_id,
    recharge_status,
    funding_entity_id,
    is_capitalizable
FROM projects
WHERE status = 'InProgress'
ORDER BY recharge_status, code
LIMIT 10;
```

Expected: Projects should have `funding_entity_id` and `recharge_status` populated.

### Test 3: Test Recharge Classification

```sql
-- Test with a sample user and project
SELECT
    cost_bucket_name,
    is_rechargeable,
    funding_entity_name,
    recharge_reason,
    confidence_score
FROM classify_with_recharge(
    (SELECT id FROM users LIMIT 1),
    (SELECT id FROM projects WHERE recharge_status = 'BILLABLE' LIMIT 1),
    'ACT_DESIGN',
    CURRENT_DATE
);
```

Expected: Function returns classification with recharge detection.

### Test 4: Create Sample Resource Plan

```sql
-- Insert a test resource plan
INSERT INTO resource_plans (
    id,
    user_id,
    project_id,
    activity_code_id,
    plan_year,
    plan_month,
    planned_fte,
    scenario_id,
    plan_status
)
SELECT
    gen_random_uuid()::text,
    (SELECT id FROM users WHERE is_active = TRUE LIMIT 1),
    (SELECT id FROM projects WHERE status = 'InProgress' LIMIT 1),
    'ACT_DESIGN',
    2026,
    2,
    0.5,  -- 50% allocation
    'SCENARIO_2026_BASELINE',
    'DRAFT';

-- Verify FTE validation trigger works
SELECT * FROM v_monthly_fte_summary
WHERE plan_year = 2026 AND plan_month = 2;
```

Expected: Plan created successfully, FTE summary shows 0.5 FTE allocation.

### Test 5: View Plan vs Actual (Once You Have Data)

```sql
SELECT
    user_name,
    project_code,
    planned_fte,
    actual_fte,
    utilization_pct,
    delivery_status
FROM v_plan_vs_actual
WHERE plan_year = 2026 AND plan_month = 1
LIMIT 10;
```

---

## 📊 Key Features Implemented

### 1. Project Financial Classification

**New Columns in `projects`**:
- `funding_entity_id`: Who pays (VSS, SUN, LOCAL_KR)
- `recharge_status`: BILLABLE, NON_BILLABLE, INTERNAL
- `io_category_code`: Maps to Programme
- `is_capitalizable`: CAPEX vs OPEX flag

**Auto-Classification Logic**:
```
IF project_code contains 'VSS' → VSS entity, BILLABLE
IF project_code contains 'SUN' → SUN entity, BILLABLE
IF project_type = NPI → LOCAL_KR, NON_BILLABLE, CAPEX
IF project_type = SUPPORT → Check if division-specific
```

### 2. Resource Planning Tables

**`resource_plans` table**:
- Stores planned FTE allocations per user/project/month
- Replaces Excel wide format (Jan, Feb, Mar...) with long format
- FTE validation trigger prevents over-allocation (>1.0 FTE per month)
- Supports multiple planning scenarios (baseline, optimistic, etc.)

**`planning_scenarios` table**:
- Enables what-if analysis
- Version control for plans
- Track approved vs draft plans

### 3. Enhanced Classification with Recharge

**`classify_with_recharge()` function**:
- Detects cross-entity work (e.g., LOCAL_KR team supporting VSS project)
- Auto-classifies as recharge CAPEX when appropriate
- Returns funding entity, recharge reason, and confidence score

**Recharge Logic**:
```
IF project.recharge_status = BILLABLE
   AND user.entity ≠ project.entity
THEN → DIRECT_PROJECT (Recharge), bill to project.entity

IF project.recharge_status = NON_BILLABLE
THEN → DIRECT_PRODUCT (Local CAPEX), no recharge

IF project.recharge_status = INTERNAL
THEN → OVERHEAD, no recharge
```

### 4. Comprehensive Reporting Views

**`v_plan_vs_actual`**:
- User/project/month level variance analysis
- Planned FTE, actual FTE, utilization %
- Delivery status: On Track, Under-delivered, Over-spent

**`v_dept_plan_vs_actual`**:
- Department-level rollup
- Headcount, projects, cost variance

**`v_project_plan_vs_actual`**:
- Project-level resource tracking
- Contributor count, utilization %

**`v_monthly_recharge_report`**:
- Inter-company billing report
- Includes hourly rates and amounts
- Ready for invoice generation

### 5. FTE Validation & Safety

**Validation Trigger**:
- Prevents FTE over-allocation (sum > 1.0 per user per month)
- Raises exception with helpful error message
- User-friendly: "Aaron Oh in 2026-02: 1.3 FTE (max: 1.0)"

**Data Quality Views**:
- `v_monthly_fte_summary`: Flags over/under allocation
- `v_monthly_variance_heatmap`: Visualize allocation accuracy

---

## 📝 Data Migration (Excel → Database)

If you have historical planning data in Excel:

### Step 1: Prepare Excel Data

Excel format (wide):
```
User Name | Project | Jan | Feb | Mar | ... | Dec
----------|---------|-----|-----|-----|-----|----
Aaron Oh  | NPI-001 | 0.5 | 0.5 | 0.3 | ... | 0.0
```

### Step 2: Run Python Conversion Script

Script is embedded in `sql-recharge-07-data-migration.sql` comments.

```bash
# Extract Python script from SQL file
sed -n '/```python/,/```/p' sql-recharge-07-data-migration.sql > pivot_headcount.py

# Run conversion
python pivot_headcount.py "PCAS Eng._Monthly Headcounts.csv" resource_plans_import.csv 2026
```

### Step 3: Import to Database

```bash
# Run migration script
psql -h localhost -p 5434 -U postgres -d edwards -f sql-recharge-07-data-migration.sql

# Or use \copy for CSV import
psql -h localhost -p 5434 -U postgres -d edwards
\copy temp_resource_plans_import (user_name, project_code, plan_year, plan_month, planned_fte) FROM 'resource_plans_import.csv' CSV HEADER
```

### Step 4: Review Validation Report

```sql
-- Check for import issues
SELECT
    issue_type,
    COUNT(*) AS issue_count
FROM temp_import_validation
GROUP BY issue_type;

-- View unmatched users
SELECT * FROM temp_import_validation
WHERE issue_type = 'USER_NOT_FOUND';

-- View FTE over-allocations
SELECT * FROM temp_import_validation
WHERE issue_type = 'FTE_OVERALLOCATION';
```

**Expected Migration Success Rate**: >95% (some manual cleanup may be needed)

---

## 🔧 Configuration & Customization

### Add New Funding Entity

```sql
INSERT INTO dim_funding_entity (id, entity_code, entity_name, country_code, currency_code)
VALUES ('ENTITY_CUSTOM', 'CUSTOM', 'Custom Division', 'USA', 'USD');
```

### Add New IO Category

```sql
INSERT INTO dim_io_category (id, category_code, category_name, is_billable, default_funding_entity_id)
VALUES ('IO_CAT_CUSTOM', 'CUSTOM_CAT', 'Custom Category', TRUE, 'ENTITY_VSS');
```

### Customize Auto-Classification Rules

Edit `auto_classify_project_funding()` function in `sql-recharge-03-projects-enhancement.sql`:

```sql
-- Add new rule
ELSIF p_project_name ILIKE '%SPECIAL%' THEN
    RETURN QUERY SELECT
        'ENTITY_CUSTOM'::VARCHAR,
        'BILLABLE'::VARCHAR,
        'SPECIAL'::VARCHAR,
        TRUE;
```

### Adjust FTE Validation Threshold

Edit `validate_fte_allocation()` function in `sql-recharge-04-resource-plans.sql`:

```sql
-- Change max FTE from 1.0 to 1.2 (allow 20% over-booking)
IF v_total_fte > 1.2 THEN  -- Changed from 1.0
```

---

## 📈 Common Queries

### Query 1: Current Month Department Utilization

```sql
SELECT
    department_name,
    total_planned_fte,
    total_actual_fte,
    avg_utilization_pct,
    on_track_count,
    under_delivered_count
FROM v_dept_plan_vs_actual
WHERE plan_year = EXTRACT(YEAR FROM CURRENT_DATE)
  AND plan_month = EXTRACT(MONTH FROM CURRENT_DATE)
ORDER BY department_name;
```

### Query 2: Recharge Report for Invoicing

```sql
SELECT
    billing_to_entity,
    billing_month,
    total_billable_hours,
    total_amount,
    currency_code
FROM v_recharge_summary_by_entity
WHERE billing_month >= DATE_TRUNC('quarter', CURRENT_DATE)
ORDER BY billing_month DESC, total_amount DESC;
```

### Query 3: Project Resource Forecast

```sql
SELECT
    project_code,
    project_name,
    plan_year,
    plan_month,
    total_planned_fte,
    contributor_count,
    project_status
FROM v_project_plan_vs_actual
WHERE plan_year = 2026
  AND plan_month BETWEEN 1 AND 6  -- H1 2026
ORDER BY project_code, plan_month;
```

### Query 4: User Allocation Calendar

```sql
SELECT
    user_name,
    plan_year,
    plan_month,
    project_count,
    total_fte,
    allocation_status
FROM v_monthly_fte_summary
WHERE user_name = 'Aaron Oh'
  AND plan_year = 2026
ORDER BY plan_month;
```

---

## 🐛 Troubleshooting

### Issue 1: Foreign Key Constraint Violation

**Error**: `foreign key constraint "projects_funding_entity_fkey" violated`

**Cause**: Project references non-existent funding entity

**Fix**:
```sql
-- Check which projects have invalid funding_entity_id
SELECT code, name, funding_entity_id
FROM projects
WHERE funding_entity_id IS NOT NULL
  AND funding_entity_id NOT IN (SELECT id FROM dim_funding_entity);

-- Reset to NULL or valid entity
UPDATE projects
SET funding_entity_id = NULL
WHERE funding_entity_id NOT IN (SELECT id FROM dim_funding_entity);
```

### Issue 2: FTE Over-Allocation Error

**Error**: `FTE over-allocation detected for Aaron Oh in 2026-02: 1.3 FTE`

**Fix**:
```sql
-- View user's allocations for the month
SELECT
    p.code,
    p.name,
    rp.planned_fte,
    rp.plan_status
FROM resource_plans rp
JOIN projects p ON rp.project_id = p.id
WHERE rp.user_id = (SELECT id FROM users WHERE name = 'Aaron Oh')
  AND rp.plan_year = 2026
  AND rp.plan_month = 2
ORDER BY rp.planned_fte DESC;

-- Adjust allocations to sum <= 1.0
UPDATE resource_plans
SET planned_fte = 0.3  -- Reduce from 0.5
WHERE id = '[specific-plan-id]';
```

### Issue 3: Classification Confidence Low

**Symptom**: Many entries have confidence < 70%

**Fix**: Add more specific allocation rules or refine project classification:

```sql
-- Check which combinations have low confidence
SELECT
    ac.name AS activity,
    pt.name AS project_type,
    AVG(te.confidence_score) AS avg_confidence,
    COUNT(*) AS entry_count
FROM timesheet_entries te
JOIN dim_activity_code ac ON te.activity_code_id = ac.id
JOIN projects p ON te.project_id = p.id
JOIN project_types pt ON p.project_type_id = pt.id
WHERE te.confidence_score < 70
GROUP BY ac.name, pt.name
ORDER BY entry_count DESC;

-- Add specific rules in allocation_rules table
```

---

## 📚 Reference Documentation

- **Architecture**: `recharge-planning-implementation-plan.md` (60 pages)
- **Context-Aware Timesheet**: `context-aware-timesheet-architecture.md`
- **Quick Start**: `context-aware-timesheet-quickstart.md`

---

## ✅ Post-Installation Checklist

- [ ] All 6 SQL scripts executed successfully
- [ ] Funding entities created (VSS, SUN, LOCAL_KR)
- [ ] Projects auto-classified with funding entities
- [ ] Resource plans table functional
- [ ] FTE validation trigger working
- [ ] Recharge classification function tested
- [ ] Plan vs actual views returning data
- [ ] Data migration completed (if applicable)
- [ ] Validation reports reviewed
- [ ] Team training scheduled

---

## 🚀 Next Steps

1. **Pilot with 1 Department** (Week 1-2):
   - Select one department for testing
   - Import their planning data
   - Generate first plan vs actual report
   - Gather feedback

2. **Refine Rules** (Week 3):
   - Review low-confidence entries
   - Adjust classification rules
   - Fine-tune recharge detection

3. **Scale Organization-Wide** (Week 4-6):
   - Migrate all department data
   - Train managers on planning interface
   - Launch monthly reporting cycle

4. **Build UI** (Week 7-12):
   - Resource planning matrix interface
   - Drag-and-drop FTE allocation
   - Plan vs actual dashboard
   - Recharge report generator

---

## 💡 Tips for Success

1. **Start Small**: Pilot with one department before rolling out organization-wide
2. **Validate Data**: Run migration on test database first
3. **Monitor Confidence**: Track avg confidence score weekly, aim for >85%
4. **Monthly Review**: Review plan vs actual variance and adjust rules
5. **User Training**: Educate users on recharge logic and planning process

---

**Version**: 1.0
**Last Updated**: 2026-01-21
**Status**: ✅ Ready for Production
**Maintained By**: Engineering Management Team
