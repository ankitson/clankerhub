#!/usr/bin/env python3
"""
Demonstrate DuckDB's analytical capabilities.

DuckDB is designed for OLAP workloads and excels at:
- Complex aggregations
- Window functions
- Time-series analysis
- Statistical functions
"""

import duckdb
import time

def setup_views():
    """Create views for cleaner queries."""
    duckdb.sql("""
        CREATE OR REPLACE VIEW transactions AS
        SELECT * FROM 'data/transactions.parquet';

        CREATE OR REPLACE VIEW customers AS
        SELECT * FROM 'data/customers.parquet';

        CREATE OR REPLACE VIEW products AS
        SELECT * FROM 'data/products.parquet';
    """)

def demo_window_functions():
    """Demonstrate powerful window functions."""
    print("=" * 70)
    print("WINDOW FUNCTIONS")
    print("=" * 70)

    print("\n1. Running totals and moving averages:")
    result = duckdb.sql("""
        WITH daily_sales AS (
            SELECT
                transaction_date::DATE as sale_date,
                SUM(total_amount) as daily_revenue
            FROM transactions
            WHERE transaction_date >= '2024-01-01'
              AND transaction_date < '2024-02-01'
            GROUP BY sale_date
        )
        SELECT
            sale_date,
            daily_revenue,
            SUM(daily_revenue) OVER (ORDER BY sale_date) as running_total,
            ROUND(AVG(daily_revenue) OVER (
                ORDER BY sale_date
                ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
            ), 2) as moving_avg_7day
        FROM daily_sales
        ORDER BY sale_date
        LIMIT 15
    """)
    print(result)

    print("\n2. Ranking customers by spending:")
    result = duckdb.sql("""
        WITH customer_spending AS (
            SELECT
                c.customer_id,
                c.first_name || ' ' || c.last_name as customer_name,
                c.loyalty_tier,
                c.region,
                SUM(t.total_amount) as total_spent,
                COUNT(*) as num_purchases
            FROM transactions t
            JOIN customers c ON t.customer_id = c.customer_id
            GROUP BY c.customer_id, c.first_name, c.last_name, c.loyalty_tier, c.region
        )
        SELECT
            customer_name,
            loyalty_tier,
            region,
            total_spent,
            num_purchases,
            RANK() OVER (ORDER BY total_spent DESC) as overall_rank,
            RANK() OVER (PARTITION BY region ORDER BY total_spent DESC) as region_rank
        FROM customer_spending
        QUALIFY region_rank <= 3
        ORDER BY region, region_rank
    """)
    print(result)

    print("\n3. Year-over-year comparison with LAG:")
    result = duckdb.sql("""
        WITH monthly_revenue AS (
            SELECT
                strftime(transaction_date::DATE, '%Y-%m') as month,
                strftime(transaction_date::DATE, '%Y') as year,
                strftime(transaction_date::DATE, '%m') as month_num,
                SUM(total_amount) as revenue
            FROM transactions
            GROUP BY month, year, month_num
        )
        SELECT
            month,
            revenue,
            LAG(revenue, 12) OVER (ORDER BY month) as prev_year_revenue,
            ROUND(
                (revenue - LAG(revenue, 12) OVER (ORDER BY month))
                / LAG(revenue, 12) OVER (ORDER BY month) * 100,
                2
            ) as yoy_growth_pct
        FROM monthly_revenue
        WHERE year = '2024'
        ORDER BY month
    """)
    print(result)

    print("\n4. NTILE - Customer segmentation into quartiles:")
    result = duckdb.sql("""
        WITH customer_value AS (
            SELECT
                c.customer_id,
                c.loyalty_tier,
                SUM(t.total_amount) as lifetime_value
            FROM transactions t
            JOIN customers c ON t.customer_id = c.customer_id
            GROUP BY c.customer_id, c.loyalty_tier
        ),
        with_quartiles AS (
            SELECT
                customer_id,
                lifetime_value,
                NTILE(4) OVER (ORDER BY lifetime_value DESC) as quartile
            FROM customer_value
        )
        SELECT
            quartile,
            COUNT(*) as customer_count,
            ROUND(MIN(lifetime_value), 2) as min_ltv,
            ROUND(MAX(lifetime_value), 2) as max_ltv,
            ROUND(AVG(lifetime_value), 2) as avg_ltv
        FROM with_quartiles
        GROUP BY quartile
        ORDER BY quartile
    """)
    print(result)

