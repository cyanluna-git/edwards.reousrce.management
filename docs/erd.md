erDiagram
    %% ===== ACCESS CONTROL =====
    USERS {
        UUID id PK
        TEXT azure_oid "nullable, for MSAL auth"
        TEXT username
        TEXT email
        TEXT full_name
        TEXT hashed_password "nullable if Azure AD only"
        TEXT role "admin | scenario_engineer | operator"
        BOOL is_active
        TIMESTAMP created_at
        TIMESTAMP updated_at
        TIMESTAMP last_login
    }

    %% ===== PRODUCT HIERARCHY =====
    BUSINESS_UNITS {
        INT id PK
        TEXT code "e.g. EUV, ABT, ACM"
        TEXT name
        TEXT description
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    GENERATIONS {
        INT id PK
        INT business_unit_id FK
        TEXT code "e.g. Gen4, Protron"
        TEXT name
        TEXT description
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    PRODUCT_LINES {
        INT id PK
        INT generation_id FK
        TEXT code "e.g. NKB943, Dual"
        TEXT name
        TEXT description
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    %% ===== CATALOG & FORM AUTHORING (Scenario Engineer) =====
    FTCC_CATALOGS {
        INT id PK
        INT product_line_id FK
        TEXT ftcc_version "e.g. v1.0, v2.1"
        TEXT status "draft | review | published | archived"
        TEXT description
        UUID created_by FK
        UUID published_by FK "nullable"
        TIMESTAMP created_at
        TIMESTAMP published_at "nullable"
        TIMESTAMP updated_at
    }

    FORM_DEFINITIONS {
        UUID id PK
        INT catalog_id FK
        TEXT section_number "e.g. 7.5.10.1"
        TEXT title
        TEXT preamble "nullable"
        TEXT automation_type "manual | full_auto | semi_auto_read | semi_auto_write"
        JSONB form_schema "field definitions for operator UI"
        TEXT product_variant "e.g. NKB943000"
        INT version "increments on edit"
        UUID created_by FK
        UUID updated_by FK
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    FORM_DEF_REVISIONS {
        INT id PK
        UUID form_definition_id FK
        INT revision_number
        TEXT title
        TEXT preamble
        TEXT automation_type
        JSONB form_schema "snapshot at this revision"
        UUID changed_by FK
        TEXT change_summary
        TIMESTAMP created_at
    }

    GHERKIN_SCRIPTS {
        UUID id PK
        UUID form_definition_id FK "only for auto and semi_auto tasks"
        TEXT scenario_tag "e.g. @pump-start"
        TEXT feature_content "full Gherkin text"
        INT version
        UUID created_by FK
        UUID updated_by FK
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    CATALOG_REVIEWS {
        INT id PK
        INT catalog_id FK
        UUID reviewer_id FK
        TEXT comment
        TEXT status "open | resolved"
        TIMESTAMP created_at
        TIMESTAMP resolved_at "nullable"
    }

    %% ===== EXECUTION & RESULTS (synced from edge-runner) =====
    EXECUTIONS {
        UUID id PK
        INT catalog_id FK
        TEXT edge_execution_id "original edge-runner id"
        TEXT status "CREATED | IN_PROGRESS | PAUSED | COMPLETED | FAILED | DROPPED"
        UUID operator_id FK
        TEXT purpose
        TEXT device_id FK "nullable"
        TEXT execution_mode "gherkin | inspection | mixed"
        INT total_tasks
        INT completed_tasks
        INT passed
        INT failed
        TIMESTAMP created_at
        TIMESTAMP started_at
        TIMESTAMP completed_at
        TEXT sync_status "pending | synced | conflict"
        TIMESTAMP synced_at
    }

    INSPECTION_RESULTS {
        INT id PK
        UUID execution_id FK
        UUID form_definition_id FK
        TEXT task_number
        UUID operator_id FK
        TEXT result "PASS | FAIL | NA | SKIP"
        JSONB values_json "operator-entered field values"
        TEXT notes
        TIMESTAMP submitted_at
    }

    CORRECTIVE_ACTIONS {
        INT id PK
        INT inspection_result_id FK
        UUID execution_id FK
        TEXT action_type "part_replacement | rework | config_change | other"
        TEXT description
        UUID operator_id FK
        TIMESTAMP created_at
        TIMESTAMP resolved_at "nullable"
        TEXT resolution_notes "nullable"
        INT retest_result_id "nullable, points to INSPECTION_RESULTS"
    }

    EVIDENCE_FILES {
        INT id PK
        UUID execution_id FK
        TEXT task_number "nullable"
        INT inspection_result_id FK "nullable"
        TEXT file_name
        TEXT storage_uri "local path or blob URI"
        TEXT file_type "photo | document | screenshot | video | log"
        INT file_size_bytes
        UUID uploaded_by FK
        TIMESTAMP uploaded_at
    }

    %% ===== DEFECT TRACKING =====
    DEFECTS {
        INT id PK
        UUID execution_id FK "nullable"
        INT inspection_result_id FK "nullable"
        UUID form_definition_id FK "nullable"
        INT product_line_id FK
        TEXT device_id FK "nullable"
        TEXT title
        TEXT description
        TEXT defect_type "functional | performance | safety | cosmetic"
        TEXT severity "critical | major | minor"
        TEXT status "open | in_progress | resolved | closed"
        TEXT jira_key "nullable, e.g. EUV-3400"
        UUID created_by FK
        UUID assigned_to FK "nullable"
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    AUDIT_LOGS {
        INT id PK
        UUID execution_id FK "nullable"
        TEXT action "CREATE | START | PAUSE | INSPECT_SUBMIT | etc."
        UUID actor_id FK
        JSONB details
        TIMESTAMP timestamp
    }

    DEVICES {
        TEXT device_id PK
        TEXT device_name
        TEXT device_type
        TEXT protocol "modbus | hostlink"
        TEXT ip_address "nullable"
        INT port "nullable"
        TEXT status "ONLINE | OFFLINE | ERROR"
        TIMESTAMP last_seen
        TEXT location
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    GATEWAY_HEALTH {
        INT id PK
        TEXT system_id
        TEXT status "healthy | degraded | down"
        TIMESTAMP timestamp
        INT uptime_seconds
        INT devices_online
        INT devices_total
        TIMESTAMP created_at
    }


    %% Product hierarchy
    BUSINESS_UNITS ||--o{ GENERATIONS : "has"
    GENERATIONS ||--o{ PRODUCT_LINES : "has"

    %% Catalog authoring
    PRODUCT_LINES ||--o{ FTCC_CATALOGS : "product_line_id"
    USERS ||--o{ FTCC_CATALOGS : "created_by"
    FTCC_CATALOGS ||--o{ FORM_DEFINITIONS : "catalog_id"
    FTCC_CATALOGS ||--o{ CATALOG_REVIEWS : "catalog_id"
    USERS ||--o{ CATALOG_REVIEWS : "reviewer_id"

    %% Form definition editing
    USERS ||--o{ FORM_DEFINITIONS : "created_by / updated_by"
    FORM_DEFINITIONS ||--o{ FORM_DEF_REVISIONS : "form_definition_id"
    USERS ||--o{ FORM_DEF_REVISIONS : "changed_by"
    FORM_DEFINITIONS ||--o| GHERKIN_SCRIPTS : "form_definition_id"
    USERS ||--o{ GHERKIN_SCRIPTS : "created_by"

    %% Execution (synced from edge)
    FTCC_CATALOGS ||--o{ EXECUTIONS : "catalog_id"
    USERS ||--o{ EXECUTIONS : "operator_id"
    DEVICES ||--o{ EXECUTIONS : "device_id"
    EXECUTIONS ||--o{ INSPECTION_RESULTS : "execution_id"
    FORM_DEFINITIONS ||--o{ INSPECTION_RESULTS : "form_definition_id"
    USERS ||--o{ INSPECTION_RESULTS : "operator_id"

    %% Corrective actions & evidence
    INSPECTION_RESULTS ||--o{ CORRECTIVE_ACTIONS : "inspection_result_id"
    EXECUTIONS ||--o{ EVIDENCE_FILES : "execution_id"
    INSPECTION_RESULTS ||--o{ EVIDENCE_FILES : "inspection_result_id"

    %% Defects
    PRODUCT_LINES ||--o{ DEFECTS : "product_line_id"
    EXECUTIONS ||--o{ DEFECTS : "execution_id"
    INSPECTION_RESULTS ||--o{ DEFECTS : "inspection_result_id"
    USERS ||--o{ DEFECTS : "created_by / assigned_to"

    %% Audit
    EXECUTIONS ||--o{ AUDIT_LOGS : "execution_id"
    USERS ||--o{ AUDIT_LOGS : "actor_id"
