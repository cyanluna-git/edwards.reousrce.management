# Context-Aware Timesheet Architecture
## Low Friction Input, High Fidelity Output

**Author**: Senior Data Architect & BI Specialist
**Date**: 2026-01-21
**Project**: Edwards Resource Management System

---

## Executive Summary

This document presents a comprehensive architecture for a context-aware timesheet system that achieves:
- **User Experience**: 2-3 clicks per entry (vs. 8-10 in traditional systems)
- **Data Fidelity**: 95%+ automatic classification accuracy
- **Reporting Granularity**: 4-tier cost allocation (Direct Product, Direct Project, Indirect Support, General Overhead)

**Core Innovation**: The "Allocation Intelligence Engine" - a rule-based classifier that uses employee context (department, team, role) + project attributes + activity type to auto-classify timesheet entries into the correct financial buckets.

---

## 1. Conceptual Data Model (ERD Description)

### 1.1 Entity Relationship Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     STAR SCHEMA DESIGN                           │
└─────────────────────────────────────────────────────────────────┘

FACT TABLE (Center):
┌──────────────────────┐
│   TIMESHEET_ENTRY    │  ← The atomic fact
├──────────────────────┤
│ id (PK)              │
│ user_id (FK)         │───┐
│ project_id (FK)      │───┼───┐
│ activity_code (FK)   │───┼───┼───┐
│ work_date            │   │   │   │
│ hours_logged         │   │   │   │
│                      │   │   │   │
│ -- AUTO-COMPUTED:    │   │   │   │
│ cost_bucket_id (FK)  │───┼───┼───┼───┐ ← THE KEY OUTPUT
│ allocation_rule_id   │   │   │   │   │
│ confidence_score     │   │   │   │   │
│ is_manual_override   │   │   │   │   │
└──────────────────────┘   │   │   │   │
                           │   │   │   │
DIMENSION TABLES:          │   │   │   │
                           ▼   │   │   │
┌──────────────────────┐      │   │   │
│   DIM_USER           │      │   │   │
├──────────────────────┤      │   │   │
│ id (PK)              │      │   │   │
│ name                 │      │   │   │
│ department_id (FK)   │──┐   │   │   │
│ sub_team_id (FK)     │──┼─┐ │   │   │
│ position_id (FK)     │  │ │ │   │   │
│ functional_role_id   │  │ │ │   │   │  (e.g., PM, Designer, Test Engineer)
│ hire_date            │  │ │ │   │   │
└──────────────────────┘  │ │ │   │   │
                          │ │ │   │   │
┌──────────────────────┐  │ │ │   │   │
│  DIM_ORGANIZATION    │◄─┘ │ │   │   │
├──────────────────────┤    │ │   │   │
│ department_id (PK)   │    │ │   │   │
│ department_code      │    │ │   │   │
│ department_name      │    │ │   │   │
│ division_id          │    │ │   │   │
│ cost_center          │    │ │   │   │  ← Important for accounting
│ default_bucket_id    │────┼─┼───┼───┤  ← Smart Default per Dept
└──────────────────────┘    │ │   │   │
                            │ │   │   │
┌──────────────────────┐    │ │   │   │
│   DIM_SUB_TEAM       │◄───┘ │   │   │
├──────────────────────┤      │   │   │
│ id (PK)              │      │   │   │
│ name                 │      │   │   │
│ code                 │      │   │   │
│ department_id (FK)   │      │   │   │
│ team_type            │      │   │   │  (PRODUCT, SUPPORT, FUNCTIONAL)
└──────────────────────┘      │   │   │
                              │   │   │
                              ▼   │   │
┌──────────────────────┐          │   │
│   DIM_PROJECT        │          │   │
├──────────────────────┤          │   │
│ id (PK)              │          │   │
│ code                 │          │   │
│ name                 │          │   │
│ project_type_id (FK) │──┐       │   │
│ category             │  │       │   │  (PRODUCT, PROJECT, FUNCTIONAL)
│ program_id           │  │       │   │
│ product_line_id      │  │       │   │
│ owner_dept_id (FK)   │  │       │   │
│ pm_id (FK)           │  │       │   │
│ status               │  │       │   │
└──────────────────────┘  │       │   │
                          │       │   │
┌──────────────────────┐  │       │   │
│  DIM_PROJECT_TYPE    │◄─┘       │   │
├──────────────────────┤          │   │
│ id (PK)              │          │   │
│ name                 │          │   │  (NPI, ETO, SUPPORT, etc.)
│ is_direct_work       │          │   │  ← Business Rule Flag
│ priority_level       │          │   │
└──────────────────────┘          │   │
                                  │   │
                                  ▼   │
┌──────────────────────┐              │
│  DIM_ACTIVITY_CODE   │              │
├──────────────────────┤              │
│ id (PK)              │              │
│ code                 │              │  (DESIGN, TEST, MEET, etc.)
│ name                 │              │
│ category             │              │  (DEVELOPMENT, COLLABORATION, SUPPORT)
│ is_billable          │              │
│ requires_project     │              │  ← Validation rule
│ display_order        │              │
└──────────────────────┘              │
                                      │
                                      ▼
