-- ============================================================================
-- CONTEXT-AWARE TIMESHEET SYSTEM: Database Implementation
-- Part 1: Activity Codes & Cost Buckets
-- ============================================================================
-- Version: 1.0
-- Date: 2026-01-21
-- Database: PostgreSQL 15+
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ACTIVITY CODES DIMENSION TABLE
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS dim_activity_code (
    id VARCHAR(20) PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(20) NOT NULL CHECK (category IN ('DEVELOPMENT', 'COLLABORATION', 'SUPPORT', 'OVERHEAD')),
    description TEXT,
    is_billable BOOLEAN DEFAULT TRUE,
    requires_project BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    display_order INT NOT NULL,
    icon_code VARCHAR(10), -- For UI (e.g., '🎨', '🧪', '💬')
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add index for fast lookups
CREATE INDEX idx_activity_code_category ON dim_activity_code(category);
CREATE INDEX idx_activity_code_active ON dim_activity_code(is_active);

-- Insert standard activity codes
INSERT INTO dim_activity_code (id, code, name, category, description, is_billable, requires_project, display_order, icon_code) VALUES
-- DEVELOPMENT (Direct Work)
('ACT_DESIGN',   'DESIGN',   'Design & Development',       'DEVELOPMENT',   'Creating new features, writing code, architectural design',        TRUE,  TRUE,  10, '🎨'),
('ACT_TEST',     'TEST',     'Testing & Validation',       'DEVELOPMENT',   'Unit testing, integration testing, verification',                 TRUE,  TRUE,  20, '🧪'),
('ACT_DOC',      'DOC',      'Documentation',              'DEVELOPMENT',   'Technical documentation, user guides, API docs',                   TRUE,  TRUE,  30, '📝'),
('ACT_RELEASE',  'RELEASE',  'Release & Deployment',       'DEVELOPMENT',   'Build, deploy, release management',                                TRUE,  TRUE,  40, '🚀'),

-- COLLABORATION (Context-Dependent)
('ACT_MEET',     'MEET',     'Meeting & Discussion',       'COLLABORATION', 'Team meetings, standups, planning sessions',                       TRUE,  FALSE, 50, '💬'),
('ACT_REVIEW',   'REVIEW',   'Design Review & Approval',   'COLLABORATION', 'Code review, design review, gate reviews',                         TRUE,  TRUE,  60, '📋'),
('ACT_PLAN',     'PLAN',     'Planning & Estimation',      'COLLABORATION', 'Sprint planning, story estimation, roadmap planning',              TRUE,  FALSE, 70, '📊'),

-- SUPPORT (Indirect Work)
('ACT_FIELD',    'FIELD',    'Field Support',              'SUPPORT',       'Customer site visits, installation support, troubleshooting',      TRUE,  FALSE, 80, '🔧'),
('ACT_SALES',    'SALES',    'Sales Support',              'SUPPORT',       'Pre-sales demos, technical consulting, RFP responses',             TRUE,  FALSE, 90, '💼'),
('ACT_SUSTAIN',  'SUSTAIN',  'Sustaining (Bug Fix)',       'SUPPORT',       'Post-release bug fixes, patches, maintenance',                     TRUE,  TRUE,  100, '🐛'),
('ACT_TRIAGE',   'TRIAGE',   'Issue Investigation',        'SUPPORT',       'Incident investigation, root cause analysis',                      TRUE,  FALSE, 110, '🔍'),

-- OVERHEAD (General)
('ACT_ADMIN',    'ADMIN',    'Admin & Process Work',       'OVERHEAD',      'Department operations, reporting, compliance',                     FALSE, FALSE, 120, '📁'),
('ACT_TRAINING', 'TRAINING', 'Training & Learning',        'OVERHEAD',      'Courses, certifications, knowledge transfer',                      FALSE, FALSE, 130, '📚'),
('ACT_HIRING',   'HIRING',   'Recruiting & Interviews',    'OVERHEAD',      'Resume review, interviews, onboarding',                            FALSE, FALSE, 140, '👥'),
('ACT_PTO',      'PTO',      'Time Off',                   'OVERHEAD',      'Vacation, sick leave, personal time',                              FALSE, FALSE, 150, '🌴')
ON CONFLICT (id) DO NOTHING;

-- Add comment
COMMENT ON TABLE dim_activity_code IS 'Standard activity codes for timesheet classification. Keep stable (rarely change) for trend analysis.';

-- ----------------------------------------------------------------------------
-- 2. COST BUCKET DIMENSION TABLE
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS dim_cost_bucket (
    id VARCHAR(50) PRIMARY KEY,
    bucket_code VARCHAR(20) UNIQUE NOT NULL,
    bucket_name VARCHAR(100) NOT NULL,
    level1_category VARCHAR(50),    -- For rollup reporting
    level2_subcategory VARCHAR(50),
    description TEXT,
    gl_account_prefix VARCHAR(20),  -- For ERP integration (General Ledger)
    is_capitalizable BOOLEAN,       -- GAAP compliance: Can this be capitalized?
    display_color VARCHAR(7),       -- Hex color for UI (#22C55E)
    sort_order INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert standard cost buckets
INSERT INTO dim_cost_bucket (id, bucket_code, bucket_name, level1_category, level2_subcategory, description, gl_account_prefix, is_capitalizable, display_color, sort_order) VALUES

('BUCKET_DIRECT_PROD', 'DIRECT_PROD', 'Direct Product Development',
 'Direct Work', 'Product Engineering',
 'Core product development: NPI, ETO, new feature development',
 'GL-1000', TRUE, '#22C55E', 1),

('BUCKET_DIRECT_PROJ', 'DIRECT_PROJ', 'Direct Project Work',
 'Direct Work', 'Project Delivery',
 'Customer-specific project work with lower margins',
 'GL-1100', TRUE, '#84CC16', 2),

('BUCKET_INDIRECT', 'INDIRECT', 'Indirect Support Work',
 'Indirect Work', 'Customer & Field Support',
 'Customer support, field support, sales support, sustaining engineering',
 'GL-2000', FALSE, '#F59E0B', 3),

('BUCKET_OVERHEAD', 'OVERHEAD', 'General Overhead',
 'Overhead', 'Operations & Admin',
 'Training, admin, hiring, department operations',
 'GL-3000', FALSE, '#94A3B8', 4),

('BUCKET_UNCLASSIFIED', 'UNCLASS', 'Unclassified (Review Needed)',
 'Unclassified', 'Pending Review',
 'Entries that could not be auto-classified. Requires manual review.',
 'GL-9999', FALSE, '#EF4444', 99)

ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE dim_cost_bucket IS 'Financial classification buckets for cost allocation and reporting.';

-- ----------------------------------------------------------------------------
-- 3. ALLOCATION RULES TABLE (The Brain)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS allocation_rules (
    id SERIAL PRIMARY KEY,
    rule_priority INT NOT NULL,         -- Lower = higher priority (evaluated first)
    rule_name VARCHAR(200) NOT NULL,
    description TEXT,

    -- MATCH CONDITIONS (All nullable = wildcards)
    user_department_id VARCHAR(50) REFERENCES departments(id),
    user_sub_team_id VARCHAR(50) REFERENCES sub_teams(id),
    user_functional_role_id VARCHAR(50),  -- FK to functional_roles if exists
    project_type_id VARCHAR(20) REFERENCES project_types(id),
    project_category VARCHAR(20) CHECK (project_category IN ('PRODUCT', 'PROJECT', 'FUNCTIONAL')),
    activity_code_id VARCHAR(20) REFERENCES dim_activity_code(id),
    activity_category VARCHAR(20) CHECK (activity_category IN ('DEVELOPMENT', 'COLLABORATION', 'SUPPORT', 'OVERHEAD')),

    -- ALLOCATION OUTPUT
    target_cost_bucket_id VARCHAR(50) NOT NULL REFERENCES dim_cost_bucket(id),
    allocation_percentage DECIMAL(5,2) DEFAULT 100.00 CHECK (allocation_percentage > 0 AND allocation_percentage <= 100),

    -- METADATA
    is_active BOOLEAN DEFAULT TRUE,
    effective_from DATE DEFAULT CURRENT_DATE,
    effective_to DATE,
    created_by VARCHAR(36) REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Ensure rule priority is unique (no conflicts)
    UNIQUE(rule_priority)
);

-- Indexes for fast rule matching
CREATE INDEX idx_alloc_rule_priority ON allocation_rules(rule_priority) WHERE is_active = TRUE;
CREATE INDEX idx_alloc_rule_dept ON allocation_rules(user_department_id);
CREATE INDEX idx_alloc_rule_proj_type ON allocation_rules(project_type_id);
CREATE INDEX idx_alloc_rule_activity ON allocation_rules(activity_code_id);
CREATE INDEX idx_alloc_rule_effective ON allocation_rules(effective_from, effective_to) WHERE is_active = TRUE;

COMMENT ON TABLE allocation_rules IS 'Classification rules engine. Matches context (user, project, activity) to cost bucket. Priority-based: first match wins.';
COMMENT ON COLUMN allocation_rules.rule_priority IS 'Lower number = higher priority. Rules evaluated in ascending order until first match.';

-- ----------------------------------------------------------------------------
-- 4. ENHANCED TIMESHEET ENTRY TABLE
-- ----------------------------------------------------------------------------

-- Note: This assumes you have a timesheet_entries table. If not, create it.
-- If it exists, we'll add the new columns via ALTER TABLE

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'timesheet_entries') THEN
        CREATE TABLE timesheet_entries (
            id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
            user_id VARCHAR(36) NOT NULL REFERENCES users(id),
            project_id VARCHAR(36) REFERENCES projects(id),  -- Nullable for overhead activities
            activity_code_id VARCHAR(20) NOT NULL REFERENCES dim_activity_code(id),
            work_date DATE NOT NULL,
            hours_logged DECIMAL(5,2) NOT NULL CHECK (hours_logged > 0 AND hours_logged <= 24),
            comment TEXT,

            -- AUTO-COMPUTED FIELDS
            cost_bucket_id VARCHAR(50) REFERENCES dim_cost_bucket(id),
            allocation_rule_id INT REFERENCES allocation_rules(id),
            confidence_score DECIMAL(5,2), -- 0-100 scale
            is_manual_override BOOLEAN DEFAULT FALSE,

            -- METADATA
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_by VARCHAR(36) REFERENCES users(id),

            -- Constraints
            CONSTRAINT valid_confidence CHECK (confidence_score >= 0 AND confidence_score <= 100)
        );

        -- Indexes
        CREATE INDEX idx_ts_user_date ON timesheet_entries(user_id, work_date);
        CREATE INDEX idx_ts_project ON timesheet_entries(project_id);
        CREATE INDEX idx_ts_work_date ON timesheet_entries(work_date);
        CREATE INDEX idx_ts_cost_bucket ON timesheet_entries(cost_bucket_id);
        CREATE INDEX idx_ts_low_confidence ON timesheet_entries(confidence_score) WHERE confidence_score < 70;

    ELSE
        -- Add new columns if table exists
        ALTER TABLE timesheet_entries ADD COLUMN IF NOT EXISTS activity_code_id VARCHAR(20) REFERENCES dim_activity_code(id);
        ALTER TABLE timesheet_entries ADD COLUMN IF NOT EXISTS cost_bucket_id VARCHAR(50) REFERENCES dim_cost_bucket(id);
        ALTER TABLE timesheet_entries ADD COLUMN IF NOT EXISTS allocation_rule_id INT REFERENCES allocation_rules(id);
        ALTER TABLE timesheet_entries ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(5,2);
        ALTER TABLE timesheet_entries ADD COLUMN IF NOT EXISTS is_manual_override BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. HELPER VIEW: Active Allocation Rules
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_active_allocation_rules AS
SELECT
    ar.id,
    ar.rule_priority,
    ar.rule_name,
    ar.user_department_id,
    d.department_name,
    ar.user_sub_team_id,
    st.name AS sub_team_name,
    ar.project_type_id,
    pt.name AS project_type_name,
    ar.project_category,
    ar.activity_code_id,
    ac.name AS activity_name,
    ar.activity_category,
    ar.target_cost_bucket_id,
    cb.bucket_name,
    ar.allocation_percentage,
    ar.effective_from,
    ar.effective_to
FROM allocation_rules ar
LEFT JOIN departments d ON ar.user_department_id = d.id
LEFT JOIN sub_teams st ON ar.user_sub_team_id = st.id
LEFT JOIN project_types pt ON ar.project_type_id = pt.id
LEFT JOIN dim_activity_code ac ON ar.activity_code_id = ac.id
LEFT JOIN dim_cost_bucket cb ON ar.target_cost_bucket_id = cb.id
WHERE ar.is_active = TRUE
  AND ar.effective_from <= CURRENT_DATE
  AND (ar.effective_to IS NULL OR ar.effective_to >= CURRENT_DATE)
ORDER BY ar.rule_priority ASC;

COMMENT ON VIEW v_active_allocation_rules IS 'Currently active allocation rules with human-readable names. Used for rule debugging and admin UI.';

-- ----------------------------------------------------------------------------
-- 6. DATA VALIDATION CONSTRAINTS
-- ----------------------------------------------------------------------------

-- Ensure timesheet daily hours don't exceed reasonable limit
CREATE OR REPLACE FUNCTION check_daily_hours_limit()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COALESCE(SUM(hours_logged), 0) + NEW.hours_logged
        FROM timesheet_entries
        WHERE user_id = NEW.user_id
          AND work_date = NEW.work_date
          AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000')) > 14 THEN
        RAISE EXCEPTION 'Daily hours exceed 14 hours limit for user % on date %', NEW.user_id, NEW.work_date;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger (optional - can be warning instead of hard block)
-- Uncomment to enable:
-- CREATE TRIGGER trg_daily_hours_limit
-- BEFORE INSERT OR UPDATE ON timesheet_entries
-- FOR EACH ROW
-- EXECUTE FUNCTION check_daily_hours_limit();

-- ----------------------------------------------------------------------------
-- 7. ANALYTICS VIEWS
-- ----------------------------------------------------------------------------

-- Monthly cost bucket summary
CREATE OR REPLACE VIEW v_monthly_cost_bucket_summary AS
SELECT
    DATE_TRUNC('month', te.work_date) AS month,
    cb.bucket_code,
    cb.bucket_name,
    cb.level1_category,
    COUNT(DISTINCT te.user_id) AS unique_users,
    COUNT(te.id) AS entry_count,
    SUM(te.hours_logged) AS total_hours,
    ROUND(AVG(te.confidence_score), 2) AS avg_confidence,
    SUM(CASE WHEN te.is_manual_override THEN 1 ELSE 0 END) AS manual_overrides
FROM timesheet_entries te
JOIN dim_cost_bucket cb ON te.cost_bucket_id = cb.id
GROUP BY DATE_TRUNC('month', te.work_date), cb.bucket_code, cb.bucket_name, cb.level1_category, cb.sort_order
ORDER BY month DESC, cb.sort_order;

-- Department work distribution
CREATE OR REPLACE VIEW v_department_work_distribution AS
SELECT
    d.department_code,
    d.department_name,
    cb.bucket_code,
    SUM(te.hours_logged) AS hours,
    COUNT(te.id) AS entry_count,
    ROUND(
        SUM(te.hours_logged) * 100.0 / SUM(SUM(te.hours_logged)) OVER (PARTITION BY d.department_id),
        2
    ) AS dept_percentage
FROM timesheet_entries te
JOIN users u ON te.user_id = u.id
JOIN departments d ON u.department_id = d.id
JOIN dim_cost_bucket cb ON te.cost_bucket_id = cb.id
WHERE te.work_date >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY d.department_id, d.department_code, d.department_name, cb.bucket_code, cb.sort_order
ORDER BY d.department_code, cb.sort_order;

-- Low confidence entries (quality alert)
CREATE OR REPLACE VIEW v_low_confidence_entries AS
SELECT
    te.id,
    te.work_date,
    u.name AS user_name,
    d.department_name,
    p.name AS project_name,
    pt.name AS project_type,
    ac.name AS activity_name,
    cb.bucket_name,
    te.confidence_score,
    te.hours_logged,
    ar.rule_name AS applied_rule
FROM timesheet_entries te
JOIN users u ON te.user_id = u.id
JOIN departments d ON u.department_id = d.id
LEFT JOIN projects p ON te.project_id = p.id
LEFT JOIN project_types pt ON p.project_type_id = pt.id
JOIN dim_activity_code ac ON te.activity_code_id = ac.id
JOIN dim_cost_bucket cb ON te.cost_bucket_id = cb.id
LEFT JOIN allocation_rules ar ON te.allocation_rule_id = ar.id
WHERE te.confidence_score < 70
  AND te.work_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY te.confidence_score ASC, te.work_date DESC;

-- ----------------------------------------------------------------------------
-- 8. SAMPLE DATA QUERIES
-- ----------------------------------------------------------------------------

-- Get user's primary project (for smart default)
CREATE OR REPLACE FUNCTION get_user_primary_project(p_user_id VARCHAR)
RETURNS TABLE (
    project_id VARCHAR,
    project_code VARCHAR,
    project_name VARCHAR,
    total_hours NUMERIC,
    last_logged DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.code,
        p.name,
        SUM(te.hours_logged) AS total_hours,
        MAX(te.work_date) AS last_logged
    FROM timesheet_entries te
    JOIN projects p ON te.project_id = p.id
    WHERE te.user_id = p_user_id
      AND te.work_date >= CURRENT_DATE - INTERVAL '30 days'
      AND p.status = 'InProgress'
    GROUP BY p.id, p.code, p.name
    ORDER BY last_logged DESC, total_hours DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Get user's common activities (for quick-access buttons)
CREATE OR REPLACE FUNCTION get_user_common_activities(p_user_id VARCHAR, p_limit INT DEFAULT 4)
RETURNS TABLE (
    activity_code_id VARCHAR,
    activity_code VARCHAR,
    activity_name VARCHAR,
    usage_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ac.id,
        ac.code,
        ac.name,
        COUNT(te.id) AS usage_count
    FROM timesheet_entries te
    JOIN dim_activity_code ac ON te.activity_code_id = ac.id
    WHERE te.user_id = p_user_id
      AND te.work_date >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY ac.id, ac.code, ac.name, ac.display_order
    ORDER BY usage_count DESC, ac.display_order ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 9. PERMISSIONS (Optional - adjust to your security model)
-- ----------------------------------------------------------------------------

-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO timesheet_user;
-- GRANT INSERT, UPDATE ON timesheet_entries TO timesheet_user;
-- GRANT SELECT, INSERT, UPDATE ON allocation_rules TO timesheet_admin;

-- ============================================================================
-- END OF SCRIPT
-- ============================================================================
-- Next Steps:
-- 1. Run this script on your database
-- 2. Load initial allocation rules (see next script file)
-- 3. Test classification function
-- 4. Build UI integration
-- ============================================================================
