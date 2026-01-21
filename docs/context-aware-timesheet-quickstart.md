# Context-Aware Timesheet System - Quick Start Guide

**Goal**: Transform complex cost allocation into a 2-click user experience.

---

## TL;DR - What You're Building

A timesheet system where:
- **Users see**: 3 simple fields (Project, Activity, Hours)
- **Management gets**: 4-tier granular cost reports (Direct Product / Direct Project / Indirect / Overhead)
- **Magic happens via**: Context-aware rules engine that auto-classifies based on WHO + WHERE + WHAT

---

## 5-Minute Setup

### Step 1: Run Database Scripts

```bash
# From your project root
cd docs/

# Step 1: Create tables and structures
psql -h localhost -p 5434 -U postgres -d edwards -f sql-implementation-activity-codes.sql

# Step 2: Load business rules
psql -h localhost -p 5434 -U postgres -d edwards -f sql-implementation-allocation-rules.sql
```

### Step 2: Verify Installation

```sql
-- Check tables created
SELECT table_name
FROM information_schema.tables
WHERE table_name IN ('dim_activity_code', 'dim_cost_bucket', 'allocation_rules');

-- Should return 3 tables

-- Check rules loaded
SELECT COUNT(*) FROM allocation_rules WHERE is_active = TRUE;
-- Should return ~30 rules

-- Check activity codes
SELECT code, name, category FROM dim_activity_code ORDER BY display_order;
-- Should return 15 activities
```

---

## Understanding the System

### The 3 Dimensions of Classification

```
┌─────────────────────────────────────────────────────────────┐
│                     CLASSIFICATION                          │
│                                                             │
│  INPUT                              OUTPUT                  │
│  ─────                              ──────                  │
│  WHO    (User Context)                                      │
│  ├─ Department: ACM Engineering     ─┐                      │
│  ├─ Sub Team: Control Engineering    │                      │
│  └─ Role: Senior Engineer            │                      │
│                                       ├─→ CLASSIFICATION    │
│  WHERE  (Project Context)             │    ENGINE          │
│  ├─ Project Type: NPI                 │                     │
│  ├─ Category: PRODUCT                 │                     │
│  └─ Owner: ACM Dept                  ─┤                     │
│                                       │                      │
│  WHAT   (Activity)                    │      ↓              │
│  ├─ Activity: DESIGN                  │                     │
│  └─ Category: DEVELOPMENT            ─┘   Result:           │
│                                           DIRECT_PRODUCT     │
│                                           Confidence: 95%    │
└─────────────────────────────────────────────────────────────┘
```

### The 4 Cost Buckets (Output)

| Bucket | Description | Examples | Capitalizable |
|--------|-------------|----------|---------------|
| 🟢 **DIRECT_PRODUCT** | Core product R&D | NPI design, ETO testing | ✅ Yes |
| 🟡 **DIRECT_PROJECT** | Customer projects | Lower-margin project work | ✅ Yes |
| 🟠 **INDIRECT** | Support work | Field support, sales support | ❌ No |
| ⚪ **OVERHEAD** | General ops | Training, admin, PTO | ❌ No |

### The 15 Activity Codes (User Input)

**Development** (usually Direct):
- `DESIGN` - Design & Development
- `TEST` - Testing & Validation
- `DOC` - Documentation
- `RELEASE` - Release & Deployment

**Collaboration** (context-dependent):
- `MEET` - Meeting & Discussion
- `REVIEW` - Design Review & Approval
- `PLAN` - Planning & Estimation

**Support** (usually Indirect):
- `FIELD` - Field Support
- `SALES` - Sales Support
- `SUSTAIN` - Sustaining (Bug Fix)
- `TRIAGE` - Issue Investigation

**Overhead** (always General):
- `ADMIN` - Admin & Process Work
- `TRAINING` - Training & Learning
- `HIRING` - Recruiting & Interviews
- `PTO` - Time Off

---

## Testing the Classification Engine

### Test 1: Direct Product Work

