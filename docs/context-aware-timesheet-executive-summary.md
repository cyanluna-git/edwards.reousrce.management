# Context-Aware Timesheet System - Executive Summary

**Problem**: Employees face complex timesheet entry with 8-10 clicks, causing fatigue and data errors. Management needs granular cost allocation (Direct vs. Indirect vs. Overhead) but can't burden users.

**Solution**: Context-aware classification engine that auto-classifies work based on employee context (department, team, role) + project attributes + activity type.

---

## The Challenge: Input vs. Output Tension

```
┌───────────────────────────────────────────────────────────────┐
│                    THE DILEMMA                                │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  USER WANTS:              vs.      MANAGEMENT NEEDS:          │
│  ───────────                       ──────────────             │
│                                                               │
│  ✅ 2-3 clicks                     ✅ 4-tier cost buckets    │
│  ✅ 30 seconds per entry           ✅ Direct vs. Indirect     │
│  ✅ No complex dropdowns           ✅ Product vs. Project     │
│  ✅ Mobile-friendly                ✅ GAAP compliance          │
│  ✅ Smart defaults                 ✅ Real-time reporting     │
│                                                               │
│  ❌ CANNOT HAVE BOTH... OR CAN WE? ✅                         │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## The Solution: Context-Aware Classification

### User Experience (Simplified Input)

```
┌────────────────────────────────────────┐
│  Quick Log - January 21, 2026          │
├────────────────────────────────────────┤
│                                        │
│  Project:  [ACM NPI 407056 ▼]         │  ← Smart default: Your primary project
│                                        │
│  Activity: [🎨 DESIGN]                 │  ← Quick buttons (4 most-used)
│            [🧪 TEST] [💬 MEET]         │
│                                        │
│  Hours:    [8.0]                       │  ← Pre-filled: Full day
│                                        │
│  ┌──────────────────────────────────┐ │
│  │ 💡 Auto: Direct Product (95%)    │ │  ← Real-time feedback
│  │    Rule: NPI Design Work         │ │
│  └──────────────────────────────────┘ │
│                                        │
│  [Quick Log] [+ Add Another]           │
│                                        │
└────────────────────────────────────────┘

Result: 2 clicks (if defaults are good)
Time: <30 seconds per entry
```

### Management View (Granular Output)

```
┌─────────────────────────────────────────────────────────────┐
│  Cost Allocation Report - January 2026                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🟢 Direct Product Development  ████████████░░  65%  6,800h│
│     ↳ NPI, ETO, Product R&D (Capitalizable)                │
│                                                             │
│  🟡 Direct Project Work         ███░░░░░░░░░░  13%  1,400h│
│     ↳ Customer-specific projects (Lower margin)            │
│                                                             │
│  🟠 Indirect Support Work       ████░░░░░░░░░  17%  1,800h│
│     ↳ Field support, Sales support, Sustaining             │
│                                                             │
│  ⚪ General Overhead            █░░░░░░░░░░░░   5%    460h│
│     ↳ Training, Admin, PTO                                 │
│                                                             │
│  Target: 70% Direct | 10% Overhead                         │
│  Status: ✅ On track                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Result: 95%+ auto-classification accuracy
Confidence: Average 87%
```

---

## How It Works: The Classification Engine

### Step 1: Capture Context

```
When user logs time, system captures:

┌─────────────────────────────────────────────────────────────┐
│  WHO (User Context)                                         │
│  ├─ Department: ACM Engineering                             │
│  ├─ Sub Team: Control Engineering                           │
│  └─ Role: Senior Engineer                                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  WHERE (Project Context)                                    │
│  ├─ Project Type: NPI                                       │
│  ├─ Category: PRODUCT                                       │
│  └─ Owner Dept: ACM                                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  WHAT (Activity)                                            │
│  ├─ Activity Code: DESIGN                                   │
│  └─ Category: DEVELOPMENT                                   │
└─────────────────────────────────────────────────────────────┘
```

### Step 2: Match Against Rules

```
Allocation Rules (Priority-Based, First Match Wins):

Priority 10: IF Project.Type = NPI AND Activity = DESIGN
             THEN → DIRECT_PRODUCT (Confidence: 95%)

Priority 20: IF Project.Type = ETO AND Activity = TEST
             THEN → DIRECT_PRODUCT (Confidence: 95%)

Priority 50: IF Activity = FIELD_SUPPORT
             THEN → INDIRECT (Confidence: 90%)

Priority 100: IF Activity = TRAINING
              THEN → OVERHEAD (Confidence: 100%)

Priority 999: ELSE → UNCLASSIFIED (Flag for review)
```

### Step 3: Auto-Classify & Store

```sql
-- Happens automatically via database trigger
INSERT INTO timesheet_entries (user_id, project_id, activity_code_id, hours)
VALUES ('user-123', 'proj-456', 'ACT_DESIGN', 8.0);

