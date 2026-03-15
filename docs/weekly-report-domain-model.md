# Weekly Report Domain Model

## Goal

Define one canonical storage and identity model for weekly reports so personal, team, and sub-team reports can be written and read inside EOB using the same contract.

This document is the design baseline for:

- `#933` backend CRUD API and permission rules
- `#934` personal dashboard markdown editor
- `#935` team and sub-team dashboard report UI

## Scope

Included in this design:

- Personal weekly report
- Team weekly report
- Sub-team weekly report
- Current in-progress week editing
- Markdown source storage
- Preview/render strategy
- Proxy writing traceability
- Future extension point for auto-generated team drafts

Not included in v1:

- Image/blob attachments
- Confluence sync
- Approval workflow
- Rich comments
- Public sharing

## Design Principles

1. One report aggregate for every report type.
2. Week identity must be deterministic and server-authoritative.
3. Personal and organizational reports are separate documents, not different views of one row.
4. Markdown source is the canonical content.
5. Proxy writing must be auditable.
6. The schema should leave room for later personal-to-team auto-draft generation without a reset.

## Recommended Aggregate

Use a single `weekly_reports` table.

Reason:

- avoids separate CRUD paths for personal/team/sub-team reports
- keeps history queries and dashboard widgets consistent
- allows future expansion to other org scopes without changing the basic contract

## Core Identity Model

### 1. Report Scope

Use two fields for semantic meaning plus one normalized key for uniqueness:

- `scope`: `user` | `team`
- `team_scope_type`: `department` | `sub_team` | `null`
- `scope_id`: raw identifier of the target entity

Examples:

- Personal report: `scope=user`, `team_scope_type=null`, `scope_id=<user_id>`
- Team report: `scope=team`, `team_scope_type=department`, `scope_id=<department_id>`
- Sub-team report: `scope=team`, `team_scope_type=sub_team`, `scope_id=<sub_team_id>`

### 2. Normalized Target Key

Add a non-null `target_key` column.

Examples:

- `user:6dd0...`
- `department:DEP_SW`
- `sub_team:SUB_SW_PLATFORM`

`target_key` exists to solve uniqueness cleanly across mixed scope types. Do not rely on a nullable composite unique key using `team_scope_type`, because PostgreSQL treats `NULL` as distinct in unique indexes.

### 3. Week Identity

Persist explicit Monday-Sunday dates:

- `week_start` (`date`, Monday)
- `week_end` (`date`, Sunday)
- `week_key` (`string`, format `YYYY-Www`)

Examples:

- `week_start=2026-03-09`
- `week_end=2026-03-15`
- `week_key=2026-W11`

`week_key` is for display and filtering convenience. `week_start` is the canonical identity field for uniqueness.

## Current Week Semantics

The product must allow writing during the current in-progress week.

Rules:

- the server computes the authoritative week window from a requested date or from `today`
- the current week uses the same row as past weeks
- the report is edited in place during the week
- `is_in_progress` should be derived at read time from `week_start`, `week_end`, and `today`
- do not persist `is_in_progress` as a stored column in v1

This keeps storage simple and avoids stale boolean state.

## Recommended Table Shape

Suggested columns:

| Column | Type | Required | Notes |
|---|---|---:|---|
| `id` | `String(36)` UUID | yes | primary key |
| `scope` | `String(20)` | yes | `user` or `team` |
| `team_scope_type` | `String(20)` | no | `department`, `sub_team`, null for personal |
| `scope_id` | `String(50)` | yes | target user/department/sub-team id |
| `target_key` | `String(80)` | yes | normalized identity key |
| `week_start` | `Date` | yes | Monday |
| `week_end` | `Date` | yes | Sunday |
| `week_key` | `String(10)` | yes | display/filter helper |
| `status` | `String(20)` | yes | `draft` or `published`, default `draft` |
| `title` | `String(200)` | no | optional custom title, else derived from scope/week |
| `markdown_body` | `Text` | yes | canonical source |
| `owner_user_id` | `String(36)` | no | required for personal report, optional accountable owner for team report |
| `created_by_user_id` | `String(36)` | yes | first author |
| `updated_by_user_id` | `String(36)` | yes | last editor |
| `published_by_user_id` | `String(36)` | no | last publisher |
| `published_at` | `DateTime` | no | set when published |
| `source_metadata` | `JSONB` | no | reserved for future draft lineage |
| `created_at` | `DateTime` | yes | audit |
| `updated_at` | `DateTime` | yes | audit |

### Why `status` Exists in v1

Even though approval workflow is out of scope, the schema should support a minimal `draft/published` distinction now.

Reason:

- weekly reports usually move from in-progress writing to a shareable state
- adding this later would force API and UI contract churn
- it remains simple enough for v1 because there is no approval chain

If schedule pressure is high in `#934/#935`, the UI can expose only Save first and treat everything as `draft`, while the backend still keeps the column.

## Uniqueness Rule

V1 should allow only one active report document per target and week.

Recommended unique index:

```sql
UNIQUE (target_key, week_start)
```

Meaning:

- one personal report per user per week
- one team report per department per week
- one sub-team report per sub-team per week

V1 should not create multiple versions as separate rows. Edit the same row in place.

If revision history is needed later, add a separate `weekly_report_revisions` table instead of weakening this uniqueness rule.

## Ownership and Proxy Writing

The product must support proxy writing when a team lead is absent.

### Required Audit Fields

- `created_by_user_id`
- `updated_by_user_id`
- optional `owner_user_id`

Interpretation:

