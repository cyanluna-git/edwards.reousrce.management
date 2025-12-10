# Project Name: Edwards Project Operation Board (PoC)

## 1. Project Overview
We are building a Proof of Concept (PoC) for an integrated resource management platform using **MS SQL Server**.
The goal is to replace scattered SharePoint/Excel workflows with a unified web application.
The system is designed for **Edwards PCP (Product Commercialization Process)** management.

### Key Objectives:
1.  **Worklog Tracking:** Employees log daily hours (replacing SharePoint).
2.  **Resource Forecasting:** Managers plan resources including **TBD (Job Position based)** allocations (replacing Excel).
3.  **Milestone Management:** Track standard PCP gates (Gate 3, 5, 6) and custom project milestones (Shipment, Commissioning).
4.  **Capacity Analytics:** Calculate team capacity with Korean holidays and resource changes.

---

## 2. Technical Stack

### Frontend
- **Framework:** React 18+ with TypeScript
- **Build Tool:** Vite
- **UI Library:** Shadcn/UI + Tailwind CSS
- **State Management:** TanStack Query (React Query)
- **Routing:** React Router v6

### Backend
- **Framework:** FastAPI (Python 3.11+)
- **ORM:** SQLAlchemy 2.0 + Alembic (migrations)
- **Validation:** Pydantic v2
- **Authentication:** JWT (python-jose)

### Database
- **Production:** MS SQL Server (Azure SQL Database)
- **Local Development:** Docker `mcr.microsoft.com/azure-sql-edge` (Apple Silicon compatible)

### Deployment
- **Container:** Docker + Docker Compose
- **Local:** Docker containers on development machine
- **Production:** Azure VM (Linux) with Docker

---

## 3. Database Schema Requirements (MS SQL Server)

> [!IMPORTANT]
> - Use `NVARCHAR` for all string fields to support Korean characters.
> - Use `DATETIME2` for accurate timestamps.

---

### A. Organization Structure (Hierarchical)

```
BusinessUnit (사업부)
    └── Department (팀)
            └── SubTeam (소그룹, Optional)
                    └── JobPositions (직급/직무)
```

#### 1. BusinessUnits (사업부/사업영역)
| Field | Type | Description |
|-------|------|-------------|
| `id` | String, PK | e.g., "BU_IS", "BU_ABT", "BU_ACM" |
| `name` | NVARCHAR | e.g., "Integrated System", "Abatement", "ACM" |
| `code` | String, Unique | Short code |
| `is_active` | Boolean | Active status |

#### 2. Departments (팀/부서)
| Field | Type | Description |
|-------|------|-------------|
| `id` | Int, PK, Identity | Auto increment |
| `business_unit_id` | String, FK | Parent BusinessUnit |
| `name` | NVARCHAR | e.g., "Control Engineering", "NPI" |
| `code` | String, Unique | e.g., "CTRL_ENG", "NPI_ABT" |
| `is_active` | Boolean | Active status |

#### 3. SubTeams (소그룹/파트) - Optional
| Field | Type | Description |
|-------|------|-------------|
| `id` | Int, PK, Identity | Auto increment |
| `department_id` | Int, FK | Parent Department |
| `name` | NVARCHAR | e.g., "Software", "Electrical", "Mechanical" |
| `code` | String, Unique | e.g., "SW", "ELEC", "MECH" |
| `is_active` | Boolean | Active status |

#### 4. JobPositions (직급/직무)
| Field | Type | Description |
|-------|------|-------------|
| `id` | String, PK | e.g., "POS_SW_SENIOR", "POS_MECH_ENG" |
| `name` | NVARCHAR | e.g., "Senior Software Engineer" |
| `department_id` | Int, FK | 귀속 부서 |
| `sub_team_id` | Int, FK, Nullable | 귀속 소그룹 (optional) |
| `std_hourly_rate` | Float | Standard cost for budgeting |
| `is_active` | Boolean | Active status |

---

### B. User & Resource History

