#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = [
#   "duckdb",
#   "pandas",
#   "pyarrow",
# ]
# ///
"""
Demonstrate DuckDB's seamless Python integration.

DuckDB works exceptionally well with Python data science tools:
- Zero-copy exchange with Pandas DataFrames
- Native Apache Arrow support
- Can query Python objects directly
- Relational API for method chaining
"""

import duckdb
import pandas as pd
import time

def demo_pandas_integration():
    """Show seamless Pandas integration."""
    print("=" * 70)
    print("PANDAS INTEGRATION")
    print("=" * 70)

    # Create a Pandas DataFrame
    print("\n1. Query Pandas DataFrames directly with SQL:")
    df = pd.DataFrame({
        'name': ['Alice', 'Bob', 'Charlie', 'Diana'],
        'age': [25, 30, 35, 28],
        'city': ['NYC', 'LA', 'NYC', 'Chicago'],
        'salary': [70000, 85000, 95000, 75000]
    })
    print("Source DataFrame:")
    print(df)

    # Query the DataFrame directly - no import needed!
    result = duckdb.sql("""
        SELECT
            city,
            COUNT(*) as count,
            AVG(salary) as avg_salary
        FROM df
        GROUP BY city
        ORDER BY avg_salary DESC
    """)
    print("\nSQL aggregation result:")
    print(result)

    # Convert DuckDB result back to Pandas
    print("\n2. Convert results back to Pandas:")
    pandas_result = result.df()
    print(f"Type: {type(pandas_result)}")
    print(pandas_result)

    # Query Parquet file and return Pandas DataFrame in one line
    print("\n3. Load Parquet to Pandas (single line):")
    start = time.perf_counter()
    top_customers = duckdb.sql("""
        SELECT
            c.customer_id,
            c.first_name || ' ' || c.last_name as name,
            c.loyalty_tier,
            SUM(t.total_amount) as total_spent
        FROM 'data/transactions.parquet' t
        JOIN 'data/customers.parquet' c ON t.customer_id = c.customer_id
        GROUP BY c.customer_id, c.first_name, c.last_name, c.loyalty_tier
        ORDER BY total_spent DESC
        LIMIT 10
    """).df()
    elapsed = time.perf_counter() - start
    print(f"Loaded and processed 500K rows in {elapsed*1000:.2f}ms:")
    print(top_customers)

def demo_dataframe_replacement():
    """Show DuckDB as a Pandas replacement for analytics."""
    print("\n" + "=" * 70)
    print("DUCKDB AS PANDAS REPLACEMENT")
    print("=" * 70)

    print("\n1. Compare: Pandas vs DuckDB for complex groupby:")

    # Load data
    df = duckdb.sql("SELECT * FROM 'data/transactions.parquet'").df()

    # Pandas approach
    start = time.perf_counter()
    pandas_result = (df
        .groupby(['channel', 'payment_method'])
        .agg({
            'total_amount': ['sum', 'mean', 'count'],
            'quantity': 'sum'
        })
        .round(2)
    )
    pandas_time = (time.perf_counter() - start) * 1000

    # DuckDB approach (directly on DataFrame variable)
    start = time.perf_counter()
    duckdb_result = duckdb.sql("""
        SELECT
            channel,
            payment_method,
            ROUND(SUM(total_amount), 2) as total_revenue,
            ROUND(AVG(total_amount), 2) as avg_amount,
            COUNT(*) as count,
            SUM(quantity) as total_quantity
        FROM df
        GROUP BY channel, payment_method
        ORDER BY total_revenue DESC
    """)
    duckdb_time = (time.perf_counter() - start) * 1000

    print(f"\nPandas groupby time: {pandas_time:.2f} ms")
    print(f"DuckDB SQL time:     {duckdb_time:.2f} ms")
    print(f"Speedup:             {pandas_time/duckdb_time:.1f}x")

    print("\nDuckDB result:")
    print(duckdb_result)

    print("\n2. Filter + Sort + Limit (a common pattern):")

    # Pandas
    start = time.perf_counter()
    pandas_filtered = (df[df['total_amount'] > 1000]
        .sort_values('total_amount', ascending=False)
        .head(10))
    pandas_time = (time.perf_counter() - start) * 1000

    # DuckDB
    start = time.perf_counter()
    duckdb_filtered = duckdb.sql("""
        SELECT * FROM df
        WHERE total_amount > 1000
        ORDER BY total_amount DESC
        LIMIT 10
    """)
    duckdb_time = (time.perf_counter() - start) * 1000

    print(f"\nPandas filter/sort: {pandas_time:.2f} ms")
    print(f"DuckDB filter/sort: {duckdb_time:.2f} ms")

