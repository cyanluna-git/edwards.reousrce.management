-- ============================================================================
-- Recharge & Planning System: Part 2 - IO Category Dimension
-- ============================================================================
-- Version: 1.0
-- Date: 2026-01-21
-- Database: PostgreSQL 15+
-- Purpose: Create IO category dimension for project classification
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. IO CATEGORY DIMENSION
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS dim_io_category (
    id VARCHAR(50) PRIMARY KEY,
    category_code VARCHAR(50) UNIQUE NOT NULL,
    category_name VARCHAR(200) NOT NULL,
    parent_category_id VARCHAR(50),                                    -- For hierarchical categories
    is_billable BOOLEAN DEFAULT FALSE,                                 -- Default recharge behavior
    default_funding_entity_id VARCHAR(50) REFERENCES dim_funding_entity(id),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Self-referential foreign key for hierarchy
    FOREIGN KEY (parent_category_id) REFERENCES dim_io_category(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_io_cat_code ON dim_io_category(category_code);
CREATE INDEX IF NOT EXISTS idx_io_cat_parent ON dim_io_category(parent_category_id);
CREATE INDEX IF NOT EXISTS idx_io_cat_active ON dim_io_category(is_active) WHERE is_active = TRUE;

-- Comments
COMMENT ON TABLE dim_io_category IS 'IO categories derived from IO Framework. Maps Programme to funding entity and billability.';
COMMENT ON COLUMN dim_io_category.is_billable IS 'Default billable flag. TRUE = inter-company recharge by default.';
COMMENT ON COLUMN dim_io_category.parent_category_id IS 'Parent category for hierarchical grouping (e.g., Field Support > Customer A)';

-- ----------------------------------------------------------------------------
-- 2. INSERT STANDARD IO CATEGORIES
-- ----------------------------------------------------------------------------

-- Based on common R&D programs from IO Framework
INSERT INTO dim_io_category (id, category_code, category_name, is_billable, default_funding_entity_id, description) VALUES

-- Level 1: Top-level categories
('IO_CAT_NPI', 'NPI', 'New Product Introduction', FALSE, 'ENTITY_LOCAL_KR',
 'Core product development - local Korea CAPEX'),

('IO_CAT_FIELD_FAILURE', 'FIELD_FAILURE', 'Field Failure Escalation', TRUE, 'ENTITY_VSS',
 'Customer escalations and field failures - billable to VSS'),

('IO_CAT_OPS_SUPPORT', 'OPS_SUPPORT', 'Operations Support', TRUE, 'ENTITY_VSS',
 'Factory and operations support - billable to VSS'),

('IO_CAT_SUSTAINING', 'SUSTAINING', 'Sustaining Engineering', TRUE, 'ENTITY_VSS',
 'Post-release bug fixes and maintenance - billable to VSS'),

('IO_CAT_CIP', 'CIP', 'Continuous Improvement Project', TRUE, NULL,
 'Process improvements - billable to requesting division'),

('IO_CAT_SALES_SUPPORT', 'SALES_SUPPORT', 'Sales Support', TRUE, 'ENTITY_VSS',
 'Pre-sales demos and technical consulting - billable to Sales'),

('IO_CAT_REGULATORY', 'REGULATORY', 'Regulatory & Compliance', TRUE, 'ENTITY_VSS',
 'Product compliance and certifications - billable to VSS'),

('IO_CAT_TRAINING', 'TRAINING', 'Training & Knowledge Transfer', FALSE, 'ENTITY_LOCAL_KR',
 'Employee training - local overhead'),

('IO_CAT_INTERNAL_TOOLS', 'INTERNAL_TOOLS', 'Internal Tools & Infrastructure', FALSE, 'ENTITY_SHARED',
 'Shared services and internal tooling - shared overhead')

ON CONFLICT (id) DO UPDATE
SET category_name = EXCLUDED.category_name,
    is_billable = EXCLUDED.is_billable,
    default_funding_entity_id = EXCLUDED.default_funding_entity_id,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP;

-- ----------------------------------------------------------------------------
-- 3. HELPER VIEW: IO CATEGORY HIERARCHY
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_io_category_hierarchy AS
WITH RECURSIVE category_tree AS (
    -- Base case: top-level categories (no parent)
    SELECT
        id,
        category_code,
        category_name,
        parent_category_id,
        is_billable,
        default_funding_entity_id,
        1 AS level,
        category_code AS path
    FROM dim_io_category
    WHERE parent_category_id IS NULL

    UNION ALL

    -- Recursive case: child categories
    SELECT
        c.id,
        c.category_code,
        c.category_name,
        c.parent_category_id,
        c.is_billable,
        c.default_funding_entity_id,
        ct.level + 1,
        ct.path || ' > ' || c.category_code
    FROM dim_io_category c
    JOIN category_tree ct ON c.parent_category_id = ct.id
)
SELECT
    ct.*,
    fe.entity_name AS default_funding_entity_name
FROM category_tree ct
LEFT JOIN dim_funding_entity fe ON ct.default_funding_entity_id = fe.id
ORDER BY path;

COMMENT ON VIEW v_io_category_hierarchy IS 'Hierarchical view of IO categories with full path and funding entity names';

-- ----------------------------------------------------------------------------
-- 4. VERIFICATION QUERY
-- ----------------------------------------------------------------------------

DO $$
DECLARE
    v_category_count INT;
    v_billable_count INT;
BEGIN
    SELECT COUNT(*) INTO v_category_count FROM dim_io_category WHERE is_active = TRUE;
    SELECT COUNT(*) INTO v_billable_count FROM dim_io_category WHERE is_billable = TRUE AND is_active = TRUE;

    RAISE NOTICE '✅ IO Category Dimension Created';
    RAISE NOTICE '   - Active categories: %', v_category_count;
    RAISE NOTICE '   - Billable categories: %', v_billable_count;
END $$;

-- View categories with funding entities
SELECT
    category_code,
    category_name,
    is_billable,
    fe.entity_name AS default_funding_entity,
    description
FROM dim_io_category ioc
LEFT JOIN dim_funding_entity fe ON ioc.default_funding_entity_id = fe.id
WHERE ioc.is_active = TRUE
ORDER BY is_billable DESC, category_code;

-- ============================================================================
-- END OF SCRIPT
-- ============================================================================
-- Next: Run sql-recharge-03-projects-enhancement.sql
-- ============================================================================
