#!/usr/bin/env python3
"""
Restore worklogs from backup file to new database schema.
New schema has additional 'product_line_id' column which will be NULL.
"""
import subprocess
import sys

BACKUP_FILE = "backup_20251231_134753.sql"
DB_CONTAINER = "edwards-postgres"
DB_NAME = "edwards"
DB_USER = "postgres"


def extract_and_restore_worklogs():
    # Create a temporary SQL file with worklog inserts
    print("Extracting worklog data from backup...")

    with open(BACKUP_FILE, "r") as f:
        content = f.read()

    # Find COPY statement for worklogs
    start_marker = "COPY public.worklogs"
    end_marker = "\\."

    start_idx = content.find(start_marker)
    if start_idx == -1:
        print("No worklog data found in backup!")
        return

    # Find the end of COPY statement
    end_idx = content.find(end_marker, start_idx)
    if end_idx == -1:
        print("Could not find end of worklog data!")
        return

    worklog_section = content[start_idx : end_idx + len(end_marker)]

    # Get the column list from the COPY statement
    first_line = worklog_section.split("\n")[0]
    print(f"Found: {first_line}")

    # Count data rows
    data_lines = [
        l for l in worklog_section.split("\n")[1:] if l.strip() and l.strip() != "\\."
    ]
    print(f"Found {len(data_lines)} worklog records to restore.")

    if len(data_lines) == 0:
        print("No data to restore!")
        return

    # Write to temp file
    temp_file = "/tmp/worklogs_restore.sql"
    with open(temp_file, "w") as f:
        f.write(worklog_section)

    # Copy to container and execute
    print("Restoring worklogs to database...")

    # Copy file to container
    copy_cmd = f"docker cp {temp_file} {DB_CONTAINER}:/tmp/worklogs_restore.sql"
    result = subprocess.run(copy_cmd, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error copying file: {result.stderr}")
        return

    # Execute COPY command
    psql_cmd = f"docker exec {DB_CONTAINER} psql -U {DB_USER} -d {DB_NAME} -f /tmp/worklogs_restore.sql"
    result = subprocess.run(psql_cmd, shell=True, capture_output=True, text=True)

    if result.returncode == 0:
        print(f"✅ Successfully restored worklogs!")
        print(result.stdout)
    else:
        print(f"❌ Error restoring worklogs: {result.stderr}")


if __name__ == "__main__":
    extract_and_restore_worklogs()