def demo_relational_api():
    """Show DuckDB's relational API for method chaining."""
    print("\n" + "=" * 70)
    print("RELATIONAL API (Method Chaining)")
    print("=" * 70)

    print("\nDuckDB offers a Pandas-like API for those who prefer method chaining:")

    # Get relation from Parquet file
    transactions = duckdb.read_parquet('data/transactions.parquet')

    # Chain operations
    result = (transactions
        .filter("total_amount > 500")
        .aggregate("channel, COUNT(*) as cnt, SUM(total_amount) as revenue")
        .order("revenue DESC")
        .limit(5)
    )

    print("\nMethod chain: filter -> aggregate -> order -> limit")
    print(result)

    # Can also join relations
    print("\n2. Joining relations:")
    customers = duckdb.read_parquet('data/customers.parquet')
    products = duckdb.read_parquet('data/products.parquet')

    # Create a complex join
    result = duckdb.sql("""
        SELECT
            c.region,
            p.category,
            COUNT(*) as transactions,
            ROUND(SUM(t.total_amount), 2) as revenue
        FROM transactions t
        JOIN customers c ON t.customer_id = c.customer_id
        JOIN products p ON t.product_id = p.product_id
        WHERE t.discount_percent >= 20
        GROUP BY c.region, p.category
        ORDER BY revenue DESC
        LIMIT 10
    """)
    print(result)

def demo_arrow_integration():
    """Show Apache Arrow integration."""
    print("\n" + "=" * 70)
    print("APACHE ARROW INTEGRATION")
    print("=" * 70)

    print("\n1. Zero-copy conversion to Arrow:")
    result = duckdb.sql("""
        SELECT
            channel,
            COUNT(*) as count,
            SUM(total_amount) as revenue
        FROM 'data/transactions.parquet'
        GROUP BY channel
    """)

    # Convert to Arrow Table
    arrow_table = result.fetch_arrow_table()
    print(f"Arrow Table type: {type(arrow_table)}")
    print(f"Schema: {arrow_table.schema}")
    print(f"Num rows: {arrow_table.num_rows}")

    # Arrow tables can be queried directly too
    print("\n2. Query Arrow tables directly:")
    result2 = duckdb.sql("SELECT * FROM arrow_table WHERE revenue > 80000000")
    print(result2)

def demo_udf():
    """Demonstrate User Defined Functions."""
    print("\n" + "=" * 70)
    print("USER DEFINED FUNCTIONS (UDF)")
    print("=" * 70)

    print("""
DuckDB supports Python UDFs (User Defined Functions):

    def my_function(x):
        return x * 2

    conn.create_function('double_it', my_function, ['DOUBLE'], 'DOUBLE')

Then use in SQL:
    SELECT double_it(value) FROM my_table

This allows extending SQL with custom Python logic when needed.
""")

    # Use native SQL CASE as a simpler demonstration
    print("Example using native SQL CASE (preferred for performance):")
    result = duckdb.sql("""
        SELECT
            CASE
                WHEN total_amount < 100 THEN 'small'
                WHEN total_amount < 500 THEN 'medium'
                ELSE 'large'
            END as size_category,
            COUNT(*) as count,
            ROUND(AVG(total_amount), 2) as avg_amount
        FROM 'data/transactions.parquet'
        GROUP BY size_category
        ORDER BY avg_amount
    """)
    print(result)