```sql
-- Scenario: ACM Engineer designing on NPI project
SELECT * FROM classify_timesheet_entry(
    p_user_id := (SELECT id FROM users WHERE department_id = 'DEPT_ACM' LIMIT 1),
    p_project_id := (SELECT id FROM projects WHERE project_type_id = 'NPI' LIMIT 1),
    p_activity_code_id := 'ACT_DESIGN'
);

-- Expected Result:
-- ├─ cost_bucket_id: BUCKET_DIRECT_PROD
-- ├─ cost_bucket_name: Direct Product Development
-- ├─ rule_name: NPI Design Work
-- └─ confidence_score: 95
```

### Test 2: Indirect Support Work

```sql
-- Scenario: Engineer doing field support
SELECT * FROM classify_timesheet_entry(
    p_user_id := (SELECT id FROM users LIMIT 1),
    p_project_id := (SELECT id FROM projects WHERE project_type_id = 'SUPPORT' LIMIT 1),
    p_activity_code_id := 'ACT_FIELD'
);

-- Expected Result:
-- ├─ cost_bucket_id: BUCKET_INDIRECT
-- ├─ rule_name: Field Support Activities
-- └─ confidence_score: ~85
```

### Test 3: Overhead Work

```sql
-- Scenario: Training (no project)
SELECT * FROM classify_timesheet_entry(
    p_user_id := (SELECT id FROM users LIMIT 1),
    p_project_id := NULL,
    p_activity_code_id := 'ACT_TRAINING'
);

-- Expected Result:
-- ├─ cost_bucket_id: BUCKET_OVERHEAD
-- ├─ rule_name: Training Activities
-- └─ confidence_score: 100
```

### Test 4: Insert Real Entry (Auto-Classification)

```sql
-- Insert a timesheet entry - trigger auto-classifies it
INSERT INTO timesheet_entries (
    id,
    user_id,
    project_id,
    activity_code_id,
    work_date,
    hours_logged,
    comment
) VALUES (
    gen_random_uuid()::text,
    (SELECT id FROM users WHERE email = 'aaron.oh@csk.kr'),
    (SELECT id FROM projects WHERE code = '407056' LIMIT 1), -- NPI project
    'ACT_DESIGN',
    CURRENT_DATE,
    8.0,
    'Worked on control system design'
);

-- Check auto-classification result
SELECT
    te.work_date,
    u.name,
    p.code AS project_code,
    ac.name AS activity,
    cb.bucket_name,
    te.confidence_score,
    ar.rule_name
FROM timesheet_entries te
JOIN users u ON te.user_id = u.id
JOIN projects p ON te.project_id = p.id
JOIN dim_activity_code ac ON te.activity_code_id = ac.id
JOIN dim_cost_bucket cb ON te.cost_bucket_id = cb.id
LEFT JOIN allocation_rules ar ON te.allocation_rule_id = ar.id
WHERE te.work_date = CURRENT_DATE
  AND u.email = 'aaron.oh@csk.kr'
ORDER BY te.created_at DESC
LIMIT 1;
```

---

## Reporting Queries (Management View)

### Report 1: Monthly Cost Distribution

```sql
-- Current month summary by cost bucket
SELECT
    cb.bucket_name,
    COUNT(DISTINCT te.user_id) AS headcount,
    ROUND(SUM(te.hours_logged), 1) AS total_hours,
    ROUND(SUM(te.hours_logged) * 100.0 / SUM(SUM(te.hours_logged)) OVER (), 1) AS percentage,
    ROUND(AVG(te.confidence_score), 1) AS avg_confidence
FROM timesheet_entries te
JOIN dim_cost_bucket cb ON te.cost_bucket_id = cb.id
WHERE te.work_date >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY cb.bucket_name, cb.sort_order
ORDER BY cb.sort_order;
```

**Expected Output**:
```
bucket_name                   | headcount | total_hours | percentage | avg_confidence
------------------------------|-----------|-------------|------------|---------------
Direct Product Development    | 85        | 6800.0      | 65.0       | 92.5
Direct Project Work           | 35        | 1400.0      | 13.4       | 88.0
Indirect Support Work         | 50        | 1800.0      | 17.2       | 85.0
General Overhead              | 120       | 460.0       | 4.4        | 95.0
```

### Report 2: Department Work Distribution