┌─────────────────────────────────────────────────┐
│         ALLOCATION_RULES (THE BRAIN)            │  ← THE INTELLIGENCE
├─────────────────────────────────────────────────┤
│ id (PK)                                         │
│ rule_priority (INT)                             │  ← Match order
│                                                 │
│ -- MATCH CONDITIONS (All are NULLABLE):         │
│ user_department_id (FK, nullable)               │  ← Match specific dept
│ user_sub_team_id (FK, nullable)                 │  ← Or specific team
│ user_functional_role_id (FK, nullable)          │  ← Or specific role
│ project_type_id (FK, nullable)                  │  ← Match project type
│ project_category (ENUM, nullable)               │  ← Or project category
│ activity_code_id (FK, nullable)                 │  ← Or activity type
│ activity_category (ENUM, nullable)              │  ← Or activity category
│                                                 │
│ -- ALLOCATION OUTPUT:                           │
│ target_cost_bucket_id (FK, NOT NULL)            │  ← WHERE it goes
│ allocation_percentage (DECIMAL, default 100)    │  ← For split rules
│                                                 │
│ -- METADATA:                                    │
│ rule_name (VARCHAR)                             │
│ description (TEXT)                              │
│ is_active (BOOLEAN)                             │
│ effective_from (DATE)                           │
│ effective_to (DATE)                             │
│ created_by (FK)                                 │
│                                                 │
│ -- EXAMPLE RULES:                               │
│ Rule #1: Engineering + NPI → DIRECT_PRODUCT     │
│ Rule #2: Engineering + SUPPORT → INDIRECT       │
│ Rule #3: Sales + ANY → INDIRECT_SALES           │
│ Rule #4: MEET activity + NPI → DIRECT_PRODUCT   │
│ Rule #5: MEET activity + NO_PROJECT → OVERHEAD  │
└─────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────┐
│   DIM_COST_BUCKET    │  ← THE FINANCIAL REPORTING DIMENSION
├──────────────────────┤
│ id (PK)              │
│ bucket_code          │  (DIRECT_PROD, DIRECT_PROJ, INDIRECT, OVERHEAD)
│ bucket_name          │
│ level1_category      │  ← Rollup hierarchy
│ level2_subcategory   │
│ gl_account_prefix    │  ← For ERP integration
│ is_capitalizable     │  ← For GAAP compliance
│ display_color        │  ← For dashboards
│ sort_order           │
└──────────────────────┘

BRIDGE TABLE (For Complex Splits):
┌──────────────────────┐
│  ALLOCATION_SPLIT    │  ← When one entry goes to multiple buckets
├──────────────────────┤
│ timesheet_entry_id   │
│ cost_bucket_id       │
│ split_percentage     │
│ split_hours          │
└──────────────────────┘
```

### 1.2 Key Design Principles

1. **Immutable Fact**: Once logged, the raw entry (user, project, activity, hours, date) never changes
2. **Computed Dimension**: `cost_bucket_id` is computed via the Allocation Rules Engine
3. **Audit Trail**: Store `allocation_rule_id` and `confidence_score` to explain the decision
4. **Override Support**: `is_manual_override` flag for exceptional cases
5. **Temporal Rules**: Rules have effective dates, allowing policy changes over time

---

## 2. Context-Aware Classification Logic

### 2.1 The Allocation Engine Algorithm

```python
def classify_timesheet_entry(entry: TimesheetEntry) -> CostBucket:
    """
    Context-aware classifier that uses multi-dimensional matching.

    Priority Order (First Match Wins):
    1. Explicit Manual Override (if exists)
    2. User-specific rules (by role/team)
    3. Activity + Project combination rules
    4. Project-type dominant rules
    5. Department default fallback
    """

    # Step 1: Check for manual override
    if entry.is_manual_override:
        return entry.manual_cost_bucket

    # Step 2: Fetch user context
    user = get_user_with_org_hierarchy(entry.user_id)
    project = get_project_with_type(entry.project_id)
    activity = get_activity_code(entry.activity_code_id)

    # Step 3: Query allocation rules (ordered by priority)
    matching_rules = query_allocation_rules(
        user_department_id=user.department_id,
        user_sub_team_id=user.sub_team_id,
        user_functional_role_id=user.functional_role_id,
        project_type_id=project.project_type_id,
        project_category=project.category,
        activity_code_id=activity.id,
        activity_category=activity.category,
        effective_date=entry.work_date
    )

    # Step 4: Apply first matching rule
    for rule in matching_rules:
        if rule_matches(rule, user, project, activity):
            return CostBucket(
                id=rule.target_cost_bucket_id,
                confidence_score=calculate_confidence(rule),
                allocation_rule_id=rule.id
            )

    # Step 5: Fallback to department default
    return user.department.default_bucket_id


