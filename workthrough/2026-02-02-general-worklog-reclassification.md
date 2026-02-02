# General Worklog Reclassification (2026-02-02)

## Overview
Reclassified worklogs currently assigned to the "General/Non-Project" project to more specific projects or marked as Team Internal (NULL project_id) using keyword-based logic.

## Progress
1.  **Script Improvements**:
    *   Updated `classify_general_fast.py` and `classify_general_with_ai.py` to handle Windows UTF-8 encoding issues when interacting with Docker/PostgreSQL.
    *   Added `.env` support and improved database update efficiency (batching) in `classify_general_with_ai.py`.
2.  **Execution Results (Fast Keyword-based)**:
    *   Total Analyzed: 35,973
    *   Moved to **NULL** (Team Internal Work: Leave, Admin, Meetings): 12,634
    *   Moved to **Specific Projects** (EUV, TSMC, etc.): 979
    *   Remaining in General: 23,287

## Next Steps
*   AI-based classification for the remaining 23k worklogs (currently blocked by connectivity issues).
*   Refinement of keyword mappings to further reduce the "General" pool.