def demo_advanced_aggregations():
    """Demonstrate advanced aggregation capabilities."""
    print("\n" + "=" * 70)
    print("ADVANCED AGGREGATIONS")
    print("=" * 70)

    print("\n1. GROUPING SETS - Multiple aggregation levels in one query:")
    result = duckdb.sql("""
        SELECT
            COALESCE(p.category, 'ALL CATEGORIES') as category,
            COALESCE(c.region, 'ALL REGIONS') as region,
            COUNT(*) as num_sales,
            ROUND(SUM(t.total_amount), 2) as revenue
        FROM transactions t
        JOIN products p ON t.product_id = p.product_id
        JOIN customers c ON t.customer_id = c.customer_id
        GROUP BY GROUPING SETS (
            (p.category, c.region),
            (p.category),
            (c.region),
            ()
        )
        ORDER BY category, region
        LIMIT 20
    """)
    print(result)

    print("\n2. CUBE - All dimension combinations:")
    result = duckdb.sql("""
        SELECT
            COALESCE(c.loyalty_tier, 'ALL') as loyalty_tier,
            COALESCE(t.channel, 'ALL') as channel,
            COUNT(*) as transactions,
            ROUND(AVG(t.total_amount), 2) as avg_order_value
        FROM transactions t
        JOIN customers c ON t.customer_id = c.customer_id
        GROUP BY CUBE (c.loyalty_tier, t.channel)
        ORDER BY loyalty_tier, channel
    """)
    print(result)

    print("\n3. ROLLUP - Hierarchical totals:")
    result = duckdb.sql("""
        SELECT
            COALESCE(p.category, 'TOTAL') as category,
            COALESCE(p.subcategory, 'Subtotal') as subcategory,
            COUNT(*) as num_sales,
            ROUND(SUM(t.total_amount), 2) as revenue
        FROM transactions t
        JOIN products p ON t.product_id = p.product_id
        WHERE p.category IN ('Electronics', 'Clothing')
        GROUP BY ROLLUP (p.category, p.subcategory)
        ORDER BY category NULLS LAST, subcategory NULLS LAST
    """)
    print(result)

def demo_statistical_functions():
    """Demonstrate built-in statistical functions."""
    print("\n" + "=" * 70)
    print("STATISTICAL FUNCTIONS")
    print("=" * 70)

    print("\n1. Percentiles and distribution analysis:")
    result = duckdb.sql("""
        SELECT
            channel,
            COUNT(*) as n,
            ROUND(AVG(total_amount), 2) as mean,
            ROUND(STDDEV(total_amount), 2) as std_dev,
            ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY total_amount), 2) as p25,
            ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY total_amount), 2) as median,
            ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY total_amount), 2) as p75,
            ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY total_amount), 2) as p95
        FROM transactions
        GROUP BY channel
    """)
    print(result)

    print("\n2. Correlation analysis:")
    result = duckdb.sql("""
        SELECT
            p.category,
            ROUND(CORR(t.discount_percent, t.quantity), 3) as discount_qty_corr,
            ROUND(CORR(t.unit_price, t.quantity), 3) as price_qty_corr,
            COUNT(*) as sample_size
        FROM transactions t
        JOIN products p ON t.product_id = p.product_id
        GROUP BY p.category
        ORDER BY discount_qty_corr DESC
    """)
    print(result)

    print("\n3. Histogram / Distribution buckets:")
    result = duckdb.sql("""
        WITH buckets AS (
            SELECT
                CASE
                    WHEN total_amount < 100 THEN '0-100'
                    WHEN total_amount < 250 THEN '100-250'
                    WHEN total_amount < 500 THEN '250-500'
                    WHEN total_amount < 1000 THEN '500-1000'
                    ELSE '1000+'
                END as amount_bucket,
                CASE
                    WHEN total_amount < 100 THEN 1
                    WHEN total_amount < 250 THEN 2
                    WHEN total_amount < 500 THEN 3
                    WHEN total_amount < 1000 THEN 4
                    ELSE 5
                END as bucket_order,
                total_amount
            FROM transactions
        )
        SELECT
            amount_bucket,
            COUNT(*) as count,
            ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
        FROM buckets
        GROUP BY amount_bucket, bucket_order
        ORDER BY bucket_order
    """)
    print(result)