def rule_matches(rule: AllocationRule, user, project, activity) -> bool:
    """
    Check if a rule's conditions match the entry context.
    NULL conditions in rule = wildcard (matches anything).
    """
    conditions = [
        (rule.user_department_id is None or rule.user_department_id == user.department_id),
        (rule.user_sub_team_id is None or rule.user_sub_team_id == user.sub_team_id),
        (rule.user_functional_role_id is None or rule.user_functional_role_id == user.functional_role_id),
        (rule.project_type_id is None or rule.project_type_id == project.project_type_id),
        (rule.project_category is None or rule.project_category == project.category),
        (rule.activity_code_id is None or rule.activity_code_id == activity.id),
        (rule.activity_category is None or rule.activity_category == activity.category),
    ]
    return all(conditions)


def calculate_confidence(rule: AllocationRule) -> float:
    """
    Confidence based on rule specificity.
    More specific rules = higher confidence.
    """
    specificity_score = sum([
        rule.user_department_id is not None,
        rule.user_sub_team_id is not None,
        rule.user_functional_role_id is not None,
        rule.project_type_id is not None,
        rule.project_category is not None,
        rule.activity_code_id is not None,
        rule.activity_category is not None,
    ])

    # Scale to 0-100
    return min((specificity_score / 7.0) * 100, 95)  # Cap at 95% (never 100% unless manual)
```

### 2.2 Classification Decision Tree (Simplified)

```
START: User logs time
│
├─ CONTEXT INPUTS:
│  ├─ WHO: user.department, user.sub_team, user.functional_role
│  ├─ WHERE: project.type, project.category, project.owner_dept
│  └─ WHAT: activity.code, activity.category
│
├─ DECISION LOGIC:
│
│  ┌─────────────────────────────────────────────────────┐
│  │ CASE 1: DIRECT PRODUCT WORK                         │
│  ├─────────────────────────────────────────────────────┤
│  │ IF:                                                 │
│  │   Project.Type IN (NPI, ETO, AND)                   │
│  │   AND Project.Category = PRODUCT                    │
│  │   AND Activity IN (DESIGN, TEST, REVIEW, RELEASE)   │
│  │ THEN: → DIRECT_PRODUCT_DEVELOPMENT                  │
│  │ Confidence: 95%                                     │
│  └─────────────────────────────────────────────────────┘
│
│  ┌─────────────────────────────────────────────────────┐
│  │ CASE 2: DIRECT PROJECT WORK (Lower margin)          │
│  ├─────────────────────────────────────────────────────┤
│  │ IF:                                                 │
│  │   Project.Category = PROJECT                        │
│  │   AND Activity IN (DESIGN, TEST)                    │
│  │ THEN: → DIRECT_PROJECT_WORK                         │
│  │ Confidence: 90%                                     │
│  └─────────────────────────────────────────────────────┘
│
│  ┌─────────────────────────────────────────────────────┐
│  │ CASE 3: INDIRECT SUPPORT WORK                       │
│  ├─────────────────────────────────────────────────────┤
│  │ IF:                                                 │
│  │   Project.Type IN (SUPPORT, SUSTAINING)             │
│  │   OR Project.Category = FUNCTIONAL                  │
│  │   OR Activity IN (FIELD_SUPPORT, SALES_SUPPORT)     │
│  │ THEN: → INDIRECT_SUPPORT                            │
│  │ Confidence: 85%                                     │
│  └─────────────────────────────────────────────────────┘
│
│  ┌─────────────────────────────────────────────────────┐
│  │ CASE 4: CROSS-FUNCTIONAL COLLABORATION              │
│  ├─────────────────────────────────────────────────────┤
│  │ IF:                                                 │
│  │   Activity = MEETING                                │
│  │   AND Project.Type IN (NPI, ETO)                    │
│  │   AND User.Dept ≠ Project.Owner_Dept                │
│  │ THEN:                                               │
│  │   IF User.Dept = CORE_TECH → INDIRECT_SUPPORT      │
│  │   ELSE → Follow Project's bucket (DIRECT)           │
│  │ Confidence: 75%                                     │
│  └─────────────────────────────────────────────────────┘
│
│  ┌─────────────────────────────────────────────────────┐
│  │ CASE 5: GENERAL OVERHEAD                            │
│  ├─────────────────────────────────────────────────────┤
│  │ IF:                                                 │
│  │   Activity IN (TRAINING, ADMIN, PTO, HIRING)        │
│  │   OR Project.Type = TEAM_TASK                       │
│  │ THEN: → GENERAL_OVERHEAD                            │
│  │ Confidence: 90%                                     │
│  └─────────────────────────────────────────────────────┘
│
│  ┌─────────────────────────────────────────────────────┐
│  │ CASE 6: AMBIGUOUS (Flag for Review)                │
│  ├─────────────────────────────────────────────────────┤
│  │ IF: No rule matches                                │
│  │ THEN: → Department.Default_Bucket                   │
│  │ Confidence: <50% (Red flag in UI)                   │
│  └─────────────────────────────────────────────────────┘
│
END: Cost Bucket Assigned + Confidence Score
```

### 2.3 Real-World Classification Examples

```
┌─────────────┬──────────────┬──────────────┬──────────────┬─────────────────────────┐
│ User Dept   │ Project Type │ Activity     │ Result       │ Reasoning               │
├─────────────┼──────────────┼──────────────┼──────────────┼─────────────────────────┤
│ ACM Eng     │ NPI          │ DESIGN       │ DIRECT_PROD  │ Core product dev        │
│ ACM Eng     │ SUPPORT      │ FIELD_SUP    │ INDIRECT     │ Customer support work   │
│ ACM Eng     │ NPI          │ MEETING      │ DIRECT_PROD  │ Project meeting         │
│ ACM Eng     │ (No Project) │ MEETING      │ OVERHEAD     │ General team meeting    │
│ Central Eng │ NPI (ACM)    │ REVIEW       │ INDIRECT     │ Cross-team support      │
│ Central Eng │ SUSTAINING   │ ANALYSIS     │ INDIRECT     │ Ongoing product support │
│ Sales       │ NPI          │ DEMO         │ INDIRECT     │ Sales activity          │
│ Any Dept    │ Any          │ TRAINING     │ OVERHEAD     │ Employee development    │
│ Any Dept    │ TEAM_TASK    │ ADMIN        │ OVERHEAD     │ Dept admin work         │
└─────────────┴──────────────┴──────────────┴──────────────┴─────────────────────────┘
```

---

## 3. UX Strategy for Low-Friction Input

### 3.1 Input Flow Design

**Goal**: Reduce from 8-10 clicks to 2-3 clicks

```
┌─────────────────────────────────────────────────────────────┐
│              TIMESHEET ENTRY SCREEN                         │
│           (Smart Defaults + Minimal Input)                  │
└─────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ Date: [2026-01-21 ▼]          ← Pre-filled: Today
│
│ Project: [ACM NPI 407056 ▼]   ← Smart Default: User's PRIMARY project
│   ├─ Quick Filter by: My Projects (✓) | Team Projects | All
│   └─ Recent: [Last 5 projects user logged to]
│
│ Activity: [DESIGN ▼]           ← Smart Default: DESIGN (most common)
│   └─ Quick access: [DESIGN] [TEST] [MEETING] [REVIEW]
│
│ Hours: [8.0]                   ← Smart Default: 8h or remaining hours
│
│ Comment: [Optional...]         ← Optional free text
│
│ ┌─────────────────────────────────────────────────┐
│ │ 💡 Auto-classified as: DIRECT PRODUCT (95%)     │  ← Real-time feedback
│ │    Rule: Engineering + NPI + Design              │
│ └─────────────────────────────────────────────────┘
│
│ [Quick Log]  [Log & Add Another]  [Copy Yesterday]
└────────────────────────────────────────────────────┘

