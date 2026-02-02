# Pivot Table Error Fix & Row Grouping Implementation

## Overview
Fixed a 500 Internal Server Error in the Resource Matrix Pivot API and implemented hierarchical row grouping (Department -> SubTeam) with collapse/expand functionality in the frontend.

## Context
1.  **500 Error**: The Pivot API was failing with a 500 error due to an SQLAlchemy query issue (string-based `joinedload`) incompatibile with the updated SQLAlchemy version.
2.  **Row Grouping**: The user requested a feature to organize the Pivot Table rows by Department and Sub-team to better manage large lists of resources, including the ability to collapse and expand these groups.

## Changes Made

### 1. Backend: Fixed SQLAlchemy Query Error
*   **File**: `backend/app/services/resource_matrix_service.py`
*   **Issue**: `joinedload("recharge_mappings")` caused a mapper error.
*   **Fix**: Converted string references to class-bound attributes (e.g., `joinedload(Project.recharge_mappings)`).

### 2. Backend: Added SubTeam Support
*   **File**: `backend/app/schemas/resource_matrix.py`
    *   Added `sub_team_name` field to `PivotRow` schema.
*   **File**: `backend/app/services/resource_matrix_service.py`
    *   Added `joinedload(User.sub_team)` to the main query.
    *   Populated `sub_team_name` in the `PivotRow` construction logic.

### 3. Frontend: Updated API Types
*   **File**: `frontend/src/api/client.ts`
    *   Updated `PivotRow` interface to include `sub_team_name: string | null`.

### 4. Frontend: Implemented Hierarchical Grouping
*   **File**: `frontend/src/components/resource-matrix/ResourcePivotTable.tsx`
    *   Refactored grid rendering to support nested grouping: `Department` -> `SubTeam` -> `User`.
    *   Implemented `collapsed` state management for expanding/collapsing groups.
    *   Added summary badges showing Total FTE at the group level.
    *   Integrated `lucide-react` icons (Chevron, Building, Users) for better UX.

## Code Examples

### Backend: Service Fix & Enhancement
```python
# backend/app/services/resource_matrix_service.py

# Query Update
query = (
    db.query(WorkLog)
    .options(
        # ...
        joinedload(WorkLog.user).joinedload(User.sub_team), # Added
        # ...
    )
)

# Row Construction
sub_team_name = str(log.user.sub_team.name) if log.user and log.user.sub_team else None

rows_map[user_id] = PivotRow(
    # ...
    sub_team_name=sub_team_name,
    # ...
)
```

### Frontend: Hierarchical Rendering
```tsx
// frontend/src/components/resource-matrix/ResourcePivotTable.tsx

// Grouping Logic
const groupedRows = React.useMemo(() => {
    // Groups by Department -> SubTeam
    // ...
}, [data]);

// Render Loop
{Object.entries(groupedRows).map(([deptName, group]) => (
    <React.Fragment key={deptName}>
        {/* Department Header */}
        <tr onClick={() => toggleCollapse(deptKey)}>...</tr>
        
        {!isDeptCollapsed && (
            <>
                {/* SubTeam Headers & Rows */}
                {Object.entries(group.subTeams).map(([subName, subGroup]) => (
                     <React.Fragment key={subName}>
                         <tr onClick={() => toggleCollapse(subKey)}>...</tr>
                         {!isSubCollapsed && subGroup.rows.map(row => <RowItem ... />)}
                     </React.Fragment>
                ))}
            </>
        )}
    </React.Fragment>
))}
```

## Verification Results

### Backend Verification
Ran local reproduction script `reproduce_error.py`:
```bash
$ python3 reproduce_error.py
Attempting to call get_resource_pivot_matrix...
Success! Result Grand Total: 44.84
Sample Rows:
User: Adrian Lee, Dept: NPI, IntegratedSystem, SubTeam: None
User: Allie Park, Dept: NPI, IntegratedSystem, SubTeam: Mechanical Engineering
```
*   Confirmed 500 Error resolved.
*   Confirmed `sub_team_name` is correctly populated.

### Manual UI Verification
*   Verified Pivot Table loads without error.
*   Verified rows are grouped by Department (e.g., "Central Engineering").
*   Verified rows are futher grouped by Sub-team (e.g., "Electrical (IS)").
*   Verified Collapse/Expand toggles work as expected.
