# Edwards Project Operation Board - Backend

## Setup

### 1. Create virtual environment
```bash
python3.12 -m venv venv
source venv/bin/activate  # Mac/Linux
# or
.\venv\Scripts\activate  # Windows
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Configure environment
```bash
cp .env.example .env
# Edit .env with your database credentials
```

### 4. Start MS SQL Server (Docker)
```bash
docker run -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=YourStrong@Password123" \
  -p 1433:1433 --name edwards-mssql \
  -d mcr.microsoft.com/azure-sql-edge
```

### 5. Create database
```bash
# Connect to SQL Server and run:
# CREATE DATABASE edwards;
```

### 6. Run migrations
```bash
alembic upgrade head
```

### 7. Start development server
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## API Documentation
- Swagger UI: http://localhost:8000/api/docs
- ReDoc: http://localhost:8000/api/redoc

## Project Structure
```
backend/
├── alembic/              # Database migrations
│   ├── versions/         # Migration files
│   └── env.py           # Alembic configuration
├── app/
│   ├── api/
│   │   └── endpoints/   # API route handlers
│   ├── core/            # Config, DB, Security
│   ├── models/          # SQLAlchemy models
│   ├── schemas/         # Pydantic schemas
│   ├── services/        # Business logic
│   └── main.py          # FastAPI application
├── alembic.ini          # Alembic settings
├── requirements.txt     # Python dependencies
└── .env                 # Environment variables
```

## Database Models
- **Organization**: BusinessUnit, Department, SubTeam, JobPosition
- **Users**: User, UserHistory
- **Projects**: Program, ProjectType, Project, ProjectMilestone
- **Resources**: ResourcePlan, WorkLog
- **Common**: CommonCode, Holiday