#### 5. Users (사용자)
| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID), PK | Primary key |
| `email` | String, Unique | Email address |
| `name` | NVARCHAR | English name |
| `korean_name` | NVARCHAR, Nullable | Korean name |
| `department_id` | Int, FK | Current department |
| `sub_team_id` | Int, FK, Nullable | Current sub-team |
| `position_id` | String, FK | Current position |
| `role` | String | ADMIN, PM, FM, USER |
| `is_active` | Boolean | Enable/Disable status |
| `hire_date` | DateTime | 입사일 또는 현 부서 전배일 |
| `termination_date` | DateTime, Nullable | 퇴직일 또는 전출일 |

#### 6. UserHistory (사용자 이력)
> 부서 이동, 직급 변경 등의 이력을 추적하여 기간별 Capacity 산출에 활용

| Field | Type | Description |
|-------|------|-------------|
| `id` | BigInt, PK, Identity | Auto increment |
| `user_id` | String (UUID), FK | User reference |
| `department_id` | Int, FK | Department at that time |
| `sub_team_id` | Int, FK, Nullable | Sub-team at that time |
| `position_id` | String, FK | Position at that time |
| `start_date` | DateTime | 해당 조직/직급 시작일 |
| `end_date` | DateTime, Nullable | 해당 조직/직급 종료일 (NULL = 현재) |
| `change_type` | String | HIRE, TRANSFER_IN, TRANSFER_OUT, PROMOTION, RESIGN |
| `remarks` | NVARCHAR, Nullable | 비고 |

---

### C. Program & Project Structure

```
Program (프로그램)
    └── Project (프로젝트)
            └── ProjectMilestones (마일스톤)
```

#### 7. Programs (프로그램)
> 여러 프로젝트를 그룹화하는 상위 개념

| Field | Type | Description |
|-------|------|-------------|
| `id` | String, PK | e.g., "PRG_EUV_NPI", "PRG_ABT_ETO" |
| `name` | NVARCHAR | e.g., "EUV NPI", "Abatement ETO" |
| `business_unit_id` | String, FK | 귀속 사업부 |
| `description` | NVARCHAR(MAX), Nullable | Description |
| `is_active` | Boolean | Active status |

#### 8. ProjectTypes (프로젝트 유형)
| Field | Type | Description |
|-------|------|-------------|
| `id` | String, PK | e.g., "NPI", "ETO", "CIP", "SUPPORT" |
| `name` | NVARCHAR | e.g., "New Product Introduction" |
| `description` | NVARCHAR, Nullable | Description |

#### 9. Projects (프로젝트)
| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID), PK | Primary key |
| `program_id` | String, FK | Parent program |
| `project_type_id` | String, FK | NPI, ETO, CIP, SUPPORT 등 |
| `code` | String, Unique | IO Code (e.g., "406372") |
| `name` | NVARCHAR | Project name |
| `status` | String | WIP, Hold, Completed, Cancelled, Forecast |
| `complexity` | String, Nullable | Simple, Derivative, Complex |
| `pm_id` | String (UUID), FK, Nullable | Project Manager |
| `start_date` | DateTime, Nullable | Project start date |
| `end_date` | DateTime, Nullable | Project end date |
| `customer` | NVARCHAR, Nullable | Customer name |
| `product` | NVARCHAR, Nullable | Product/Model name |
| `description` | NVARCHAR(MAX), Nullable | Description |
| `created_at` | DateTime | Created timestamp |
| `updated_at` | DateTime | Updated timestamp |

#### 10. ProjectMilestones (프로젝트 마일스톤)
| Field | Type | Description |
|-------|------|-------------|
| `id` | BigInt, PK, Identity | Auto increment |
| `project_id` | String (UUID), FK | Parent project |
| `name` | NVARCHAR | e.g., "Gate 3", "Shipment" |
| `type` | String | STD_GATE or CUSTOM |
| `target_date` | DateTime | Planned date |
| `actual_date` | DateTime, Nullable | Completed date |
| `status` | String | Pending, Completed, Delayed |
| `is_key_gate` | Boolean | True if major PCP Gate |
| `description` | NVARCHAR, Nullable | Comments |