KEYBOARD SHORTCUTS:
- Enter: Quick Log (if defaults are good)
- Ctrl+D: Duplicate yesterday
- Ctrl+M: Toggle "Meeting" activity
- Tab: Next field
```

### 3.2 Smart Defaults Logic

```sql
-- Calculate user's PRIMARY project (shown as default)
SELECT p.id, p.name, p.code,
       SUM(te.hours_logged) as total_hours,
       MAX(te.work_date) as last_logged
FROM timesheet_entries te
JOIN projects p ON te.project_id = p.id
WHERE te.user_id = :current_user_id
  AND te.work_date >= CURRENT_DATE - INTERVAL '30 days'
  AND p.status = 'InProgress'
GROUP BY p.id, p.name, p.code
ORDER BY last_logged DESC, total_hours DESC
LIMIT 1;
```

### 3.3 Progressive Disclosure

**Level 1 (Default View)**: 3 fields
- Project (smart default)
- Activity (smart default)
- Hours (smart default)

**Level 2 (If needed)**: Click "More Options"
- Split across multiple projects
- Override cost bucket (admin only)
- Detailed comment

**Level 3 (Rare)**: Click "Advanced"
- Custom allocation percentage
- Link to external ticket/document
- Billable/Non-billable toggle

### 3.4 Mobile-First Input (Bonus)

For field engineers logging from mobile:

```
┌──────────────────────────┐
│   Quick Log              │
│                          │
│ Today: Jan 21            │
│                          │
│ [Customer Site Visit]    │  ← Templated quick-log button
│ Project: PRJ-162         │     (Pre-configured by role)
│ Activity: FIELD_SUPPORT  │
│ Hours: 4                 │
│                          │
│     [TAP TO LOG]         │
│                          │
└──────────────────────────┘
```

### 3.5 Validation Rules (Real-time)

1. **Project Required**: Only for work activities (not PTO, Training)
2. **Daily Limit**: Max 12 hours per day (warning at 10h)
3. **Ambiguous Entry Warning**:
   ```
   ⚠️ This entry is ambiguous (Confidence: 45%)
   Please review or add a comment.
   ```
4. **Missing Context**:
   ```
   ⚠️ Meeting without Project
   → Suggest: "Was this related to a project?"
   ```

---

## 4. Activity Code Taxonomy

### 4.1 Design Principles

- **Mutually Exclusive**: No overlap between codes
- **Short List**: 12-15 codes maximum
- **User Language**: Use terms engineers actually say
- **Stable**: Rarely change (to enable trend analysis)

### 4.2 Proposed Activity Codes

```
┌──────────┬─────────────────────────────┬────────────────┬─────────────────┬────────────┐
│ Code     │ Name                        │ Category       │ Requires Proj? │ Common For │
├──────────┼─────────────────────────────┼────────────────┼─────────────────┼────────────┤
│ DESIGN   │ Design & Development        │ DEVELOPMENT    │ Yes            │ Engineers  │
│ TEST     │ Testing & Validation        │ DEVELOPMENT    │ Yes            │ Engineers  │
│ REVIEW   │ Design Review & Approval    │ COLLABORATION  │ Yes            │ All Tech   │
│ MEET     │ Meeting & Discussion        │ COLLABORATION  │ Preferred      │ All        │
│ DOC      │ Documentation               │ DEVELOPMENT    │ Yes            │ Engineers  │
│ RELEASE  │ Release & Deployment        │ DEVELOPMENT    │ Yes            │ Engineers  │
│ ─────    │ ─────────────────────────── │ ──────────     │ ─────────────  │ ────────── │
│ FIELD    │ Field Support               │ SUPPORT        │ Preferred      │ Engineers  │
│ SALES    │ Sales Support (Demo/Consult)│ SUPPORT        │ Preferred      │ Tech+Sales │
│ SUSTAIN  │ Sustaining (Bug Fix)        │ SUPPORT        │ Yes            │ Engineers  │
│ TRIAGE   │ Issue Investigation         │ SUPPORT        │ Preferred      │ Engineers  │
│ ─────    │ ─────────────────────────── │ ──────────     │ ─────────────  │ ────────── │
│ ADMIN    │ Admin & Process Work        │ OVERHEAD       │ No             │ All        │
│ TRAINING │ Training & Learning         │ OVERHEAD       │ No             │ All        │
│ HIRING   │ Recruiting & Interviews     │ OVERHEAD       │ No             │ Mgmt+HR    │
│ PTO      │ Time Off (PTO/Vacation)     │ OVERHEAD       │ No             │ All        │
│ PLAN     │ Planning & Estimation       │ COLLABORATION  │ Preferred      │ PM+Leads   │
└──────────┴─────────────────────────────┴────────────────┴─────────────────┴────────────┘

