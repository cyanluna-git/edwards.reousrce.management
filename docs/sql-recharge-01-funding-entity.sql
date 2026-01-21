-- ============================================================================
-- Recharge & Planning System: Part 1 - Funding Entity Dimension
-- ============================================================================
-- Version: 1.0
-- Date: 2026-01-21
-- Database: PostgreSQL 15+
-- Purpose: Create funding entity dimension for inter-company recharge tracking
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. FUNDING ENTITY DIMENSION
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS dim_funding_entity (
    id VARCHAR(50) PRIMARY KEY,
    entity_code VARCHAR(20) UNIQUE NOT NULL,
    entity_name VARCHAR(100) NOT NULL,
    legal_entity VARCHAR(100),                -- Full legal entity name
    country_code VARCHAR(3),                  -- ISO 3166-1 alpha-3 (USA, KOR)
    currency_code VARCHAR(3),                 -- ISO 4217 (USD, KRW, EUR)
    cost_center_prefix VARCHAR(10),           -- For GL account mapping
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add index for fast lookups
CREATE INDEX IF NOT EXISTS idx_funding_entity_code ON dim_funding_entity(entity_code);
CREATE INDEX IF NOT EXISTS idx_funding_entity_active ON dim_funding_entity(is_active) WHERE is_active = TRUE;

-- Add comment
COMMENT ON TABLE dim_funding_entity IS 'Funding entities for inter-company recharge. Tracks who pays the bill (VSS, SUN, Local Korea, etc.)';
COMMENT ON COLUMN dim_funding_entity.entity_code IS 'Short code used in IO naming (e.g., VSS, SUN, LOCAL_KR)';
COMMENT ON COLUMN dim_funding_entity.is_active IS 'Flag for soft delete - inactive entities cannot be assigned to new projects';

-- ----------------------------------------------------------------------------
-- 2. INSERT STANDARD FUNDING ENTITIES
-- ----------------------------------------------------------------------------

INSERT INTO dim_funding_entity (id, entity_code, entity_name, legal_entity, country_code, currency_code, cost_center_prefix) VALUES
('ENTITY_VSS', 'VSS', 'VSS Division', 'VSS Legal Entity Inc.', 'USA', 'USD', 'VSS'),
('ENTITY_SUN', 'SUN', 'SUN Division', 'SUN Legal Entity Inc.', 'USA', 'USD', 'SUN'),
('ENTITY_LOCAL_KR', 'LOCAL_KR', 'Local Korea', 'Edwards Korea Ltd.', 'KOR', 'KRW', 'KR'),
('ENTITY_SHARED', 'SHARED', 'Shared Services', 'Edwards Global Shared Services', 'USA', 'USD', 'SHARED')
ON CONFLICT (id) DO UPDATE
SET entity_name = EXCLUDED.entity_name,
    legal_entity = EXCLUDED.legal_entity,
    country_code = EXCLUDED.country_code,
    currency_code = EXCLUDED.currency_code,
    updated_at = CURRENT_TIMESTAMP;

-- ----------------------------------------------------------------------------
-- 3. ADD FUNDING_ENTITY_ID TO DEPARTMENTS
-- ----------------------------------------------------------------------------

-- Departments need to know their default funding entity for classification
ALTER TABLE departments ADD COLUMN IF NOT EXISTS
    funding_entity_id VARCHAR(50) REFERENCES dim_funding_entity(id);

-- Create index
CREATE INDEX IF NOT EXISTS idx_dept_funding_entity ON departments(funding_entity_id);

COMMENT ON COLUMN departments.funding_entity_id IS 'Default funding entity for this department. Used in classification algorithm.';

-- Set default for existing departments (assume all are LOCAL_KR unless specified)
UPDATE departments
SET funding_entity_id = 'ENTITY_LOCAL_KR'
WHERE funding_entity_id IS NULL;

-- ----------------------------------------------------------------------------
-- 4. VERIFICATION QUERY
-- ----------------------------------------------------------------------------

-- Verify installation
DO $$
DECLARE
    v_entity_count INT;
    v_dept_with_entity INT;
BEGIN
    SELECT COUNT(*) INTO v_entity_count FROM dim_funding_entity WHERE is_active = TRUE;
    SELECT COUNT(*) INTO v_dept_with_entity FROM departments WHERE funding_entity_id IS NOT NULL;

    RAISE NOTICE '✅ Funding Entity Dimension Created';
    RAISE NOTICE '   - Active entities: %', v_entity_count;
    RAISE NOTICE '   - Departments with entity assigned: %', v_dept_with_entity;

    IF v_entity_count < 3 THEN
        RAISE WARNING '⚠️  Expected at least 3 active entities (VSS, SUN, LOCAL_KR)';
    END IF;
END $$;

-- View entities
SELECT
    entity_code,
    entity_name,
    country_code,
    currency_code,
    is_active
FROM dim_funding_entity
ORDER BY entity_code;

-- ============================================================================
-- END OF SCRIPT
-- ============================================================================
-- Next: Run sql-recharge-02-io-category.sql
-- ============================================================================