---

### D. Resource Planning & WorkLogs

#### 11. ResourcePlans (리소스 계획) - 월단위
| Field | Type | Description |
|-------|------|-------------|
| `id` | BigInt, PK, Identity | Auto increment |
| `project_id` | String (UUID), FK | Project reference |
| `year` | Int | Year |
| `month` | Int | Month (1-12) |
| `position_id` | String, FK | **Mandatory** - Role tracking |
| `user_id` | String (UUID), FK, Nullable | **NULL = TBD (Open Position)** |
| `planned_hours` | Float | Planned hours for the month |
| `created_by` | String (UUID), FK | Creator |
| `created_at` | DateTime | Created timestamp |
| `updated_at` | DateTime | Updated timestamp |

#### 12. WorkLogs (실적 기록)
| Field | Type | Description |
|-------|------|-------------|
| `id` | BigInt, PK, Identity | Auto increment |
| `date` | DateTime | Work date |
| `user_id` | String (UUID), FK | Worker |
| `project_id` | String (UUID), FK | Project reference |
| `work_type` | String, FK(CommonCode) | Design, SW Develop, Meeting 등 |
| `hours` | Float | Hours worked |
| `description` | NVARCHAR(MAX), Nullable | Work description |
| `meeting_type` | String, Nullable | Decision Making, Information Sharing, Feedback, Periodic Updates, Problem Solving |
| `is_sudden_work` | Boolean, Default False | 긴급/돌발 업무 여부 |
| `is_business_trip` | Boolean, Default False | 출장 여부 |
| `created_at` | DateTime | Created timestamp |
| `updated_at` | DateTime | Updated timestamp |

---

### E. Master Data & Configuration

#### 13. CommonCodes (공통 코드)
| Field | Type | Description |
|-------|------|-------------|
| `group_code` | String | e.g., "WORK_TYPE", "MEETING_TYPE" |
| `code_id` | String | Code identifier |
| `name` | NVARCHAR | Display name |
| `description` | NVARCHAR, Nullable | Description |
| `sort_order` | Int | Display order |
| `is_active` | Boolean | Active status |

**CommonCode Groups:**

**WORK_TYPE (업무 유형)** - 표준 WBS(Work Breakdown Structure) 기반 분류:

| Category | Codes | Description |
|----------|-------|-------------|
| **Engineering** | `DESIGN`, `SW_DEVELOP`, `VERIFICATION` | 핵심 엔지니어링 활동 |
| **Documentation** | `DOCUMENTATION`, `REVIEW` | 문서 작성 및 검토 |
| **Collaboration** | `MEETING`, `WORKSHOP`, `CUSTOMER_SUPPORT` | 협업 및 의사소통 |
| **Support** | `FIELD_WORK`, `QA_QC`, `COMPLIANCES`, `SAFETY` | 지원 업무 |
| **Development** | `TRAINING`, `SELF_STUDY`, `RESEARCH` | 역량 개발 |
| **Administrative** | `MANAGEMENT`, `ADMIN_WORK`, `EMAIL` | 관리/행정 |
| **Leave** | `LEAVE` | 휴가/휴무 |

> [!TIP]
> 현재 SharePoint 업무유형을 그대로 유지하되, 향후 ISO/IEC 15288 또는 PMBOK WBS 체계로 확장 가능

**MEETING_TYPE (회의 유형):**
- `DECISION_MAKING` - 의사결정
- `INFO_SHARING` - 정보공유
- `FEEDBACK` - 피드백/1:1
- `PERIODIC_UPDATE` - 정기 업데이트 (Weekly, Monthly)
- `PROBLEM_SOLVING` - 문제해결
- `WORKSHOP` - 워크샵/브레인스토밍

**기타 코드 그룹:**
- `MILESTONE_TYPE`: STD_GATE, CUSTOM
- `PROJECT_STATUS`: WIP, Hold, Completed, Cancelled, Forecast
- `CHANGE_TYPE`: HIRE, TRANSFER_IN, TRANSFER_OUT, PROMOTION, RESIGN

