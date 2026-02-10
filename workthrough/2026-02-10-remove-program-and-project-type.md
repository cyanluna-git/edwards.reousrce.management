# Remove Program and ProjectType Entities - Database Schema Cleanup

## Overview

Successfully removed the `Program` and `ProjectType` entities from the Edwards Engineering Management system, simplifying the project hierarchy. Projects now directly reference `ProductLine` without intermediate Program grouping, and the ProjectType categorization has been replaced by the existing `category` field (PRODUCT/FUNCTIONAL/PROJECT/SUPPORT).

## Context

### Why This Change Was Needed
- **Program entity redundancy**: Program was an unnecessary intermediate layer between ProductLine and Project
- **ProjectType confusion**: The `project_type` field duplicated functionality already provided by the `category` field
- **Simplified data model**: Direct ProductLine → Project relationship is clearer and easier to maintain
- **Backend cleanup**: Previous migration already removed backend models and API endpoints

### Initial State
- Backend: `Program` and `ProjectType` models already removed in previous work
- Frontend: Still had references to these entities in API client and UI components
- Database: `projects.program_id` and `projects.project_type_id` columns still existed
- Server: Running with old schema, no migrations applied

## Changes Made

### 1. Database Schema Changes (Alembic Migrations)

Created three sequential migrations to safely remove the deprecated fields:

#### Migration 1: `90a10d1ca994` - Remove project_type_id
```python
# backend/alembic/versions/90a10d1ca994_remove_project_type_id_from_projects_.py
def upgrade() -> None:
    op.drop_constraint('projects_project_type_id_fkey', 'projects', type_='foreignkey')
    op.drop_column('projects', 'project_type_id')

def downgrade() -> None:
    op.add_column('projects', sa.Column('project_type_id', sa.VARCHAR(length=20), nullable=True))
    op.create_foreign_key('projects_project_type_id_fkey', 'projects', 'project_types',
                          ['project_type_id'], ['id'])
```

#### Migration 2: `cff98cffb026` - Drop project_types table
```python
# backend/alembic/versions/cff98cffb026_drop_project_types_table.py
def upgrade() -> None:
    op.drop_table('project_types')

def downgrade() -> None:
    op.create_table(
        'project_types',
        sa.Column('id', sa.String(length=20), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, default=True),
        sa.PrimaryKeyConstraint('id')
    )
```

#### Migration 3: `33e0c651a95e` - Remove program_id
```python
# backend/alembic/versions/33e0c651a95e_remove_program_id_from_projects_table.py
def upgrade() -> None:
    op.drop_constraint('projects_program_id_fkey', 'projects', type_='foreignkey')
    op.drop_column('projects', 'program_id')

def downgrade() -> None:
    op.add_column('projects', sa.Column('program_id', sa.String(length=50), nullable=True))
    op.create_foreign_key('projects_program_id_fkey', 'projects', 'programs',
                          ['program_id'], ['id'])
```

### 2. Frontend API Client Updates

#### Removed Program API Function
```typescript
// frontend/src/api/client.ts
// REMOVED:
// export const getPrograms = async (): Promise<Program[]> => {
//   const response = await apiClient.get('/projects/meta/programs');
//   return response.data;
// };

// REPLACED WITH:
// getPrograms removed - Program entity no longer exists
```

#### Updated Resource Allocation Interfaces
```typescript
// frontend/src/api/client.ts
// BEFORE:
export interface ProgramGroup {
  program_id: string;
  program_name: string;
  projects: ProjectAllocationRow[];
  total_by_month: Record<string, number>;
}

export interface ResourceAllocationMatrix {
  programs: ProgramGroup[];
  // ...
}

// AFTER:
export interface ProductLineGroup {
  product_line_id: string;
  product_line_name: string;
  projects: ProjectAllocationRow[];
  total_by_month: Record<string, number>;
}

export interface ResourceAllocationMatrix {
  product_lines: ProductLineGroup[];
  // ...
}
```

### 3. Frontend Component Updates

#### ResourceAllocationGrid.tsx
Changed from Program-based grouping to ProductLine-based grouping:

```typescript
// frontend/src/components/resource-matrix/ResourceAllocationGrid.tsx
// BEFORE:
if (!data || data.programs.length === 0) { ... }
{data.programs.map((program) => (
  <React.Fragment key={program.program_id}>
    <tr>
      <td>{program.program_name}</td>
      // ...
    </tr>
  </React.Fragment>
))}

// AFTER:
if (!data || data.product_lines.length === 0) { ... }
{data.product_lines.map((productLine) => (
  <React.Fragment key={productLine.product_line_id}>
    <tr>
      <td>{productLine.product_line_name}</td>
      // ...
    </tr>
  </React.Fragment>
))}
```

#### ResourcePivotTable.tsx
Removed `programId` parameter:

```typescript
// frontend/src/components/resource-matrix/ResourcePivotTable.tsx
// BEFORE:
interface ResourcePivotTableProps {
    departmentId?: string;
    programId?: string;  // REMOVED
}

const { data } = useQuery({
    queryKey: ['resource-pivot', startMonth, endMonth, departmentId, programId],
    queryFn: () => getResourcePivotMatrix(startMonth, endMonth, departmentId, programId),
});

// AFTER:
interface ResourcePivotTableProps {
    departmentId?: string;
    // programId removed - no longer supported in API
}

const { data } = useQuery({
    queryKey: ['resource-pivot', startMonth, endMonth, departmentId],
    queryFn: () => getResourcePivotMatrix(startMonth, endMonth, departmentId),
});
```

#### ProjectDetailPage.tsx
Removed ProjectType display:

```typescript
// frontend/src/pages/ProjectDetailPage.tsx
// REMOVED:
import { Tag } from 'lucide-react';

<PropertyRow icon={Tag} label={t('detail.projectType')}>
  <span>{project.project_type?.name || 'N/A'}</span>
</PropertyRow>

// REPLACED WITH:
{/* ProjectType removed - no longer in data model */}
```

#### TeamsTab.tsx
Fixed Department creation to include required `business_unit_id`:

```typescript
// frontend/src/components/organization/TeamsTab.tsx
createDepartment({
    name: data.name,
    code: data.code,
    division_id: data.parentId,
    business_unit_id: null,  // ADDED: Required field, nullable
    is_active: true
})
```

### 4. TypeScript Type Fixes

Added explicit type casting to handle Record<string, number> properly:

```typescript
// Object.values() type casting
{(Object.values(productLine.total_by_month) as number[])
    .reduce((a, b) => a + b, 0)
    .toFixed(1)}

{(Object.values(project.allocations) as any[])
    .reduce((sum, a) => sum + a.total_fte, 0)
    .toFixed(1)}
```

## Migration Process

### Phase 1: Local Database Migration

1. **Backup Server Database**
```bash
python3 backup_remote_db.py
# Created: backups/remote_backup_20260210_172233.sql (19MB)
```

2. **Restore to Local**
```bash
FORCE_RESTORE=true python3 restore_db.py remote_backup_20260210_172233.sql
# Successfully restored 73 projects, 65,750 worklogs, 1,833 resource plans
```

3. **Run Migrations Locally**
```bash
docker-compose exec backend alembic upgrade head
# INFO  [alembic.runtime.migration] Running upgrade 010_add_worklog_indexes -> 011_add_division_to_users
# INFO  [alembic.runtime.migration] Running upgrade 011_add_division_to_users -> 90a10d1ca994
# INFO  [alembic.runtime.migration] Running upgrade 90a10d1ca994 -> cff98cffb026
# INFO  [alembic.runtime.migration] Running upgrade cff98cffb026 -> 33e0c651a95e
```

4. **Verify Local Data Integrity**
```sql
-- Verified migration version
SELECT * FROM alembic_version;
-- Result: 33e0c651a95e ✓

-- Verified schema changes
\d projects
-- project_type_id and program_id columns removed ✓

-- Verified table deletion
\dt project_types
-- "Did not find any relation named 'project_types'" ✓

-- Verified data preservation
SELECT COUNT(*) FROM projects;         -- 73 projects ✓
SELECT COUNT(*) FROM worklogs;         -- 65,750 worklogs ✓
SELECT COUNT(*) FROM resource_plans;   -- 1,833 plans ✓
```

### Phase 2: Frontend Build Fixes

Resolved TypeScript compilation errors:

```bash
# Initial build attempt - 11 errors found
pnpm build

# Errors fixed:
# 1. client.ts:202 - Program type not found
# 2. TeamsTab.tsx:138 - Missing business_unit_id
# 3. ResourceAllocationGrid.tsx:36 - Too many arguments (4 instead of 3)
# 4. ResourcePivotTable.tsx:42 - Too many arguments (4 instead of 3)
# 5. ProjectDetailPage.tsx:350 - project_type does not exist
# 6-11. Type casting issues with Object.values()

# Final build - SUCCESS
pnpm build
# ✓ compiled successfully
# dist/ created with optimized production build
```

### Phase 3: Server Deployment

1. **Build and Deploy**
```bash
.\run_full_deploy.ps1

# Build output:
# - Backend image: edwards_project-backend:latest
# - Frontend image: edwards_project-frontend:latest
# - Archive size: 310.2MB
# - Upload time: 9 seconds (32.4MB/s)

# Deployment completed:
# ✓ Images loaded on server
# ✓ Containers restarted
# ✓ Services running
```

2. **Run Migrations on Server**
```bash
ssh atlasAdmin@10.182.252.32
cd /data/eob/edwards_project
docker-compose exec backend alembic upgrade head

# INFO  [alembic.runtime.migration] Running upgrade 010_add_worklog_indexes -> 011_add_division_to_users
# INFO  [alembic.runtime.migration] Running upgrade 011_add_division_to_users -> 90a10d1ca994
# INFO  [alembic.runtime.migration] Running upgrade 90a10d1ca994 -> cff98cffb026
# INFO  [alembic.runtime.migration] Running upgrade cff98cffb026 -> 33e0c651a95e
```