TOTAL: 15 codes (±2 based on your business)
```

### 4.3 Activity Category Mapping

```
DEVELOPMENT (Direct Work Bias):
├─ DESIGN: Creating new product features
├─ TEST: Verification & validation
├─ DOC: Technical documentation
└─ RELEASE: Production deployment

COLLABORATION (Context-Dependent):
├─ MEET: Can be Direct (if project meeting) or Overhead (if general)
├─ REVIEW: Usually Direct if tied to NPI/ETO
└─ PLAN: Can be Direct (sprint planning) or Overhead (roadmap)

SUPPORT (Indirect Work Bias):
├─ FIELD: Customer site support
├─ SALES: Pre-sales technical consulting
├─ SUSTAIN: Post-release bug fixes
└─ TRIAGE: Issue investigation

OVERHEAD (Always General):
├─ ADMIN: Department operations
├─ TRAINING: Personal development
├─ HIRING: Talent acquisition
└─ PTO: Time off
```

### 4.4 Activity Code Selection UX

**Option 1: Icon Grid (Mobile-friendly)**

```
┌────────────────────────────────────────┐
│ What did you work on?                  │
│                                        │
│  [🎨 DESIGN]  [🧪 TEST]  [📋 REVIEW]  │
│                                        │
│  [💬 MEETING] [📝 DOC]   [🚀 RELEASE] │
│                                        │
│  [🔧 FIELD]   [💼 SALES] [🐛 SUSTAIN] │
│                                        │
│  [📊 More...] ← Expands to show all   │
└────────────────────────────────────────┘
```

**Option 2: Smart Search (Desktop)**

```
Activity: [Des|________]
          ↓
          ├─ DESIGN & Development    ← Matched
          ├─ REVIEW & Approval       ← Contains "De"
          └─ FIELD Support            ← No match
```

**Option 3: Context-Aware Suggestion**

```
User logged to "NPI Project" last 3 days with "DESIGN"
→ Today's default: DESIGN