```sql
-- Each department's work breakdown
SELECT
    d.department_name,
    cb.bucket_code,
    ROUND(SUM(te.hours_logged), 1) AS hours,
    ROUND(SUM(te.hours_logged) * 100.0 / SUM(SUM(te.hours_logged)) OVER (PARTITION BY d.department_id), 1) AS dept_pct
FROM timesheet_entries te
JOIN users u ON te.user_id = u.id
JOIN departments d ON u.department_id = d.id
JOIN dim_cost_bucket cb ON te.cost_bucket_id = cb.id
WHERE te.work_date >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY d.department_name, cb.bucket_code, cb.sort_order
ORDER BY d.department_name, cb.sort_order;
```

### Report 3: Quality Check - Low Confidence Entries

```sql
-- Find ambiguous entries that need rule refinement
SELECT
    u.name,
    d.department_name,
    p.name AS project,
    pt.name AS project_type,
    ac.name AS activity,
    cb.bucket_name AS classified_as,
    te.confidence_score,
    te.hours_logged,
    te.work_date
FROM timesheet_entries te
JOIN users u ON te.user_id = u.id
JOIN departments d ON u.department_id = d.id
LEFT JOIN projects p ON te.project_id = p.id
LEFT JOIN project_types pt ON p.project_type_id = pt.id
JOIN dim_activity_code ac ON te.activity_code_id = ac.id
JOIN dim_cost_bucket cb ON te.cost_bucket_id = cb.id
WHERE te.confidence_score < 70
  AND te.work_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY te.confidence_score ASC;
```

---

## Customizing Rules for Your Business

### Adding a Department-Specific Rule

```sql
-- Example: Central Engineering cross-team support is always Indirect
INSERT INTO allocation_rules (
    rule_priority,
    rule_name,
    user_department_id,
    target_cost_bucket_id,
    description
) VALUES (
    75,
    'Central Eng Default',
    'DEPT_CENTRAL',  -- Replace with your actual dept ID
    'BUCKET_INDIRECT',
    'Central Engineering provides cross-team support'
);
```

### Adding a New Activity Code

```sql
-- Example: Add "ARCHITECTURE" activity
INSERT INTO dim_activity_code (
    id,
    code,
    name,
    category,
    description,
    requires_project,
    display_order,
    icon_code
) VALUES (
    'ACT_ARCH',
    'ARCH',
    'Architecture & Design Review',
    'COLLABORATION',
    'System architecture, design patterns, technical leadership',
    TRUE,
    65,
    '🏗️'
);

-- Add rule for architecture work on product projects
INSERT INTO allocation_rules (
    rule_priority,
    rule_name,
    project_category,
    activity_code_id,
    target_cost_bucket_id
) VALUES (
    35,
    'Product Architecture',
    'PRODUCT',
    'ACT_ARCH',
    'BUCKET_DIRECT_PROD'
);
```

---

## UI Integration Guide

### API Endpoint 1: Create Timesheet Entry

```typescript
// POST /api/timesheet/entries
interface CreateTimesheetEntryRequest {
  userId: string;
  projectId: string | null;  // Nullable for overhead activities
  activityCodeId: string;    // e.g., 'ACT_DESIGN'
  workDate: string;          // ISO date: '2026-01-21'
  hoursLogged: number;       // e.g., 8.0
  comment?: string;
}

interface CreateTimesheetEntryResponse {
  id: string;
  // Auto-computed fields:
  costBucketId: string;
  costBucketName: string;
  confidenceScore: number;    // 0-100
  allocationRuleId: number;
  ruleName: string;
}
```

**Backend Implementation** (Python FastAPI example):

```python
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class TimesheetEntry(BaseModel):
    user_id: str
    project_id: str | None
    activity_code_id: str
    work_date: str
    hours_logged: float
    comment: str | None = None

@router.post("/api/timesheet/entries")
async def create_entry(entry: TimesheetEntry, db: Session):
    # Step 1: Create entry (trigger auto-classifies)
    new_entry = TimesheetEntry(
        id=str(uuid.uuid4()),
        user_id=entry.user_id,
        project_id=entry.project_id,
        activity_code_id=entry.activity_code_id,
        work_date=entry.work_date,
        hours_logged=entry.hours_logged,
        comment=entry.comment
    )

    db.add(new_entry)
    db.commit()
    db.refresh(new_entry)

    # Step 2: Fetch classification result (populated by trigger)
    result = db.execute("""
        SELECT
            te.id,
            te.cost_bucket_id,
            cb.bucket_name,
            te.confidence_score,
            te.allocation_rule_id,
            ar.rule_name
        FROM timesheet_entries te
        JOIN dim_cost_bucket cb ON te.cost_bucket_id = cb.id
        LEFT JOIN allocation_rules ar ON te.allocation_rule_id = ar.id
        WHERE te.id = :entry_id
    """, {"entry_id": new_entry.id}).fetchone()

    return {
        "id": result.id,
        "costBucketId": result.cost_bucket_id,
        "costBucketName": result.bucket_name,
        "confidenceScore": result.confidence_score,
        "allocationRuleId": result.allocation_rule_id,
        "ruleName": result.rule_name
    }
```