def demo_in_memory_vs_persistent():
    """Compare in-memory vs persistent database modes."""
    print("\n" + "=" * 70)
    print("IN-MEMORY vs PERSISTENT DATABASE")
    print("=" * 70)

    print("\n1. In-memory database (default):")
    print("   - duckdb.connect() or duckdb.connect(':memory:')")
    print("   - Data lives only in RAM, fastest for analysis")
    print("   - Perfect for ad-hoc queries on files")

    # In-memory example
    mem_conn = duckdb.connect()
    mem_conn.execute("CREATE TABLE test AS SELECT * FROM 'data/products.parquet'")
    result = mem_conn.execute("SELECT COUNT(*) FROM test").fetchone()
    print(f"   - In-memory table has {result[0]} rows")
    mem_conn.close()

    print("\n2. Persistent database:")
    print("   - duckdb.connect('my_database.duckdb')")
    print("   - Data persists to disk")
    print("   - Good for storing processed data or indexes")

    # Persistent example
    import os
    db_path = 'data/analytics.duckdb'
    if os.path.exists(db_path):
        os.remove(db_path)

    persist_conn = duckdb.connect(db_path)
    persist_conn.execute("""
        CREATE TABLE monthly_revenue AS
        SELECT
            strftime(transaction_date::DATE, '%Y-%m') as month,
            SUM(total_amount) as revenue
        FROM 'data/transactions.parquet'
        GROUP BY month
    """)

    result = persist_conn.execute("SELECT COUNT(*) FROM monthly_revenue").fetchone()
    print(f"   - Persistent table has {result[0]} months of data")

    # Get file size
    db_size = os.path.getsize(db_path) / 1024
    print(f"   - Database file size: {db_size:.2f} KB")

    persist_conn.close()

    # Reopen and verify persistence
    persist_conn2 = duckdb.connect(db_path)
    result = persist_conn2.execute("SELECT * FROM monthly_revenue LIMIT 3").fetchdf()
    print(f"   - Data persists across connections:")
    print(result.to_string(index=False))
    persist_conn2.close()

    # Cleanup
    os.remove(db_path)

def demo_concurrent_readers():
    """Show DuckDB's concurrent read capabilities."""
    print("\n" + "=" * 70)
    print("CONCURRENT ACCESS")
    print("=" * 70)

    print("""
DuckDB supports:
- Multiple readers can access the same database concurrently
- Single writer at a time (with WAL for durability)
- For analytics, often best to use separate in-memory instances

This makes it ideal for:
- Multi-threaded data processing pipelines
- Jupyter notebooks (each cell can query independently)
- Microservices querying shared Parquet files
""")

def main():
    """Run all Python integration demonstrations."""
    print("DuckDB Python Integration Demonstration")
    print("=" * 70)
    print("\nDuckDB integrates seamlessly with the Python data science ecosystem.\n")

    demo_pandas_integration()
    demo_dataframe_replacement()
    demo_relational_api()
    demo_arrow_integration()
    demo_udf()
    demo_in_memory_vs_persistent()
    demo_concurrent_readers()

    print("\n" + "=" * 70)
    print("KEY TAKEAWAYS")
    print("=" * 70)
    print("""
1. Zero-friction Pandas: Query DataFrames with SQL, no import needed
2. Faster than Pandas: SQL on DuckDB often outperforms native Pandas
3. Arrow support: Zero-copy data exchange with Arrow ecosystem
4. UDFs: Extend SQL with Python functions
5. Flexible modes: In-memory for speed, persistent for durability
6. Best of both worlds: SQL power + Python ecosystem integration
""")

if __name__ == "__main__":
    main()