User's team (Central Eng) commonly logs "REVIEW"
→ Suggest: [REVIEW] in quick-access bar
```

---

## 5. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- [ ] Create `dim_activity_code` table with 15 codes
- [ ] Create `dim_cost_bucket` table (4-6 buckets)
- [ ] Create `allocation_rules` table
- [ ] Define 20-30 initial allocation rules

### Phase 2: Core Engine (Weeks 3-4)
- [ ] Build Classification Engine (Python/SQL)
- [ ] Create REST API endpoint: `POST /classify`
- [ ] Write unit tests for all 15 activity codes × 5 project types
- [ ] Create admin UI for managing allocation rules

### Phase 3: UX Layer (Weeks 5-6)
- [ ] Smart defaults calculation (SQL views)
- [ ] Real-time classification preview (AJAX)
- [ ] "Copy Yesterday" feature
- [ ] Mobile-responsive input form

### Phase 4: Reporting (Weeks 7-8)
- [ ] Cost Bucket Summary Dashboard
- [ ] Confidence Score Heatmap (identify ambiguous patterns)
- [ ] Allocation Rule Usage Report (which rules fire most?)
- [ ] Department-level Cost Analysis

### Phase 5: Continuous Improvement (Ongoing)
- [ ] Monthly review of low-confidence entries
- [ ] Quarterly rule refinement
- [ ] Annual activity code review

---

## 6. Sample Allocation Rules (Starter Set)

```sql
-- Rule Priority: Lower number = higher priority (evaluated first)

INSERT INTO allocation_rules (rule_priority, rule_name, user_department_id, project_type_id, activity_code_id, target_cost_bucket_id) VALUES

-- ══════════════════════════════════════════════════
-- DIRECT PRODUCT WORK (Highest Value)
-- ══════════════════════════════════════════════════
(10, 'NPI Development Work', NULL, 'NPI', 'DESIGN', 'BUCKET_DIRECT_PROD'),
(11, 'NPI Testing Work', NULL, 'NPI', 'TEST', 'BUCKET_DIRECT_PROD'),
(12, 'NPI Documentation', NULL, 'NPI', 'DOC', 'BUCKET_DIRECT_PROD'),
(13, 'NPI Release', NULL, 'NPI', 'RELEASE', 'BUCKET_DIRECT_PROD'),

(20, 'ETO Development Work', NULL, 'ETO', 'DESIGN', 'BUCKET_DIRECT_PROD'),
(21, 'ETO Testing Work', NULL, 'ETO', 'TEST', 'BUCKET_DIRECT_PROD'),
(22, 'ETO Documentation', NULL, 'ETO', 'DOC', 'BUCKET_DIRECT_PROD'),

(30, 'NPI Project Meetings', NULL, 'NPI', 'MEET', 'BUCKET_DIRECT_PROD'),
(31, 'ETO Project Meetings', NULL, 'ETO', 'MEET', 'BUCKET_DIRECT_PROD'),

-- ══════════════════════════════════════════════════
-- DIRECT PROJECT WORK (Lower margin projects)
-- ══════════════════════════════════════════════════
(40, 'Project Category Development', NULL, 'PROJECT', 'DESIGN', 'BUCKET_DIRECT_PROJ'),
(41, 'Project Category Testing', NULL, 'PROJECT', 'TEST', 'BUCKET_DIRECT_PROJ'),

-- ══════════════════════════════════════════════════
-- INDIRECT SUPPORT WORK
-- ══════════════════════════════════════════════════
(50, 'Field Support Activities', NULL, NULL, 'FIELD', 'BUCKET_INDIRECT'),
(51, 'Sales Support Activities', NULL, NULL, 'SALES', 'BUCKET_INDIRECT'),
(52, 'Sustaining Work', NULL, 'SUSTAINING', NULL, 'BUCKET_INDIRECT'),
(53, 'Support Projects', NULL, 'SUPPORT', NULL, 'BUCKET_INDIRECT'),

(60, 'Functional Project Work', NULL, 'FUNCTIONAL', NULL, 'BUCKET_INDIRECT'),
(61, 'Legacy System Support', NULL, 'LEGACY', NULL, 'BUCKET_INDIRECT'),

-- Central Engineering cross-team support
(70, 'Central Eng Cross-Team Review', 'DEPT_CENTRAL', NULL, 'REVIEW', 'BUCKET_INDIRECT'),
(71, 'Central Eng Cross-Team Meeting', 'DEPT_CENTRAL', NULL, 'MEET', 'BUCKET_INDIRECT'),

-- ══════════════════════════════════════════════════
-- GENERAL OVERHEAD (Always)
-- ══════════════════════════════════════════════════
(100, 'Training Activities', NULL, NULL, 'TRAINING', 'BUCKET_OVERHEAD'),
(101, 'Admin Work', NULL, NULL, 'ADMIN', 'BUCKET_OVERHEAD'),
(102, 'Hiring Activities', NULL, NULL, 'HIRING', 'BUCKET_OVERHEAD'),
(103, 'Time Off', NULL, NULL, 'PTO', 'BUCKET_OVERHEAD'),