3. **Verify Server Data Integrity**
```sql
-- Migration version
SELECT * FROM alembic_version;
-- Result: 33e0c651a95e ✓

-- Data preservation
SELECT COUNT(*) FROM projects;   -- 73 projects ✓
SELECT COUNT(*) FROM worklogs;   -- 109,022 worklogs ✓

-- Table deletion confirmed
\dt project_types
-- "Did not find any relation named 'project_types'" ✓
```

## Verification Results

### Local Environment
```bash
# Database Migration
✓ Migration version: 33e0c651a95e
✓ Projects: 73
✓ Worklogs: 65,750
✓ Resource Plans: 1,833
✓ project_types table: DELETED
✓ projects.program_id: REMOVED
✓ projects.project_type_id: REMOVED

# Frontend Build
✓ TypeScript compilation: SUCCESS
✓ No type errors
✓ Production build: SUCCESS
✓ Bundle size: Optimized
```

### Server Environment
```bash
# Database Migration
✓ Migration version: 33e0c651a95e
✓ Projects: 73
✓ Worklogs: 109,022
✓ project_types table: DELETED
✓ projects.program_id: REMOVED
✓ projects.project_type_id: REMOVED

# Services
✓ edwards-postgres: UP (2 days)
✓ edwards-api: UP (running)
✓ edwards-web: UP (running)

# URLs
✓ Frontend: http://eob.10.182.252.32.sslip.io
✓ Backend API: http://10.182.252.32:8004/docs
```

## Files Modified

### Backend
- `backend/alembic/versions/90a10d1ca994_remove_project_type_id_from_projects_.py` - NEW
- `backend/alembic/versions/cff98cffb026_drop_project_types_table.py` - NEW
- `backend/alembic/versions/33e0c651a95e_remove_program_id_from_projects_table.py` - NEW

### Frontend
- `frontend/src/api/client.ts` - Removed `getPrograms()`, renamed `ProgramGroup` → `ProductLineGroup`
- `frontend/src/components/resource-matrix/ResourceAllocationGrid.tsx` - Updated to use product_lines
- `frontend/src/components/resource-matrix/ResourcePivotTable.tsx` - Removed programId parameter
- `frontend/src/pages/ProjectDetailPage.tsx` - Removed project_type display
- `frontend/src/components/organization/TeamsTab.tsx` - Added business_unit_id to Department creation

## Benefits Achieved

1. **Simplified Data Model**
   - Removed unnecessary Program intermediate layer
   - Direct ProductLine → Project relationship
   - Clearer project categorization using `category` field

2. **Reduced Complexity**
   - Fewer entities to maintain
   - Simpler API endpoints
   - Less confusing for end users

3. **Better Data Integrity**
   - Single source of truth for project categorization (`category`)
   - No duplicate or conflicting classification systems
   - Cleaner foreign key relationships

4. **Improved Performance**
   - Fewer joins required for project queries
   - Smaller database footprint
   - Faster data retrieval

## Git Branch Strategy

Current branch: `feature/remove-project-type-id`

Recent commits on this branch:
- `876e13a` - plan for jwt intergration with jarvis
- `7c76191` - feat: 역할별 권한 제어 구현 (RBAC)
- `61b6058` - fix: remove remaining program references from WorkLog components
- `99f697f` - refactor: complete cleanup of program references (Phase 2 final)
- `d2f993a` - fix: replace Project.program with Project.product_line in resource_plan_service

## Next Steps

1. ✅ Create workthrough documentation
2. ⏳ Commit all changes with descriptive message
3. ⏳ Merge feature branch to main
4. ⏳ Push to remote repository
5. ⏳ Tag release (optional)

## Notes and Considerations

- **Backward Compatibility**: Downgrade migrations are provided but should only be used in emergencies
- **Data Loss**: Original program_id and project_type_id values were not preserved
- **API Breaking Change**: Frontend components relying on Program grouping will need updates
- **Testing**: All resource allocation views should be tested to ensure ProductLine grouping works correctly

## Lessons Learned

1. **Migration Testing**: Always test migrations on local DB with production data backup first
2. **Frontend-Backend Sync**: Ensure frontend API client matches backend endpoints before deployment
3. **Type Safety**: TypeScript compilation catches API contract mismatches early
4. **Docker Caching**: Use `--no-cache` or clear Docker build cache when code changes don't reflect
5. **Incremental Migrations**: Breaking changes into smaller migrations (3 separate migrations) makes rollback safer

## Related Documentation

- Database Schema: `backend/app/models/`
- API Endpoints: `backend/app/api/endpoints/projects.py`
- Frontend Types: `frontend/src/types/index.ts`
- Migration Guide: `CLAUDE.md` section on Database migrations