- `owner_user_id`: who the report is primarily about or who is nominally accountable
- `created_by_user_id`: who first created the report row
- `updated_by_user_id`: who last edited the report

### Proxy Rule

Proxy writing is inferred when:

- `owner_user_id` is set and `updated_by_user_id != owner_user_id`

This is sufficient for v1 traceability without introducing an explicit delegation workflow table.

For personal reports:

- `owner_user_id` should equal the target user

For team and sub-team reports:

- `owner_user_id` may be null
- if the org wants a named accountable editor later, it can point to a lead or delegate

## Markdown and Preview Model

Canonical content:

- store raw markdown only in `markdown_body`

Preview strategy:

- editor preview is generated client-side from `markdown_body`
- no rendered HTML is persisted in v1
- if server-rendered HTML becomes necessary later, return it as a derived response field or cache it separately

Reason:

- keeps editing source canonical
- avoids stale HTML cache invalidation
- minimizes schema and sanitization complexity in v1

## Suggested SQLAlchemy Model Sketch

```python
class WeeklyReport(Base):
    __tablename__ = "weekly_reports"

    id = Column(String(36), primary_key=True)
    scope = Column(String(20), nullable=False)  # user | team
    team_scope_type = Column(String(20), nullable=True)  # department | sub_team | NULL
    scope_id = Column(String(50), nullable=False)
    target_key = Column(String(80), nullable=False, unique=False, index=True)

    week_start = Column(Date, nullable=False)
    week_end = Column(Date, nullable=False)
    week_key = Column(String(10), nullable=False)

    status = Column(String(20), nullable=False, default="draft")
    title = Column(String(200), nullable=True)
    markdown_body = Column(Text, nullable=False, default="")
    source_metadata = Column(JSONB, nullable=True)

    owner_user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    created_by_user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    updated_by_user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    published_by_user_id = Column(String(36), ForeignKey("users.id"), nullable=True)

    published_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("target_key", "week_start", name="uq_weekly_reports_target_week"),
        Index("ix_weekly_reports_scope_week", "scope", "team_scope_type", "scope_id", "week_start"),
    )
```

## API Contract Guidance for `#933`

### Create or Update

Prefer an upsert-style endpoint keyed by target + week:

`PUT /weekly-reports`

Request shape:

```json
{
  "scope": "team",
  "team_scope_type": "department",
  "scope_id": "DEP_SW",
  "week_start": "2026-03-09",
  "markdown_body": "## Highlights\n...",
  "status": "draft",
  "title": "Software Team Weekly Report"
}
```

Server responsibilities:

- normalize `target_key`
- validate `week_start` is Monday
- derive `week_end`
- derive `week_key`
- create row if absent, else update existing row
- fill `created_by_user_id` / `updated_by_user_id`

### Read

`GET /weekly-reports/current`

Purpose:

- fetch current in-progress week report for the dashboard context

Suggested query:

- `scope`
- `team_scope_type`
- `scope_id`
- optional `reference_date`

### History

`GET /weekly-reports/history`

Suggested query:

- same target fields
- `limit`
- optional `before_week_start`

### Response Fields

Minimum response:

```json
{
  "id": "uuid",
  "scope": "team",
  "team_scope_type": "department",
  "scope_id": "DEP_SW",
  "target_key": "department:DEP_SW",
  "week_start": "2026-03-09",
  "week_end": "2026-03-15",
  "week_key": "2026-W11",
  "is_in_progress": true,
  "status": "draft",
  "title": "Software Team Weekly Report",
  "markdown_body": "## Highlights\n...",
  "owner_user_id": null,
  "created_by_user_id": "user-a",
  "updated_by_user_id": "user-b",
  "published_at": null,
  "created_at": "2026-03-13T08:00:00Z",
  "updated_at": "2026-03-15T09:20:00Z"
}
```

## Permission Guidance for `#933`

### Personal Report

- write: self
- read: self
- optional later expansion: manager/admin read

### Team Report

- write: any member in the target department, plus admin
- read: any member in the target department, plus admin

### Sub-Team Report

- write: any member in the target sub-team, plus admin
- read: any member in the target sub-team, plus admin

This matches the requirement that a regular team member can write the team report when the lead is absent.

## UI Guidance for `#934` and `#935`

### Personal Dashboard

- show current-week report card
- open markdown editor dialog or side panel
- support edit and preview tabs
- show last updated metadata

### Team Dashboard

- show one team report widget matching the selected team dashboard scope
- for `department` scope, use department report
- for `sub_team` scope, use sub-team report
- do not auto-merge department and sub-team documents in v1

### Current Week Label

UI should always show:

- relative label: `This Week`
- absolute range: `2026-03-09 ~ 2026-03-15`

## Relationship Between Personal and Team Reports

Personal and team reports are separate rows.

V1 rules:

- no automatic aggregation
- no hard foreign-key link between personal and team reports
- same week can have many personal reports plus one team report plus one sub-team report

Future direction:

- `source_metadata` may later reference personal report ids used for a generated team draft

## Deferred Items

Explicitly defer these to later tasks:

- attachments/blob references
- revision history table
- approval chain
- comments and reactions
- Confluence export/sync
- AI-generated first draft from worklogs or personal reports

## Final Recommendation

Adopt a single `weekly_reports` table with:

- `target_key + week_start` uniqueness
- `scope/team_scope_type/scope_id` semantic identity
- raw markdown as canonical content
- minimal `draft/published` state
- audit fields for proxy writing
- optional `source_metadata` for later automation lineage

This gives the next implementation tasks a stable contract without over-designing v1.