(110, 'Team Task Projects', NULL, 'TEAM_TASK', NULL, 'BUCKET_OVERHEAD'),

-- ══════════════════════════════════════════════════
-- FALLBACK RULES (Lowest priority)
-- ══════════════════════════════════════════════════
(200, 'Engineering Dept Default', 'DEPT_ACM', NULL, NULL, 'BUCKET_DIRECT_PROD'),
(201, 'Central Eng Default', 'DEPT_CENTRAL', NULL, NULL, 'BUCKET_INDIRECT'),
(202, 'Sales Dept Default', 'DEPT_SALES', NULL, NULL, 'BUCKET_INDIRECT'),

(999, 'Global Fallback (Flag for Review)', NULL, NULL, NULL, 'BUCKET_OVERHEAD');
```

---

## 7. Cost Bucket Definitions

```sql
CREATE TABLE dim_cost_bucket (
    id VARCHAR(50) PRIMARY KEY,
    bucket_code VARCHAR(20) UNIQUE NOT NULL,
    bucket_name VARCHAR(100) NOT NULL,
    level1_category VARCHAR(50),    -- For rollup reporting
    level2_subcategory VARCHAR(50),
    gl_account_prefix VARCHAR(20),  -- For ERP integration
    is_capitalizable BOOLEAN,       -- GAAP compliance
    display_color VARCHAR(7),       -- UI color code
    sort_order INT
);

INSERT INTO dim_cost_bucket VALUES
-- TIER 1: Direct Product Development (Capitalizable)
('BUCKET_DIRECT_PROD', 'DIRECT_PROD', 'Direct Product Development',
 'Direct Work', 'Product Engineering', 'GL-1000', TRUE, '#22C55E', 1),

-- TIER 2: Direct Project Work (Capitalizable, lower margin)
('BUCKET_DIRECT_PROJ', 'DIRECT_PROJ', 'Direct Project Work',
 'Direct Work', 'Project Delivery', 'GL-1100', TRUE, '#84CC16', 2),

-- TIER 3: Indirect Support (Not Capitalizable)
('BUCKET_INDIRECT', 'INDIRECT', 'Indirect Support Work',
 'Indirect Work', 'Customer & Field Support', 'GL-2000', FALSE, '#F59E0B', 3),

-- TIER 4: General Overhead (Not Capitalizable)
('BUCKET_OVERHEAD', 'OVERHEAD', 'General Overhead',
 'Overhead', 'Operations & Admin', 'GL-3000', FALSE, '#94A3B8', 4),

-- SPECIAL: Unclassified (Requires Review)
('BUCKET_UNCLASSIFIED', 'UNCLASS', 'Unclassified (Review Needed)',
 'Unclassified', 'Pending Review', 'GL-9999', FALSE, '#EF4444', 99);
```

---

## 8. Reporting Queries

### 8.1 Management Summary: Cost Bucket Distribution

```sql
-- Monthly rollup by cost bucket
SELECT
    cb.bucket_name,
    cb.level1_category,
    COUNT(DISTINCT te.user_id) AS headcount,
    SUM(te.hours_logged) AS total_hours,
    SUM(te.hours_logged) / SUM(SUM(te.hours_logged)) OVER () * 100 AS pct_of_total,
    AVG(te.confidence_score) AS avg_confidence
FROM timesheet_entries te
JOIN dim_cost_bucket cb ON te.cost_bucket_id = cb.id
WHERE te.work_date >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY cb.bucket_name, cb.level1_category, cb.sort_order
ORDER BY cb.sort_order;

-- Expected Output:
-- Direct Product Development | 120 people | 9,600 hrs | 60% | 92% confidence
-- Direct Project Work        |  40 people | 2,400 hrs | 15% | 88% confidence
-- Indirect Support Work      |  80 people | 3,200 hrs | 20% | 85% confidence
-- General Overhead           | 140 people |   800 hrs |  5% | 95% confidence
```

### 8.2 Low Confidence Entries (Quality Check)

```sql
-- Find ambiguous entries that may need rule refinement
SELECT
    u.name AS user_name,
    d.department_name,
    p.name AS project_name,
    pt.name AS project_type,
    ac.name AS activity_name,
    cb.bucket_name AS classified_as,
    te.confidence_score,
    te.hours_logged,
    te.work_date
FROM timesheet_entries te
JOIN dim_user u ON te.user_id = u.id
JOIN dim_organization d ON u.department_id = d.department_id
JOIN dim_project p ON te.project_id = p.id
JOIN dim_project_type pt ON p.project_type_id = pt.id
JOIN dim_activity_code ac ON te.activity_code_id = ac.id
JOIN dim_cost_bucket cb ON te.cost_bucket_id = cb.id
WHERE te.confidence_score < 70
  AND te.work_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY te.confidence_score ASC;