def demo_time_series_analysis():
    """Demonstrate time-series analysis capabilities."""
    print("\n" + "=" * 70)
    print("TIME-SERIES ANALYSIS")
    print("=" * 70)

    print("\n1. Seasonality analysis - Day of week patterns:")
    result = duckdb.sql("""
        SELECT
            DAYNAME(transaction_date::DATE) as day_of_week,
            EXTRACT(ISODOW FROM transaction_date::DATE) as day_num,
            COUNT(*) as num_transactions,
            ROUND(AVG(total_amount), 2) as avg_order_value,
            ROUND(SUM(total_amount), 2) as total_revenue
        FROM transactions
        GROUP BY day_of_week, day_num
        ORDER BY day_num
    """)
    print(result)

    print("\n2. Hour-of-day analysis:")
    result = duckdb.sql("""
        SELECT
            CAST(SUBSTR(transaction_time, 1, 2) AS INTEGER) as hour,
            COUNT(*) as num_transactions,
            ROUND(AVG(total_amount), 2) as avg_order_value
        FROM transactions
        GROUP BY hour
        ORDER BY hour
    """)
    print(result)

    print("\n3. Month-over-month growth rates:")
    result = duckdb.sql("""
        WITH monthly AS (
            SELECT
                strftime(transaction_date::DATE, '%Y-%m') as month,
                SUM(total_amount) as revenue
            FROM transactions
            GROUP BY month
        )
        SELECT
            month,
            ROUND(revenue, 2) as revenue,
            ROUND(
                (revenue - LAG(revenue) OVER (ORDER BY month))
                / LAG(revenue) OVER (ORDER BY month) * 100,
                2
            ) as mom_growth_pct
        FROM monthly
        ORDER BY month
    """)
    print(result)

def demo_cohort_analysis():
    """Demonstrate cohort analysis capabilities."""
    print("\n" + "=" * 70)
    print("COHORT ANALYSIS")
    print("=" * 70)

    print("\n1. Customer cohort by signup month with retention:")
    result = duckdb.sql("""
        WITH customer_cohorts AS (
            SELECT
                c.customer_id,
                strftime(c.signup_date::DATE, '%Y-%m') as cohort_month,
                strftime(t.transaction_date::DATE, '%Y-%m') as purchase_month
            FROM customers c
            JOIN transactions t ON c.customer_id = t.customer_id
        ),
        cohort_sizes AS (
            SELECT
                cohort_month,
                COUNT(DISTINCT customer_id) as cohort_size
            FROM customer_cohorts
            GROUP BY cohort_month
        ),
        monthly_activity AS (
            SELECT
                cohort_month,
                purchase_month,
                COUNT(DISTINCT customer_id) as active_customers
            FROM customer_cohorts
            GROUP BY cohort_month, purchase_month
        )
        SELECT
            m.cohort_month,
            s.cohort_size,
            m.purchase_month,
            m.active_customers,
            ROUND(m.active_customers * 100.0 / s.cohort_size, 1) as retention_pct
        FROM monthly_activity m
        JOIN cohort_sizes s ON m.cohort_month = s.cohort_month
        WHERE m.cohort_month IN ('2021-01', '2021-06', '2022-01')
          AND m.purchase_month >= '2024-01'
          AND m.purchase_month <= '2024-06'
        ORDER BY m.cohort_month, m.purchase_month
    """)
    print(result)