### API Endpoint 2: Preview Classification

```typescript
// GET /api/timesheet/classify/preview
// Use this for real-time feedback before submission

interface ClassifyPreviewRequest {
  userId: string;
  projectId: string | null;
  activityCodeId: string;
  workDate: string;
}

interface ClassifyPreviewResponse {
  costBucketId: string;
  costBucketName: string;
  costBucketColor: string;    // Hex color for badge
  confidenceScore: number;
  ruleName: string;
  isAmbiguous: boolean;       // true if confidence < 70
}
```

### Frontend Component Example (React)

```tsx
import { useState, useEffect } from 'react';

function TimesheetEntryForm() {
  const [formData, setFormData] = useState({
    projectId: '',
    activityCodeId: 'ACT_DESIGN', // Smart default
    hours: 8.0
  });
  const [classification, setClassification] = useState(null);

  // Real-time classification preview
  useEffect(() => {
    if (formData.projectId && formData.activityCodeId) {
      fetch('/api/timesheet/classify/preview', {
        method: 'POST',
        body: JSON.stringify({
          userId: currentUserId,
          projectId: formData.projectId,
          activityCodeId: formData.activityCodeId,
          workDate: new Date().toISOString().split('T')[0]
        })
      })
      .then(res => res.json())
      .then(setClassification);
    }
  }, [formData.projectId, formData.activityCodeId]);

  return (
    <form>
      <select value={formData.projectId} onChange={e => setFormData({...formData, projectId: e.target.value})}>
        {/* Project options */}
      </select>

      <select value={formData.activityCodeId} onChange={e => setFormData({...formData, activityCodeId: e.target.value})}>
        <option value="ACT_DESIGN">🎨 Design</option>
        <option value="ACT_TEST">🧪 Test</option>
        <option value="ACT_MEET">💬 Meeting</option>
        {/* More options */}
      </select>

      <input type="number" value={formData.hours} onChange={e => setFormData({...formData, hours: e.target.value})} />

      {/* Real-time classification preview */}
      {classification && (
        <div className={`badge badge-${classification.isAmbiguous ? 'warning' : 'success'}`}>
          💡 Auto-classified as: {classification.costBucketName} ({classification.confidenceScore}%)
          <br />
          <small>Rule: {classification.ruleName}</small>
        </div>
      )}

      <button type="submit">Log Time</button>
    </form>
  );
}
```

---

## Maintenance & Continuous Improvement

### Monthly Review Checklist

1. **Check Low Confidence Entries**
   ```sql
   SELECT * FROM v_low_confidence_entries
   WHERE work_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month';
   ```
   - Action: Add specific rules for common patterns

2. **Review Rule Coverage Gaps**
   ```sql
   SELECT * FROM v_rule_coverage_gaps;
   ```
   - Action: Add missing rules for new project types or activities

3. **Monitor Rule Usage**
   ```sql
   SELECT * FROM v_rule_usage_stats;
   ```
   - Action: Archive unused rules, optimize frequently-used ones

4. **Validate Cost Distribution**
   - Compare with previous months
   - Flag departments with unusual distributions (e.g., 95% overhead)

### Quarterly Rule Refinement

```sql
-- Reclassify last quarter after rule changes
SELECT * FROM reclassify_timesheet_entries(
    p_start_date := DATE_TRUNC('quarter', CURRENT_DATE) - INTERVAL '3 months',
    p_end_date := DATE_TRUNC('quarter', CURRENT_DATE),
    p_exclude_manual_override := TRUE
);

-- Returns: entries_processed, entries_changed, avg_confidence
```

