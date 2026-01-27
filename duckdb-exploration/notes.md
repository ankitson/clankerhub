# DuckDB Exploration Notes

## Project Goal
Explore DuckDB's strengths in its niche as an embedded analytical database.

## Key Areas to Explore
1. Direct file querying (CSV, Parquet, JSON) without loading
2. Analytical query performance vs traditional approaches
3. Window functions and complex aggregations
4. Integration with Python data science workflows
5. In-memory vs persistent database modes
6. Parallel query execution

## Work Log

### Session 1 - Initial Setup
- Created project folder structure
- Planning demonstrations of DuckDB capabilities

### Data Generation
- Generated 500K transactions, 10K customers, 500 products
- Created files in CSV, Parquet, and JSON formats
- Key observation: Parquet file is 5x smaller than CSV (6.69 MB vs 33.39 MB)

### Direct File Querying
- DuckDB can query CSV, Parquet, JSON directly - no ETL needed!
- Parquet queries are 46x faster than CSV for aggregations
- Can join across different file formats in a single query
- Glob patterns let you query multiple files as one logical table

### Analytics and Window Functions
- All complex analytics completed in 0.70 seconds
- Powerful window functions: RANK, LAG, LEAD, NTILE, running totals
- Advanced aggregations: GROUPING SETS, CUBE, ROLLUP
- Statistical functions: STDDEV, PERCENTILE_CONT, CORR
- Time-series analysis and cohort analysis work great

### Python Integration
- Can query Pandas DataFrames directly with SQL
- Zero-copy Arrow integration
- Seamless conversion between DuckDB results and Pandas/Arrow
- Supports both in-memory and persistent database modes

### Key Insights
- DuckDB shines when querying files directly (especially Parquet)
- For data already in Pandas DataFrames, Pandas may be faster for simple ops
- DuckDB's real value: SQL on files without ETL, complex analytics, joins