-- Trigger fires → Classification function runs → Result stored:
-- ├─ cost_bucket_id: 'BUCKET_DIRECT_PROD'
-- ├─ allocation_rule_id: 10
-- ├─ confidence_score: 95
-- └─ is_manual_override: FALSE
```

---

## Key Innovation: The "Allocation Rules" Table

This is the **brain** of the system - a living policy engine.

```
┌─────────────────────────────────────────────────────────────┐
│  allocation_rules (Configurable Business Logic)             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  MATCH CONDITIONS (Nullable = Wildcard):                    │
│  ├─ user_department_id         (e.g., DEPT_ACM)            │
│  ├─ user_sub_team_id           (e.g., ST_ACM_CTRL)         │
│  ├─ project_type_id            (e.g., NPI)                 │
│  ├─ project_category           (e.g., PRODUCT)             │
│  ├─ activity_code_id           (e.g., ACT_DESIGN)          │
│  └─ activity_category          (e.g., DEVELOPMENT)         │
│                                                             │
│  ALLOCATION OUTPUT:                                         │
│  └─ target_cost_bucket_id      (e.g., DIRECT_PROD)         │
│                                                             │
│  METADATA:                                                  │
│  ├─ rule_priority (10-999)     ← Evaluation order          │
│  ├─ effective_from / to        ← Temporal rules            │
│  └─ is_active                  ← Enable/disable            │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Benefits:
✅ No code deployment to change logic
✅ Finance/PMs can adjust rules via admin UI
✅ Rules versioned with effective dates
✅ Audit trail: Every decision is explainable
```

---

## Real-World Examples

### Example 1: Direct Product Work

```
Scenario: ACM Engineer working on NPI design

Input:
├─ User: Aaron Oh (DEPT_ACM, ST_ACM_CTRL)
├─ Project: 407056 (Type: NPI, Category: PRODUCT)
├─ Activity: DESIGN
└─ Hours: 8.0

Classification:
├─ Matched Rule #10: "NPI Design Work"
├─ Cost Bucket: DIRECT_PRODUCT
├─ Confidence: 95%
└─ Reasoning: Core product R&D work
```

### Example 2: Indirect Support

```
Scenario: Same engineer doing field support

Input:
├─ User: Aaron Oh (DEPT_ACM, ST_ACM_CTRL)
├─ Project: 407111 (Type: SUPPORT)
├─ Activity: FIELD
└─ Hours: 4.0

Classification:
├─ Matched Rule #50: "Field Support Activities"
├─ Cost Bucket: INDIRECT
├─ Confidence: 90%
└─ Reasoning: Customer support work
```

### Example 3: Overhead

```
Scenario: Engineer attending training

Input:
├─ User: Aaron Oh (DEPT_ACM, ST_ACM_CTRL)
├─ Project: (None)
├─ Activity: TRAINING
└─ Hours: 8.0

Classification:
├─ Matched Rule #100: "Training Activities"
├─ Cost Bucket: OVERHEAD
├─ Confidence: 100%
└─ Reasoning: Employee development
```

### Example 4: Ambiguous (Needs Review)

```
Scenario: Meeting without project context

Input:
├─ User: Aaron Oh (DEPT_ACM, ST_ACM_CTRL)
├─ Project: (None)
├─ Activity: MEETING
└─ Hours: 2.0

Classification:
├─ Matched Rule #999: "Global Fallback"
├─ Cost Bucket: OVERHEAD (fallback)
├─ Confidence: 40% ⚠️
└─ Action: Flag for review, suggest adding project
```

---

## The 15 Activity Codes (What Users See)

Designed to be:
- **Mutually Exclusive**: No overlap
- **Short**: 15 codes (not 50)
- **User Language**: Terms engineers actually use
- **Stable**: Rarely change

```
DEVELOPMENT (Direct Work)
├─ 🎨 DESIGN    - Design & Development
├─ 🧪 TEST      - Testing & Validation
├─ 📝 DOC       - Documentation
└─ 🚀 RELEASE   - Release & Deployment

COLLABORATION (Context-Dependent)
├─ 💬 MEET      - Meeting & Discussion
├─ 📋 REVIEW    - Design Review & Approval
└─ 📊 PLAN      - Planning & Estimation

SUPPORT (Indirect Work)
├─ 🔧 FIELD     - Field Support
├─ 💼 SALES     - Sales Support
├─ 🐛 SUSTAIN   - Sustaining (Bug Fix)
└─ 🔍 TRIAGE    - Issue Investigation

