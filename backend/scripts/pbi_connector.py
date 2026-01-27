"""
Power BI Desktop Connector

Connects to Power BI Desktop running locally and executes DAX queries.
Returns results as pandas DataFrames.

Requirements (Windows only):
- Power BI Desktop running with a .pbix file loaded
- ADOMD.NET 150 or 160 DLL (included with Power BI Desktop)
- pyadomd or pbi-local-connector package

Usage:
    python -m scripts.pbi_connector --test
    python -m scripts.pbi_connector --query "EVALUATE db_users"
"""

import sys
import platform
import argparse
import subprocess
import re
from pathlib import Path
from typing import Optional, Dict, Any, List

# Check platform
IS_WINDOWS = platform.system() == "Windows"


def get_pbi_local_port() -> Optional[int]:
    """
    Find the local port used by Power BI Desktop Analysis Services.

    Power BI Desktop runs a local Analysis Services instance that listens
    on a random port. This function finds that port.

    Returns:
        Port number if found, None otherwise
    """
    if not IS_WINDOWS:
        print("Warning: Power BI port detection requires Windows")
        return None

    try:
        # Method 1: Check msmdsrv.port.txt files
        local_app_data = Path.home() / "AppData" / "Local" / "Microsoft" / "Power BI Desktop"

        if local_app_data.exists():
            # Find the most recent port file
            port_files = list(local_app_data.rglob("msmdsrv.port.txt"))

            if port_files:
                # Sort by modification time, get most recent
                port_files.sort(key=lambda p: p.stat().st_mtime, reverse=True)

                with open(port_files[0], "r") as f:
                    port_str = f.read().strip()
                    return int(port_str)

        # Method 2: Use netstat to find msmdsrv.exe port
        result = subprocess.run(
            ["netstat", "-ano"],
            capture_output=True,
            text=True,
            shell=True
        )

        # Find PID of msmdsrv.exe (Analysis Services)
        tasklist = subprocess.run(
            ["tasklist", "/FI", "IMAGENAME eq msmdsrv.exe", "/FO", "CSV"],
            capture_output=True,
            text=True,
            shell=True
        )

        # Parse PID
        for line in tasklist.stdout.split("\n"):
            if "msmdsrv.exe" in line:
                # CSV format: "msmdsrv.exe","12345",...
                parts = line.split(",")
                if len(parts) >= 2:
                    pid = parts[1].strip('"')

                    # Find port for this PID
                    for netstat_line in result.stdout.split("\n"):
                        if pid in netstat_line and "LISTENING" in netstat_line:
                            # Parse port from line like: TCP 127.0.0.1:12345 ...
                            match = re.search(r"127\.0\.0\.1:(\d+)", netstat_line)
                            if match:
                                return int(match.group(1))

        return None

    except Exception as e:
        print(f"Error detecting Power BI port: {e}")
        return None


def get_pbi_connection_string(port: int) -> str:
    """
    Build the connection string for Power BI Desktop.

    Args:
        port: The local port Power BI is listening on

    Returns:
        ADOMD.NET connection string
    """
    return f"Data Source=localhost:{port}"


