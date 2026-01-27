#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = [
#   "duckdb",
# ]
# ///
"""
Demonstrate DuckDB's ability to query files directly.

One of DuckDB's killer features is querying CSV, Parquet, and JSON files
directly using SQL - no need to load data into a database first!
"""

import duckdb
import time

def demo_csv_queries():
    """Query CSV files directly with SQL."""
    print("=" * 70)
    print("DIRECT CSV QUERYING")
    print("=" * 70)

    # Simple query - no loading required!
    print("\n1. Simple aggregation on CSV:")
    result = duckdb.sql("""
        SELECT
            region,
            loyalty_tier,
            COUNT(*) as customer_count
        FROM 'data/customers.csv'
        GROUP BY region, loyalty_tier
        ORDER BY region, customer_count DESC
    """)
    print(result)

    # Join across CSV files without any setup
    print("\n2. Join multiple CSV files (customers + transactions):")
    result = duckdb.sql("""
        SELECT
            c.region,
            c.loyalty_tier,
            COUNT(DISTINCT t.transaction_id) as num_transactions,
            ROUND(SUM(t.total_amount), 2) as total_revenue,
            ROUND(AVG(t.total_amount), 2) as avg_transaction
        FROM 'data/transactions.csv' t
        JOIN 'data/customers.csv' c ON t.customer_id = c.customer_id
        GROUP BY c.region, c.loyalty_tier
        ORDER BY total_revenue DESC
        LIMIT 10
    """)
    print(result)

def demo_parquet_queries():
    """Query Parquet files - DuckDB's sweet spot."""
    print("\n" + "=" * 70)
    print("DIRECT PARQUET QUERYING (DuckDB's Sweet Spot)")
    print("=" * 70)

    # Parquet files store column statistics, enabling query optimization
    print("\n1. DuckDB reads only needed columns from Parquet:")

    start = time.perf_counter()
    # This only reads the 'total_amount' column due to columnar format
    result = duckdb.sql("""
        SELECT
            SUM(total_amount) as total_revenue,
            AVG(total_amount) as avg_transaction,
            COUNT(*) as num_transactions
        FROM 'data/transactions.parquet'
    """)
    elapsed = time.perf_counter() - start
    print(result)
    print(f"   Execution time: {elapsed*1000:.2f} ms")

    # Parquet predicate pushdown
    print("\n2. Predicate pushdown - DuckDB skips irrelevant row groups:")
    start = time.perf_counter()
    result = duckdb.sql("""
        SELECT
            strftime(transaction_date::DATE, '%Y-%m') as month,
            SUM(total_amount) as monthly_revenue
        FROM 'data/transactions.parquet'
        WHERE transaction_date >= '2024-01-01'
        GROUP BY month
        ORDER BY month
    """)
    elapsed = time.perf_counter() - start
    print(result)
    print(f"   Execution time: {elapsed*1000:.2f} ms")

    # Complex analytical query
    print("\n3. Complex 3-way join on Parquet files:")
    start = time.perf_counter()
    result = duckdb.sql("""
        SELECT
            p.category,
            c.region,
            COUNT(*) as num_sales,
            ROUND(SUM(t.total_amount), 2) as revenue,
            ROUND(SUM(t.quantity * (t.unit_price - p.cost)), 2) as gross_profit
        FROM 'data/transactions.parquet' t
        JOIN 'data/products.parquet' p ON t.product_id = p.product_id
        JOIN 'data/customers.parquet' c ON t.customer_id = c.customer_id
        WHERE p.is_active = true
        GROUP BY p.category, c.region
        ORDER BY revenue DESC
        LIMIT 15
    """)
    elapsed = time.perf_counter() - start
    print(result)
    print(f"   Execution time: {elapsed*1000:.2f} ms")

def demo_json_queries():
    """Query JSON files with SQL."""
    print("\n" + "=" * 70)
    print("DIRECT JSON QUERYING")
    print("=" * 70)

    print("\n1. Query newline-delimited JSON directly:")
    result = duckdb.sql("""
        SELECT
            payment_method,
            channel,
            COUNT(*) as transactions,
            ROUND(SUM(total_amount), 2) as revenue
        FROM 'data/transactions_sample.json'
        GROUP BY payment_method, channel
        ORDER BY revenue DESC
    """)
    print(result)

def demo_mixed_format_queries():
    """Query across different file formats in a single query!"""
    print("\n" + "=" * 70)
    print("MIXED FORMAT QUERIES (The Really Cool Part)")
    print("=" * 70)

    print("\nJoin CSV, Parquet, and JSON in a single query:")
    result = duckdb.sql("""
        SELECT
            c.loyalty_tier,
            COUNT(DISTINCT c.customer_id) as customers,
            COUNT(t.transaction_id) as transactions,
            ROUND(SUM(t.total_amount), 2) as revenue
        FROM 'data/customers.csv' c
        JOIN 'data/transactions.parquet' t ON c.customer_id = t.customer_id
        GROUP BY c.loyalty_tier
        ORDER BY revenue DESC
    """)
    print(result)