OVERHEAD (General)
├─ 📁 ADMIN     - Admin & Process Work
├─ 📚 TRAINING  - Training & Learning
├─ 👥 HIRING    - Recruiting & Interviews
└─ 🌴 PTO       - Time Off
```

---

## The 4 Cost Buckets (What Management Sees)

```
┌─────────────────────────────────────────────────────────────┐
│  🟢 DIRECT_PRODUCT (Target: 60-70%)                         │
├─────────────────────────────────────────────────────────────┤
│  ✅ Capitalizable (GAAP)                                     │
│  ✅ High-margin work                                         │
│  Examples:                                                  │
│  ├─ NPI design, testing, documentation                      │
│  ├─ ETO product development                                 │
│  └─ Core R&D activities                                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  🟡 DIRECT_PROJECT (Target: 10-15%)                         │
├─────────────────────────────────────────────────────────────┤
│  ✅ Capitalizable (GAAP)                                     │
│  ⚠️ Lower margin                                             │
│  Examples:                                                  │
│  ├─ Customer-specific projects                              │
│  ├─ Custom engineering work                                 │
│  └─ Lower-margin delivery                                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  🟠 INDIRECT (Target: 15-20%)                               │
├─────────────────────────────────────────────────────────────┤
│  ❌ Not capitalizable                                        │
│  Examples:                                                  │
│  ├─ Field support, customer troubleshooting                 │
│  ├─ Sales support, demos, RFPs                              │
│  ├─ Sustaining engineering, bug fixes                       │
│  └─ Cross-team support                                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ⚪ OVERHEAD (Target: <10%)                                 │
├─────────────────────────────────────────────────────────────┤
│  ❌ Not capitalizable                                        │
│  Examples:                                                  │
│  ├─ Training, certifications                                │
│  ├─ Admin work, reporting                                   │
│  ├─ Hiring, interviews                                      │
│  └─ PTO, vacation                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Business Benefits

### For Employees
- ✅ **2-3 clicks** per entry (vs. 8-10 in traditional systems)
- ✅ **Smart defaults** based on their recent work
- ✅ **No training needed** - interface is self-explanatory
- ✅ **Mobile-friendly** for field engineers
- ✅ **Real-time feedback** shows classification preview

### For Management
- ✅ **95%+ accuracy** on cost allocation
- ✅ **Real-time dashboards** (no waiting for month-end)
- ✅ **GAAP compliance** (capitalizable flagging)
- ✅ **Granular reporting** by department, team, project
- ✅ **Trend analysis** (stable activity codes over time)

### For Finance
- ✅ **Audit trail** - every decision is explainable
- ✅ **Rule versioning** - temporal changes tracked
- ✅ **ERP integration** - GL account mapping built-in
- ✅ **Quality metrics** - confidence scores highlight ambiguous entries

### For System Admins
- ✅ **No code deployment** to change business logic
- ✅ **Rule-based engine** - adjust via admin UI
- ✅ **Scalable** - add new projects/departments without code changes
- ✅ **Self-healing** - low-confidence entries drive rule refinement

---

## Success Metrics

| Metric | Baseline | Target | Measured How |
|--------|----------|--------|--------------|
| **UX: Clicks per entry** | 8-10 | ≤3 | Event tracking |
| **UX: Time per entry** | 2-3 min | <30 sec | Page timer |
| **UX: Daily completion** | 60% | ≥90% | Entries / days |
| **Quality: Avg confidence** | N/A | ≥85% | SQL aggregate |
| **Quality: Unclassified** | N/A | <5% | Bucket count |
| **Quality: Manual overrides** | N/A | <2% | Override flag |
| **Business: Direct work ratio** | Unknown | ≥70% | Cost bucket % |
| **Business: Overhead ratio** | Unknown | ≤10% | Cost bucket % |

---

## Implementation Timeline

### Phase 1: Foundation (Weeks 1-2) ✅
- [x] Database schema design
- [x] Activity codes defined
- [x] Cost buckets created
- [x] 30 starter rules loaded

### Phase 2: Core Engine (Weeks 3-4)
- [ ] Classification function tested
- [ ] Auto-classification trigger working
- [ ] REST API endpoints built
- [ ] Admin UI for rule management

### Phase 3: User Interface (Weeks 5-6)
- [ ] Smart defaults implemented
- [ ] Real-time classification preview
- [ ] Mobile-responsive form
- [ ] Quick-log templates

### Phase 4: Pilot (Weeks 7-8)
- [ ] 2-week pilot with 1 department
- [ ] Measure: clicks, time, confidence
- [ ] Gather user feedback
- [ ] Refine rules

### Phase 5: Scale (Weeks 9-12)
- [ ] Roll out to all departments
- [ ] Management dashboards live
- [ ] Monthly review process established
- [ ] Training materials created

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Rules become stale | Quarterly review meetings + low-confidence alerts |
| Org restructure | Use IDs (not names) + monitor for orphaned rules |
| Users game system | Anomaly detection (e.g., 100% Direct for support team) |
| New project types | Template rule sets for quick onboarding |
| Regulatory changes | Rule versioning with effective dates |
| Low adoption | Mobile app + gamification (leaderboards) |

---

## Next Steps

1. **Review** the architecture document: `context-aware-timesheet-architecture.md`
2. **Test** SQL scripts on dev database: `sql-implementation-*.sql`
3. **Validate** activity codes with 5-10 employees
4. **Build** UI prototype with real-time classification
5. **Run** 2-week pilot with one department
6. **Measure** success metrics
7. **Iterate** and scale

---

## Questions?

**Architecture**: See `context-aware-timesheet-architecture.md` (62 pages)
**Quick Start**: See `context-aware-timesheet-quickstart.md` (testing guide)
**SQL Scripts**: `sql-implementation-activity-codes.sql`, `sql-implementation-allocation-rules.sql`

**Contact**: Engineering Management Team

---

**Document Version**: 1.0
**Last Updated**: 2026-01-21
**Status**: ✅ Design Complete, Ready for Implementation