def demo_funnel_analysis():
    """Demonstrate funnel-style analysis."""
    print("\n" + "=" * 70)
    print("FUNNEL / SEGMENTATION ANALYSIS")
    print("=" * 70)

    print("\n1. Customer purchase frequency distribution:")
    result = duckdb.sql("""
        WITH customer_purchases AS (
            SELECT
                customer_id,
                COUNT(*) as num_purchases
            FROM transactions
            GROUP BY customer_id
        ),
        frequency_segments AS (
            SELECT
                CASE
                    WHEN num_purchases = 1 THEN '1 purchase'
                    WHEN num_purchases BETWEEN 2 AND 5 THEN '2-5 purchases'
                    WHEN num_purchases BETWEEN 6 AND 20 THEN '6-20 purchases'
                    WHEN num_purchases BETWEEN 21 AND 50 THEN '21-50 purchases'
                    ELSE '50+ purchases'
                END as frequency_segment,
                CASE
                    WHEN num_purchases = 1 THEN 1
                    WHEN num_purchases BETWEEN 2 AND 5 THEN 2
                    WHEN num_purchases BETWEEN 6 AND 20 THEN 3
                    WHEN num_purchases BETWEEN 21 AND 50 THEN 4
                    ELSE 5
                END as segment_order,
                num_purchases
            FROM customer_purchases
        )
        SELECT
            frequency_segment,
            COUNT(*) as customers,
            ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as pct_of_customers
        FROM frequency_segments
        GROUP BY frequency_segment, segment_order
        ORDER BY segment_order
    """)
    print(result)

    print("\n2. RFM (Recency, Frequency, Monetary) Analysis:")
    result = duckdb.sql("""
        WITH customer_metrics AS (
            SELECT
                customer_id,
                MAX(transaction_date::DATE) as last_purchase,
                COUNT(*) as frequency,
                SUM(total_amount) as monetary
            FROM transactions
            GROUP BY customer_id
        ),
        rfm_scores AS (
            SELECT
                customer_id,
                NTILE(5) OVER (ORDER BY last_purchase DESC) as recency_score,
                NTILE(5) OVER (ORDER BY frequency) as frequency_score,
                NTILE(5) OVER (ORDER BY monetary) as monetary_score
            FROM customer_metrics
        )
        SELECT
            CASE
                WHEN recency_score >= 4 AND frequency_score >= 4 AND monetary_score >= 4 THEN 'Champions'
                WHEN recency_score >= 4 AND frequency_score >= 3 THEN 'Loyal Customers'
                WHEN recency_score >= 3 AND monetary_score >= 4 THEN 'Big Spenders'
                WHEN recency_score >= 4 AND frequency_score <= 2 THEN 'New Customers'
                WHEN recency_score <= 2 AND frequency_score >= 3 THEN 'At Risk'
                WHEN recency_score <= 2 AND frequency_score <= 2 THEN 'Lost'
                ELSE 'Need Attention'
            END as segment,
            COUNT(*) as customer_count,
            ROUND(AVG(recency_score), 1) as avg_recency,
            ROUND(AVG(frequency_score), 1) as avg_frequency,
            ROUND(AVG(monetary_score), 1) as avg_monetary
        FROM rfm_scores
        GROUP BY segment
        ORDER BY customer_count DESC
    """)
    print(result)

def main():
    """Run all analytics demonstrations."""
    print("DuckDB Analytics and Window Functions Demonstration")
    print("=" * 70)
    print("\nDuckDB is designed for OLAP workloads with powerful analytical features.\n")

    setup_views()

    start = time.perf_counter()

    demo_window_functions()
    demo_advanced_aggregations()
    demo_statistical_functions()
    demo_time_series_analysis()
    demo_cohort_analysis()
    demo_funnel_analysis()

    elapsed = time.perf_counter() - start

    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"\nTotal execution time for all analytics: {elapsed:.2f} seconds")
    print("""
Key DuckDB Analytics Features Demonstrated:
1. Window functions: ROW_NUMBER, RANK, LAG, LEAD, NTILE, running totals
2. Advanced aggregations: GROUPING SETS, CUBE, ROLLUP
3. Statistical functions: STDDEV, PERCENTILE, CORR
4. Time-series analysis: Day/hour patterns, month-over-month
5. Cohort and RFM analysis: Customer segmentation and retention

DuckDB handles all these complex analytical queries efficiently
because it's designed from the ground up for OLAP workloads.
""")

if __name__ == "__main__":
    main()
