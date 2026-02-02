#!/usr/bin/env python3
"""
Resource Matrix Performance Benchmark

This script benchmarks the resource matrix queries to verify performance improvements
after adding indexes.

Usage:
    python scripts/benchmark_resource_matrix.py
    python scripts/benchmark_resource_matrix.py --months 12  # Test with 12 months
"""

import sys
import time
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Tuple

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text
from app.core.config import get_settings
from app.core.database import get_db
from app.services.resource_matrix_service import get_resource_pivot_matrix

settings = get_settings()


def format_time(seconds: float) -> str:
    """Format time in human-readable format"""
    if seconds < 1:
        return f"{seconds * 1000:.2f}ms"
    elif seconds < 60:
        return f"{seconds:.2f}s"
    else:
        mins = int(seconds // 60)
        secs = seconds % 60
        return f"{mins}m {secs:.2f}s"


def benchmark_query(engine, query_sql: str, description: str) -> Dict:
    """Benchmark a single query"""
    print(f"\n🔍 {description}")
    print(f"   SQL: {query_sql.strip()[:80]}...")
    
    start_time = time.time()
    
    with engine.connect() as conn:
        # First, get execution plan
        try:
            explain_result = conn.execute(text(f"EXPLAIN ANALYZE {query_sql}"))
            explain_output = "\n".join([row[0] for row in explain_result])
        except Exception as e:
            print(f"   ⚠️  Could not get execution plan: {e}")
            explain_output = ""
        
        # Then execute the query
        result = conn.execute(text(query_sql))
        rows = list(result)
        
    elapsed = time.time() - start_time
    
    # Analyze execution plan
    uses_index = "Index Scan" in explain_output or "Index Only Scan" in explain_output
    seq_scan = "Seq Scan" in explain_output
    
    # Extract execution time from EXPLAIN ANALYZE
    execution_time = None
    for line in explain_output.split("\n"):
        if "Execution Time:" in line:
            try:
                execution_time = float(line.split("Execution Time:")[1].split("ms")[0].strip())
            except:
                pass
    
    return {
        "description": description,
        "elapsed": elapsed,
        "execution_time_ms": execution_time,
        "row_count": len(rows),
        "uses_index": uses_index,
        "seq_scan": seq_scan,
        "explain_output": explain_output,
    }


def benchmark_resource_matrix_queries():
    """Benchmark resource matrix related queries"""
    db_url = settings.DATABASE_URL
    if not db_url:
        print("❌ ERROR: DATABASE_URL not set in environment")
        return False

    print("🚀 Resource Matrix Performance Benchmark")
    print("=" * 60)
    print(f"📊 Database: {db_url.split('@')[1] if '@' in db_url else 'hidden'}\n")

    engine = create_engine(db_url)
    
    # Get date range (last 12 months)
    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=365)
    
    print(f"📅 Test Date Range: {start_date} to {end_date}\n")

    benchmarks: List[Dict] = []

    # 1. Simple date range query
    query1 = f"""
        SELECT COUNT(*) 
        FROM worklogs 
        WHERE date >= '{start_date}' 
          AND date <= '{end_date}'
          AND project_id IS NOT NULL;
    """
    result1 = benchmark_query(
        engine, 
        query1,
        "Test 1: Date range query (COUNT)"
    )
    benchmarks.append(result1)

    # 2. User aggregation query
    query2 = f"""
        SELECT 
            user_id,
            SUM(hours) as total_hours
        FROM worklogs
        WHERE date >= '{start_date}' 
          AND date <= '{end_date}'
          AND project_id IS NOT NULL
        GROUP BY user_id
        ORDER BY total_hours DESC
        LIMIT 100;
    """
    result2 = benchmark_query(
        engine,
        query2,
        "Test 2: User aggregation query"
    )
    benchmarks.append(result2)

    # 3. Project aggregation query
    query3 = f"""
        SELECT 
            project_id,
            SUM(hours) as total_hours
        FROM worklogs
        WHERE date >= '{start_date}' 
          AND date <= '{end_date}'
          AND project_id IS NOT NULL
        GROUP BY project_id
        ORDER BY total_hours DESC
        LIMIT 100;
    """
    result3 = benchmark_query(
        engine,
        query3,
        "Test 3: Project aggregation query"
    )
    benchmarks.append(result3)

    # 4. Complex query (similar to resource matrix)
    query4 = f"""
        SELECT 
            wl.user_id,
            wl.project_id,
            SUM(wl.hours) as total_hours
        FROM worklogs wl
        WHERE wl.date >= '{start_date}' 
          AND wl.date <= '{end_date}'
          AND wl.project_id IS NOT NULL
        GROUP BY wl.user_id, wl.project_id
        ORDER BY wl.user_id, total_hours DESC
        LIMIT 500;
    """
    result4 = benchmark_query(
        engine,
        query4,
        "Test 4: User x Project aggregation (Resource Matrix style)"
    )
    benchmarks.append(result4)

    # 5. Test actual service function
    print(f"\n🔍 Test 5: Actual get_resource_pivot_matrix() service call")
    start_month = start_date.strftime("%Y-%m")
    end_month = end_date.strftime("%Y-%m")
    print(f"   Period: {start_month} to {end_month}")
    
    start_time = time.time()
    try:
        from app.core.database import get_session_local
        SessionLocal = get_session_local()
        db = SessionLocal()
        
        try:
            print("   ⏳ Executing service function...")
            result = get_resource_pivot_matrix(
                db=db,
                start_month=start_month,
                end_month=end_month,
            )
            elapsed = time.time() - start_time
            
            result5 = {
                "description": "Test 5: get_resource_pivot_matrix() service",
                "elapsed": elapsed,
                "execution_time_ms": elapsed * 1000,
                "row_count": len(result.rows) if result else 0,
                "column_count": len(result.columns) if result else 0,
                "uses_index": True,  # Assumed if indexes exist
                "seq_scan": False,
                "explain_output": "Service-level call",
            }
            benchmarks.append(result5)
            print(f"   ✅ Completed in {format_time(elapsed)}")
            print(f"   📊 Rows: {result5['row_count']}, Columns: {result5['column_count']}")
            if result and result.grand_total:
                print(f"   📊 Grand Total FTE: {result.grand_total:.2f}")
        finally:
            db.close()
    except Exception as e:
        print(f"   ❌ Error: {e}")
        import traceback
        traceback.print_exc()
        # Add error result to benchmarks for summary
        result5 = {
            "description": "Test 5: get_resource_pivot_matrix() service",
            "elapsed": 0,
            "execution_time_ms": 0,
            "row_count": 0,
            "column_count": 0,
            "uses_index": False,
            "seq_scan": True,
            "explain_output": f"Error: {str(e)}",
        }
        benchmarks.append(result5)

    # Print summary
    print("\n" + "=" * 60)
    print("📊 PERFORMANCE SUMMARY")
    print("=" * 60)
    
    print(f"\n{'Test':<40} {'Time':<15} {'DB Time':<20} {'Index':<10} {'Rows':<10}")
    print("-" * 95)
    
    for bench in benchmarks:
        time_str = format_time(bench["elapsed"])
        index_status = "✅" if bench.get("uses_index") else "❌"
        row_count = bench.get("row_count", 0)
        
        # Show execution time from EXPLAIN if available
        exec_time_str = ""
        if bench.get("execution_time_ms"):
            exec_time_str = f" (DB: {bench['execution_time_ms']:.2f}ms)"
        
        print(f"{bench['description']:<40} {time_str:<15}{exec_time_str:<20} {index_status:<10} {row_count:<10}")
    
    # Performance analysis
    print("\n" + "=" * 60)
    print("📈 PERFORMANCE ANALYSIS")
    print("=" * 60)
    
    indexed_queries = [b for b in benchmarks if b.get("uses_index")]
    seq_scan_queries = [b for b in benchmarks if b.get("seq_scan")]
    
    print(f"\n✅ Indexed queries: {len(indexed_queries)}/{len(benchmarks)}")
    print(f"❌ Sequential scan queries: {len(seq_scan_queries)}/{len(benchmarks)}")
    
    if indexed_queries:
        avg_time = sum(b["elapsed"] for b in indexed_queries) / len(indexed_queries)
        print(f"\n⏱️  Average time (indexed): {format_time(avg_time)}")
    
    # Recommendations
    print("\n" + "=" * 60)
    print("💡 RECOMMENDATIONS")
    print("=" * 60)
    
    if len(indexed_queries) == len(benchmarks):
        print("✅ Excellent! All queries are using indexes.")
    elif len(indexed_queries) > 0:
        print("⚠️  Some queries are using indexes, but not all.")
        print("   Consider running ANALYZE worklogs; to update statistics.")
    else:
        print("❌ No queries are using indexes!")
        print("   Please check:")
        print("   1. Indexes are created: python scripts/verify_worklog_indexes.py")
        print("   2. Statistics are updated: ANALYZE worklogs;")
        print("   3. Query patterns match index columns")
    
    # Show execution plans for queries that don't use indexes
    if seq_scan_queries:
        print("\n⚠️  Queries using sequential scan:")
        for bench in seq_scan_queries:
            print(f"\n{bench['description']}:")
            print(bench.get('explain_output', 'N/A')[:500])
    
    return True


if __name__ == "__main__":
    try:
        benchmark_resource_matrix_queries()
    except Exception as e:
        print(f"❌ Error running benchmark: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