class PowerBIConnector:
    """
    Connector for Power BI Desktop local instance.

    Uses pyadomd or pbi-local-connector to execute DAX queries
    against the local Analysis Services instance.
    """

    def __init__(self, port: Optional[int] = None):
        """
        Initialize the connector.

        Args:
            port: Specific port to use. If None, auto-detect.
        """
        self.port = port
        self._connection = None
        self._connector_type: Optional[str] = None

        # Detect available connector library
        self._detect_connector()

    def _detect_connector(self):
        """Detect which Python connector library is available."""
        if not IS_WINDOWS:
            self._connector_type = None
            return

        try:
            import pbi_local_connector
            self._connector_type = "pbi-local-connector"
            return
        except ImportError:
            pass

        try:
            from pyadomd import Pyadomd
            self._connector_type = "pyadomd"
            return
        except ImportError:
            pass

        self._connector_type = None

    def connect(self) -> bool:
        """
        Connect to Power BI Desktop.

        Returns:
            True if connection successful, False otherwise
        """
        if not IS_WINDOWS:
            print("Error: Power BI connector requires Windows")
            return False

        if self._connector_type is None:
            print("Error: No Power BI connector library found.")
            print("Install one of: pip install pbi-local-connector  OR  pip install pyadomd")
            return False

        # Auto-detect port if not specified
        if self.port is None:
            self.port = get_pbi_local_port()

        if self.port is None:
            print("Error: Could not detect Power BI Desktop port.")
            print("Make sure Power BI Desktop is running with a .pbix file loaded.")
            return False

        print(f"Connecting to Power BI Desktop on port {self.port}...")

        try:
            if self._connector_type == "pbi-local-connector":
                return self._connect_pbi_local()
            elif self._connector_type == "pyadomd":
                return self._connect_pyadomd()

            return False

        except Exception as e:
            print(f"Connection error: {e}")
            return False

    def _connect_pbi_local(self) -> bool:
        """Connect using pbi-local-connector library."""
        try:
            import pbi_local_connector as pbi

            # pbi-local-connector auto-detects the port
            self._connection = pbi.connect()
            return True

        except Exception as e:
            print(f"pbi-local-connector error: {e}")
            return False

    def _connect_pyadomd(self) -> bool:
        """Connect using pyadomd library."""
        try:
            from pyadomd import Pyadomd

            conn_str = get_pbi_connection_string(self.port)
            self._connection = Pyadomd(conn_str)
            return True

        except Exception as e:
            print(f"pyadomd error: {e}")
            return False

    def execute_dax(self, dax_query: str) -> Optional["DataFrame"]:
        """
        Execute a DAX query and return results as a pandas DataFrame.

        Args:
            dax_query: DAX query string (e.g., "EVALUATE db_users")

        Returns:
            pandas DataFrame with results, or None on error
        """
        if self._connection is None:
            print("Error: Not connected. Call connect() first.")
            return None

        try:
            import pandas as pd

            if self._connector_type == "pbi-local-connector":
                # pbi-local-connector has its own query method
                cursor = self._connection.cursor()
                cursor.execute(dax_query)

                # Get column names and data
                columns = [desc[0] for desc in cursor.description]
                data = cursor.fetchall()

                return pd.DataFrame(data, columns=columns)

            elif self._connector_type == "pyadomd":
                # pyadomd uses execute() which returns a cursor
                with self._connection.cursor() as cursor:
                    cursor.execute(dax_query)

                    # Get column names
                    columns = [desc[0] for desc in cursor.description]
                    data = cursor.fetchall()

                    return pd.DataFrame(data, columns=columns)

            return None

        except Exception as e:
            print(f"DAX query error: {e}")
            return None

    def get_tables(self) -> List[str]:
        """
        Get list of tables available in the Power BI model.

        Returns:
            List of table names
        """
        dax = """
        EVALUATE
        SELECTCOLUMNS(
            INFO.TABLES(),
            "TableName", [Name]
        )
        """

        df = self.execute_dax(dax)
        if df is not None and not df.empty:
            return df["TableName"].tolist()
        return []

    def get_table_columns(self, table_name: str) -> List[Dict[str, Any]]:
        """
        Get column information for a specific table.

        Args:
            table_name: Name of the table

        Returns:
            List of column info dictionaries
        """
        dax = f"""
        EVALUATE
        SELECTCOLUMNS(
            FILTER(
                INFO.COLUMNS(),
                [TableName] = "{table_name}"
            ),
            "ColumnName", [Name],
            "DataType", [DataType],
            "IsNullable", [IsNullable]
        )
        """

        df = self.execute_dax(dax)
        if df is not None and not df.empty:
            return df.to_dict("records")
        return []

    def close(self):
        """Close the connection."""
        if self._connection is not None:
            try:
                self._connection.close()
            except:
                pass
            self._connection = None


def test_connection():
    """Test Power BI connection and list available tables."""
    print("=" * 60)
    print("Power BI Desktop Connection Test")
    print("=" * 60)

    if not IS_WINDOWS:
        print("\nWARNING: This script requires Windows to connect to Power BI Desktop.")
        print("On macOS/Linux, you would need to:")
        print("  1. Run this script on a Windows machine")
        print("  2. Export data from Power BI manually")
        print("  3. Use Power BI REST API (requires Power BI Pro/Premium)")
        return False

    connector = PowerBIConnector()

    if not connector.connect():
        print("\nConnection failed. Make sure:")
        print("  1. Power BI Desktop is running")
        print("  2. A .pbix file is loaded")
        print("  3. pyadomd or pbi-local-connector is installed")
        return False

    print(f"\nConnected successfully on port {connector.port}")

    # List tables
    print("\n--- Available Tables ---")
    tables = connector.get_tables()

    if tables:
        for table in tables:
            print(f"  - {table}")

        # Show columns for each expected table
        expected_tables = ["db_users", "db_projects", "db_worktype", "tb_worklog"]

        for table in expected_tables:
            if table in tables:
                print(f"\n--- Columns in {table} ---")
                columns = connector.get_table_columns(table)
                for col in columns:
                    print(f"  - {col['ColumnName']}: {col['DataType']}")
    else:
        print("  No tables found or error retrieving tables")

    connector.close()
    print("\nTest complete.")
    return True


def main():
    parser = argparse.ArgumentParser(description="Power BI Desktop Connector")
    parser.add_argument("--test", action="store_true", help="Test connection and list tables")
    parser.add_argument("--query", type=str, help="Execute a DAX query")
    parser.add_argument("--port", type=int, help="Specify Power BI port (auto-detect if not specified)")

    args = parser.parse_args()

    if args.test:
        test_connection()
    elif args.query:
        connector = PowerBIConnector(port=args.port)
        if connector.connect():
            df = connector.execute_dax(args.query)
            if df is not None:
                print(df.to_string())
            connector.close()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