#### 14. Holidays (공휴일)
> 한국 법정 공휴일 및 회사 휴무일 관리 → Capacity 동적 계산에 활용

| Field | Type | Description |
|-------|------|-------------|
| `id` | Int, PK, Identity | Auto increment |
| `date` | DateTime | Holiday date |
| `name` | NVARCHAR | Holiday name |
| `type` | String | LEGAL (법정), COMPANY (창립기념일) |
| `year` | Int | Year (for quick filtering) |

**Korean Holidays 예시 (2025):**
| Date | Name | Type |
|------|------|------|
| 2025-01-01 | 신정 | LEGAL |
| 2025-01-28~30 | 설날연휴 | LEGAL |
| 2025-03-01 | 삼일절 | LEGAL |
| 2025-05-05 | 어린이날 | LEGAL |
| 2025-05-06 | 부처님오신날 | LEGAL |
| 2025-06-06 | 현충일 | LEGAL |
| 2025-08-12 | **창립기념일** | COMPANY |
| 2025-08-15 | 광복절 | LEGAL |
| 2025-10-05~07 | 추석연휴 | LEGAL |
| 2025-10-03 | 개천절 | LEGAL |
| 2025-10-09 | 한글날 | LEGAL |
| 2025-12-25 | 성탄절 | LEGAL |

---

## 4. Key Business Logic & API Requirements

### Feature 1: Dynamic Milestone Management
- **GET /api/projects/{id}/milestones**: List all milestones sorted by `target_date`.
- **POST /api/projects/{id}/milestones**: Add a milestone.
    - If `type` is `STD_GATE`, user selects from a preset list (G3, G5, G6).
    - If `type` is `CUSTOM`, user types a custom name.
- **Logic:** Calculate `delay_days` dynamically (Target Date vs Today/Actual Date).

### Feature 2: TBD Resource Planning (The "Excel Killer")
- **Scenario:** A PM plans a project but team members aren't assigned yet.
- **Action:** PM creates a plan with `position_id="SW_ENGINEER"` and `user_id=NULL`.
- **UI:** In the grid, these rows show as "TBD - SW Engineer" and are highlighted (e.g., yellow background).
- **Alert:** Functional Managers can filter/see TBD positions that need assignment.

### Feature 3: Smart Worklogs
- **Validation:** Prevent logging more than **24 hours per day (total across all projects)**.
- **Copy Function:** Endpoint to copy all logs from "Last Week" to "Current Week".
- **Meeting Type:** When `work_type` = "Meeting", allow optional `meeting_type` selection.

### Feature 4: Dynamic Capacity Calculation
- **Base Formula:** `Monthly Capacity = (Working Days in Month) × 8 hours`
- **Working Days Calculation:**
  1. Get total weekdays (Mon-Fri) in the month
  2. Subtract Korean holidays from `Holidays` table
  3. Optionally subtract approved leave from WorkLogs where `work_type` = "Leave"
- **Team Capacity:** Sum of individual capacities for active team members in the period
- **Historical Accuracy:** Use `UserHistory` to determine who was in the team during specific months

### Feature 5: Department/Project Reports
- **Resource Summary by Department:** Show planned vs actual hours per department
- **Cross-functional Project View:** For projects with multiple departments, show resource contribution by each team
- **FM Dashboard:** Functional Managers see their team's allocation across all projects

---

## 5. User Roles & Permissions

| Role | Description | Permissions |
|------|-------------|-------------|
| `ADMIN` | System Administrator | Full access to all features and settings |
| `PM` | Project Manager | Manage own projects, view team resources, create resource plans |
| `FM` | Functional Manager | Manage department resources, approve TBD assignments, view department reports |
| `USER` | Team Member | Log own worklogs, view own assignments |

**FM (Functional Manager) Key Features:**
- View and manage resources within their department only
- Assign team members to TBD positions
- Approve/review work logs (optional, currently not required)
- Access department-level reports and capacity analytics

---

## 6. Development Environment Setup

