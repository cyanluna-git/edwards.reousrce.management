# Database Scripts Consolidation

## Summary
Consolidated scattered and failing database operation scripts into two unified, robust Python utilities. This standardizes how we handle both local development database operations and remote production server operations.

## Changes

### 1. Remote Operations (`scripts/remote_db_ops.py`)
- **Replaced:** `.gemini/commands/db_ops.toml` (which was causing parsing errors).
- **Functionality:**
  - `backup`: SSHs into the remote server, dumps the DB, and downloads it to `backups/`.
  - `restore`: Uploads a local backup to the remote server and restores it (Destructive).
- **Usage:**
  ```bash
  ./scripts/remote_db_ops.py backup
  ./scripts/remote_db_ops.py restore [filename]
  ```

### 2. Local Operations (`scripts/local_db_ops.py`)
- **Replaced:** `scripts/backup_db.py` and `scripts/restore_db.py`.
- **Functionality:**
  - `backup`: Dumps the local Docker `edwards-postgres` database to `backups/`.
  - `restore`: Restores a backup file to the local Docker database (Destructive).
- **Usage:**
  ```bash
  ./scripts/local_db_ops.py backup
  ./scripts/local_db_ops.py restore [filename]
  ```

## Benefits
- **Unified Interface:** Both scripts now share a common CLI structure (`backup`/`restore` subcommands).
- **Error Handling:** Improved error messages and color-coded output.
- **Maintenance:** Reduced number of files to maintain; removed non-functional TOML configuration.