```

### 8.3 Department-Level Analysis

```sql
-- Show each department's work distribution
SELECT
    d.department_name,
    cb.bucket_code,
    SUM(te.hours_logged) AS hours,
    SUM(te.hours_logged) / SUM(SUM(te.hours_logged)) OVER (PARTITION BY d.department_id) * 100 AS dept_pct
FROM timesheet_entries te
JOIN dim_user u ON te.user_id = u.id
JOIN dim_organization d ON u.department_id = d.department_id
JOIN dim_cost_bucket cb ON te.cost_bucket_id = cb.id
WHERE te.work_date >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY d.department_name, cb.bucket_code
ORDER BY d.department_name, cb.bucket_code;
```

---

## 9. Success Metrics

### 9.1 User Experience Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Avg clicks per entry | ≤ 3 | Event tracking |
| Avg time per entry | ≤ 30 sec | Page timer |
| Daily completion rate | ≥ 90% | Entries submitted / Working days |
| Mobile usage rate | ≥ 20% | Device detection |

### 9.2 Data Quality Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Avg confidence score | ≥ 85% | SQL aggregate |
| Unclassified entries | < 5% | Bucket = UNCLASSIFIED |
| Manual overrides | < 2% | `is_manual_override` flag |
| Same-day entry rate | ≥ 80% | `work_date` = `created_date` |

### 9.3 Business Value Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Direct work ratio | ≥ 70% | (DIRECT_PROD + DIRECT_PROJ) / Total |
| Overhead ratio | ≤ 10% | OVERHEAD / Total |
| Cost allocation accuracy | ≥ 95% | Audit sample validation |
| Report generation time | < 5 min | ETL pipeline duration |

---

## 10. Risk Mitigation & Edge Cases

### 10.1 Common Edge Cases

1. **Split Work**: Engineer works 4h on NPI, 4h on Support
   - **Solution**: Allow multiple entries per day
   - **UX**: "Log & Add Another" button

2. **No Project (Meeting/Training)**:
   - **Solution**: Activity codes like TRAINING, ADMIN don't require project
   - **Validation**: Only warn, don't block

3. **Cross-Department Support**: Central Eng reviews ACM's NPI
   - **Solution**: Rule priority checks `user.department ≠ project.owner_dept`
   - **Classification**: Likely → INDIRECT (support work)

4. **Travel Time**: Engineer travels to customer site
   - **Solution**: Add activity code `TRAVEL` → maps to INDIRECT or project's bucket
   - **Alternative**: Bundle with FIELD activity

5. **Partial Days (Sick, Half-day PTO)**:
   - **Solution**: Allow fractional hours (e.g., 4h PTO + 4h DESIGN)
   - **Validation**: Total ≤ 12h per day

### 10.2 Governance & Maintenance

| Risk | Mitigation |
|------|------------|
| Rules become stale | Quarterly review meeting with Finance + PM + Dept Heads |
| New project types | Template rule set for new categories |
| Org restructure | Rules use IDs (not names), but monitor for orphaned rules |
| User gaming system | Audit reports for anomalies (e.g., 100% Direct work for support team) |
| Regulatory changes | Version control for rules (effective_from/to dates) |

---

## 11. Technology Stack Recommendations

### Backend:
- **Database**: PostgreSQL 15+ (for complex JOINs and CTEs)
- **API**: FastAPI (Python) or Node.js Express
- **Classification Engine**: Python (Pandas for rule evaluation)
- **Job Scheduler**: Celery (for daily rollup jobs)

### Frontend:
- **Framework**: React + TypeScript (or Vue.js)
- **State Management**: Zustand or Redux Toolkit
- **Form Library**: React Hook Form + Zod validation
- **UI Components**: ShadCN/ui or Material-UI
- **Charts**: Recharts or Apache ECharts

### Data Warehouse (if needed):
- **OLAP**: Clickhouse or DuckDB (for fast aggregations)
- **ETL**: dbt (data build tool) for transforms
- **BI Tool**: Metabase (open source) or Tableau

---

## 12. Conclusion

This architecture achieves the "Low Friction Input, High Fidelity Output" goal through:

1. **Smart Defaults**: 80% of entries need zero customization
2. **Context-Aware Engine**: Auto-classification with 85-95% confidence
3. **Progressive Disclosure**: Simple for daily use, powerful for edge cases
4. **Audit Trail**: Every decision is explainable and traceable
5. **Continuous Improvement**: Low-confidence entries drive rule refinement

**Key Innovation**: The `allocation_rules` table acts as the "brain" - a living policy engine that separates business logic from application code, enabling non-engineers (Finance, PMs) to adjust classification rules without code deployment.

**Next Steps**:
1. Validate activity codes with 5-10 employees from different departments
2. Build prototype with 20 rules
3. Run 2-week pilot with 1 department
4. Measure: Time per entry, confidence scores, user satisfaction
5. Iterate and scale

---

**Document Version**: 1.0
**Last Updated**: 2026-01-21
**Maintained By**: Engineering Management Team
**Review Cycle**: Quarterly