### Project Structure
```
edwards.engineering_operation_management/
├── docker-compose.yml
├── frontend/                    # React + Vite
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── api/
│   │   └── types/
│   ├── Dockerfile
│   └── package.json
├── backend/                     # FastAPI
│   ├── app/
│   │   ├── api/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── core/
│   ├── alembic/                # DB Migrations
│   ├── Dockerfile
│   └── requirements.txt
└── docs/
    └── requirement.md
```

### Docker Compose
```yaml
version: '3.8'
services:
  db:
    image: mcr.microsoft.com/azure-sql-edge
    container_name: edwards-mssql
    ports:
      - "1433:1433"
    environment:
      ACCEPT_EULA: "Y"
      MSSQL_SA_PASSWORD: "YourStrong@Password123"
    volumes:
      - mssql-data:/var/opt/mssql

  backend:
    build: ./backend
    container_name: edwards-api
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: "mssql+pyodbc://sa:YourStrong@Password123@db:1433/edwards?driver=ODBC+Driver+18+for+SQL+Server&TrustServerCertificate=yes"
    depends_on:
      - db

  frontend:
    build: ./frontend
    container_name: edwards-web
    ports:
      - "3000:80"
    depends_on:
      - backend

volumes:
  mssql-data:
```

### Seed Data
1. **CommonCodes:** All WORK_TYPE, MEETING_TYPE codes
2. **BusinessUnits:** IntegratedSystem, Abatement, ACM, Shared
3. **Departments:** Control Engineering, NPI, ETO, Central Engineering, ACM Tech
4. **SubTeams:** Software, Electrical, Mechanical, Analysis Tech, DES
5. **JobPositions:** SW_ENG, MECH_ENG, ELEC_ENG, PM, MANAGER (with department FK)
6. **ProjectTypes:** NPI, ETO, CIP, SUPPORT, INTERNAL
7. **Holidays:** 2024-2025 Korean holidays + 창립기념일 (8/12)
8. **Sample Project:** With standard PCP Gates (G3, G5, G6)

---

## 7. Data Migration Notes

### From SharePoint Lists
| Source List | Target Table | Notes |
|-------------|--------------|-------|
| PCAS Engineering Team Members | Users, UserHistory | Map Team→Department, Sub-Team→SubTeam |
| IS Daily WorkLogs / Abatement Daily Logs | WorkLogs | Parse Date, Hours, Type fields |
| PCAS Project List | Programs, Projects | Map Program→Programs, IO→code |
| Worktype List | CommonCodes (WORK_TYPE) | Direct mapping |

### Migration Strategy
1. Import master data first (BusinessUnits, Departments, JobPositions)
2. Import Users with initial UserHistory record (start_date = hire_date)
3. Import Projects linked to Programs
4. Import WorkLogs with proper foreign key mappings

---

## 8. API Endpoints Summary

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login (JWT) |
| POST | `/api/auth/refresh` | Refresh token |
| GET | `/api/auth/me` | Current user info |

### Users & Organization
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | List users (with filters) |
| GET | `/api/users/{id}` | Get user detail |
| GET | `/api/departments` | List departments |
| GET | `/api/departments/{id}/members` | Department members |

### Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List projects |
| POST | `/api/projects` | Create project |
| GET | `/api/projects/{id}` | Project detail |
| GET | `/api/projects/{id}/milestones` | Project milestones |
| POST | `/api/projects/{id}/milestones` | Add milestone |

### Resource Planning
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/resource-plans` | List plans (by project/month) |
| POST | `/api/resource-plans` | Create plan |
| PUT | `/api/resource-plans/{id}` | Update plan |
| GET | `/api/resource-plans/tbd` | List TBD positions |

### WorkLogs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/worklogs` | List worklogs (with date range) |
| POST | `/api/worklogs` | Create worklog |
| PUT | `/api/worklogs/{id}` | Update worklog |
| POST | `/api/worklogs/copy-week` | Copy last week's logs |

### Reports & Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/capacity` | Team capacity report |
| GET | `/api/reports/department/{id}` | Department resource summary |
| GET | `/api/reports/project/{id}` | Project resource breakdown |