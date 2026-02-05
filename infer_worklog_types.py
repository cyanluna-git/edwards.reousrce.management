#!/usr/bin/env python3
"""
Infer Worklog Types Script
Updates worklogs with NULL work_type_category_id based on description keywords.
"""
import subprocess
import sys

DB_CONTAINER = "edwards-postgres"
DB_USER = "postgres"
DB_NAME = "edwards"

# Mapping rules: (Category ID, List of Keywords)
RULES = [
    (38, ["holiday", "day off", "dayoff", "반차", "반휴", "연차", "휴가", "off", "예비군", "공가", "병가", "sick"]),  # Leave (ABS-LVE)
    (30, ["study", "training", "교육", "learning", "tutorial"]),         # Self-Study (KNW-STD)
    (73, ["weekly", "meeting", "회의", "공유", "scrum", "standup", "sync", "workshop", "1to1", "one on one", "talk", "bbl"]), # Internal Meeting (MTG-INT)
    (6,  ["support", "지원", "helping", "assist"]),                       # Support (SUP)
    (11, ["작성", "개발", "program", "code", "implement", "fix", "debug"]), # SW Dev (ENG-SW)
    (36, ["time attendant", "admin", "행정", "expense", "general"]),       # Admin (ADM-GEN)
]

def run_psql(sql):
    cmd = [
        "docker", "exec", "-i", DB_CONTAINER,
        "psql", "-U", DB_USER, "-d", DB_NAME, "-c", sql
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result

def main():
    print("Starting worklog inference...")
    
    total_updated = 0
    
    for cat_id, keywords in RULES:
        # Construct CASE WHEN or OR clauses for SQL
        # We'll do simple multiple updates for clarity and safety, 
        # or a single update with regex/like per rule.
        
        # Using ILIKE for case-insensitive matching
        conditions = [f"description ILIKE '%{kw}%'" for kw in keywords]
        where_clause = " OR ".join(conditions)
        
        sql = f"""
            UPDATE worklogs 
            SET work_type_category_id = {cat_id} 
            WHERE work_type_category_id IS NULL 
            AND ({where_clause});
        """
        
        print(f"Applying rule for Category ID {cat_id} (Keywords: {keywords})...")
        result = run_psql(sql)
        
        if result.returncode != 0:
            print(f"Error: {result.stderr}")
        else:
            # Extract number of rows updated if possible, output usually "UPDATE <count>"
            print(f"Result: {result.stdout.strip()}")

    # Final check
    check_sql = "SELECT count(*) FROM worklogs WHERE work_type_category_id IS NULL;"
    res = run_psql(check_sql)
    print(f"\nRemaining N/A worklogs: {res.stdout.strip().splitlines()[-1].strip()}")

if __name__ == "__main__":
    main()