---

## Success Metrics Dashboard

### KPIs to Track

| Metric | Target | Query |
|--------|--------|-------|
| Average time per entry | < 30 sec | Frontend timing |
| Daily completion rate | > 90% | Entries / Working days |
| Average confidence score | > 85% | `AVG(confidence_score)` |
| Unclassified entries | < 5% | `bucket = UNCLASSIFIED` |
| Manual overrides | < 2% | `is_manual_override = TRUE` |
| Direct work ratio | > 70% | Direct buckets / Total |
| Overhead ratio | < 10% | Overhead / Total |

### Sample Dashboard Query

```sql
-- Weekly KPI snapshot
SELECT
    DATE_TRUNC('week', te.work_date) AS week,
    COUNT(te.id) AS total_entries,
    COUNT(DISTINCT te.user_id) AS active_users,
    ROUND(AVG(te.confidence_score), 1) AS avg_confidence,
    ROUND(SUM(CASE WHEN cb.bucket_code IN ('DIRECT_PROD', 'DIRECT_PROJ') THEN te.hours_logged ELSE 0 END) * 100.0 / SUM(te.hours_logged), 1) AS direct_work_pct,
    ROUND(SUM(CASE WHEN cb.bucket_code = 'OVERHEAD' THEN te.hours_logged ELSE 0 END) * 100.0 / SUM(te.hours_logged), 1) AS overhead_pct,
    SUM(CASE WHEN te.is_manual_override THEN 1 ELSE 0 END) AS manual_overrides
FROM timesheet_entries te
JOIN dim_cost_bucket cb ON te.cost_bucket_id = cb.id
WHERE te.work_date >= CURRENT_DATE - INTERVAL '8 weeks'
GROUP BY DATE_TRUNC('week', te.work_date)
ORDER BY week DESC;
```

---

## Troubleshooting

### Issue: All entries classified as "Unclassified"

**Cause**: No fallback rule exists or rules don't match context

**Fix**:
```sql
-- Check if global fallback exists
SELECT * FROM allocation_rules WHERE rule_priority = 999;

-- If missing, add it
INSERT INTO allocation_rules (rule_priority, rule_name, target_cost_bucket_id)
VALUES (999, 'Global Fallback', 'BUCKET_OVERHEAD');
```

### Issue: Confidence scores too low

**Cause**: Rules are too generic (many NULLs)

**Fix**: Add more specific rules at higher priority
```sql
-- Example: Add specific rule for your most common scenario
INSERT INTO allocation_rules (
    rule_priority,
    rule_name,
    user_department_id,
    project_type_id,
    activity_code_id,
    target_cost_bucket_id
) VALUES (
    5,  -- High priority
    'ACM NPI Design (Specific)',
    'DEPT_ACM',
    'NPI',
    'ACT_DESIGN',
    'BUCKET_DIRECT_PROD'
);
```

### Issue: Trigger not firing

**Check**:
```sql
-- Verify trigger exists
SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'trg_auto_classify';

-- Re-enable if disabled
ALTER TABLE timesheet_entries ENABLE TRIGGER trg_auto_classify;
```

---

## Next Steps

1. ✅ **Complete**: Database schema created
2. ✅ **Complete**: 30 starter rules loaded
3. ✅ **Complete**: Classification engine functional
4. 🔲 **TODO**: Test with 10 sample entries
5. 🔲 **TODO**: Build UI form with real-time preview
6. 🔲 **TODO**: Create management dashboard
7. 🔲 **TODO**: Run 2-week pilot with 1 department
8. 🔲 **TODO**: Measure: time per entry, confidence scores, user satisfaction
9. 🔲 **TODO**: Refine rules based on pilot feedback
10. 🔲 **TODO**: Scale to full organization

---

## Support & Documentation

- **Architecture Doc**: `context-aware-timesheet-architecture.md`
- **SQL Scripts**: `sql-implementation-*.sql`
- **This Guide**: `context-aware-timesheet-quickstart.md`

**Questions?** Review the low-confidence entries view to identify which rules need refinement.

---

**Version**: 1.0
**Last Updated**: 2026-01-21
**Maintained By**: Engineering Management Team