def demo_glob_patterns():
    """Query multiple files using glob patterns."""
    print("\n" + "=" * 70)
    print("GLOB PATTERNS - Query Multiple Files at Once")
    print("=" * 70)

    print("\n1. Query all Parquet files:")
    result = duckdb.sql("""
        SELECT
            filename,
            COUNT(*) as row_count
        FROM read_parquet('data/*.parquet', filename=true)
        GROUP BY filename
    """)
    print(result)

    print("\n2. Query all CSV files with schema discovery:")
    result = duckdb.sql("""
        SELECT
            filename,
            COUNT(*) as row_count
        FROM read_csv_auto('data/*.csv', filename=true)
        GROUP BY filename
    """)
    print(result)

def demo_file_metadata():
    """Inspect file metadata without full scan."""
    print("\n" + "=" * 70)
    print("FILE METADATA INSPECTION")
    print("=" * 70)

    print("\n1. Parquet file metadata (schema + statistics):")
    result = duckdb.sql("""
        SELECT * FROM parquet_schema('data/transactions.parquet')
    """)
    print(result)

    print("\n2. Parquet file statistics:")
    result = duckdb.sql("""
        SELECT
            file_name,
            row_group_id,
            row_group_num_rows,
            row_group_bytes
        FROM parquet_metadata('data/transactions.parquet')
        LIMIT 5
    """)
    print(result)

def compare_csv_vs_parquet():
    """Compare query performance: CSV vs Parquet."""
    print("\n" + "=" * 70)
    print("PERFORMANCE COMPARISON: CSV vs PARQUET")
    print("=" * 70)

    query_csv = """
        SELECT
            payment_method,
            COUNT(*) as cnt,
            SUM(total_amount) as revenue
        FROM 'data/transactions.csv'
        GROUP BY payment_method
    """

    query_parquet = """
        SELECT
            payment_method,
            COUNT(*) as cnt,
            SUM(total_amount) as revenue
        FROM 'data/transactions.parquet'
        GROUP BY payment_method
    """

    # Warm up
    duckdb.sql(query_csv)
    duckdb.sql(query_parquet)

    # Benchmark
    iterations = 5

    csv_times = []
    for _ in range(iterations):
        start = time.perf_counter()
        duckdb.sql(query_csv)
        csv_times.append(time.perf_counter() - start)

    parquet_times = []
    for _ in range(iterations):
        start = time.perf_counter()
        duckdb.sql(query_parquet)
        parquet_times.append(time.perf_counter() - start)

    avg_csv = sum(csv_times) / len(csv_times) * 1000
    avg_parquet = sum(parquet_times) / len(parquet_times) * 1000

    print(f"\nAggregation query ({iterations} iterations):")
    print(f"  CSV average:     {avg_csv:.2f} ms")
    print(f"  Parquet average: {avg_parquet:.2f} ms")
    print(f"  Speedup:         {avg_csv/avg_parquet:.1f}x faster with Parquet")

    # File size comparison
    import os
    csv_size = os.path.getsize("data/transactions.csv") / (1024 * 1024)
    parquet_size = os.path.getsize("data/transactions.parquet") / (1024 * 1024)

    print(f"\nFile sizes:")
    print(f"  CSV:     {csv_size:.2f} MB")
    print(f"  Parquet: {parquet_size:.2f} MB")
    print(f"  Compression ratio: {csv_size/parquet_size:.1f}x smaller with Parquet")

def main():
    """Run all demonstrations."""
    print("DuckDB Direct File Querying Demonstration")
    print("=" * 70)
    print("\nDuckDB can query files directly using SQL - no ETL required!")
    print("This is one of its most powerful features for data analysis.\n")

    demo_csv_queries()
    demo_parquet_queries()
    demo_json_queries()
    demo_mixed_format_queries()
    demo_glob_patterns()
    demo_file_metadata()
    compare_csv_vs_parquet()

    print("\n" + "=" * 70)
    print("KEY TAKEAWAYS")
    print("=" * 70)
    print("""
1. Zero-setup queries: Query CSV/Parquet/JSON directly with SQL
2. Automatic schema detection: DuckDB infers column types
3. Cross-format joins: Mix CSV, Parquet, and JSON in one query
4. Parquet optimization: Columnar reads + predicate pushdown
5. Glob patterns: Query multiple files as one logical table
6. Metadata inspection: Check file schema without loading data
""")

if __name__ == "__main__":
    main()
