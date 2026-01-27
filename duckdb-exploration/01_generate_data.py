#!/usr/bin/env python3
"""
Generate sample datasets for DuckDB exploration.

Creates realistic e-commerce transaction data in multiple formats:
- CSV (traditional format)
- Parquet (columnar format DuckDB excels with)
- JSON (semi-structured data)
"""

import random
import json
import os
from datetime import datetime, timedelta

# Ensure reproducibility
random.seed(42)

# Configuration
NUM_CUSTOMERS = 10_000
NUM_PRODUCTS = 500
NUM_TRANSACTIONS = 500_000
OUTPUT_DIR = "data"

# Sample data pools
FIRST_NAMES = ["James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael",
               "Linda", "William", "Elizabeth", "David", "Barbara", "Richard", "Susan",
               "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen"]

LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
              "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez",
              "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin"]

CATEGORIES = ["Electronics", "Clothing", "Home & Garden", "Sports", "Books",
              "Toys", "Food & Beverages", "Health & Beauty", "Automotive", "Office"]

REGIONS = ["North", "South", "East", "West", "Central"]
STATES = ["CA", "TX", "FL", "NY", "PA", "IL", "OH", "GA", "NC", "MI",
          "NJ", "VA", "WA", "AZ", "MA", "TN", "IN", "MO", "MD", "WI"]

def generate_customers():
    """Generate customer data."""
    customers = []
    for i in range(1, NUM_CUSTOMERS + 1):
        customer = {
            "customer_id": i,
            "first_name": random.choice(FIRST_NAMES),
            "last_name": random.choice(LAST_NAMES),
            "email": f"customer{i}@example.com",
            "region": random.choice(REGIONS),
            "state": random.choice(STATES),
            "signup_date": (datetime(2020, 1, 1) + timedelta(days=random.randint(0, 1500))).strftime("%Y-%m-%d"),
            "loyalty_tier": random.choices(["Bronze", "Silver", "Gold", "Platinum"],
                                          weights=[50, 30, 15, 5])[0]
        }
        customers.append(customer)
    return customers

def generate_products():
    """Generate product catalog."""
    products = []
    adjectives = ["Premium", "Essential", "Pro", "Classic", "Ultra", "Compact", "Deluxe", "Basic"]
    nouns = ["Widget", "Gadget", "Device", "Tool", "Item", "Product", "Gear", "Kit"]

    for i in range(1, NUM_PRODUCTS + 1):
        category = random.choice(CATEGORIES)
        base_price = random.uniform(5, 500)
        product = {
            "product_id": i,
            "product_name": f"{random.choice(adjectives)} {random.choice(nouns)} {i}",
            "category": category,
            "subcategory": f"{category} Sub-{random.randint(1, 5)}",
            "base_price": round(base_price, 2),
            "cost": round(base_price * random.uniform(0.3, 0.7), 2),
            "weight_kg": round(random.uniform(0.1, 25), 2),
            "is_active": random.random() > 0.1
        }
        products.append(product)
    return products

def generate_transactions(customers, products):
    """Generate transaction data with realistic patterns."""
    transactions = []
    start_date = datetime(2023, 1, 1)

    for i in range(1, NUM_TRANSACTIONS + 1):
        customer = random.choice(customers)
        product = random.choice(products)

        # Add some seasonality - more transactions in Q4
        day_offset = random.randint(0, 729)  # 2 years of data
        trans_date = start_date + timedelta(days=day_offset)

        # Q4 boost
        if trans_date.month in [10, 11, 12]:
            if random.random() > 0.3:  # 70% chance to keep Q4 transaction
                pass

        quantity = random.choices([1, 2, 3, 4, 5], weights=[50, 25, 15, 7, 3])[0]

        # Apply random discount
        discount_pct = random.choices([0, 5, 10, 15, 20, 25],
                                      weights=[40, 25, 15, 10, 7, 3])[0]

        unit_price = product["base_price"] * (1 - discount_pct / 100)
        total_amount = round(unit_price * quantity, 2)

        transaction = {
            "transaction_id": i,
            "customer_id": customer["customer_id"],
            "product_id": product["product_id"],
            "transaction_date": trans_date.strftime("%Y-%m-%d"),
            "transaction_time": f"{random.randint(0,23):02d}:{random.randint(0,59):02d}:{random.randint(0,59):02d}",
            "quantity": quantity,
            "unit_price": round(unit_price, 2),
            "discount_percent": discount_pct,
            "total_amount": total_amount,
            "payment_method": random.choice(["Credit Card", "Debit Card", "PayPal", "Bank Transfer"]),
            "channel": random.choices(["Web", "Mobile", "In-Store"], weights=[50, 35, 15])[0]
        }
        transactions.append(transaction)

    return transactions

def save_csv(data, filename):
    """Save data as CSV."""
    if not data:
        return

    filepath = os.path.join(OUTPUT_DIR, filename)
    with open(filepath, 'w') as f:
        # Header
        f.write(','.join(data[0].keys()) + '\n')
        # Data
        for row in data:
            values = [str(v).replace(',', ';') for v in row.values()]
            f.write(','.join(values) + '\n')

    print(f"  Saved {filepath} ({len(data):,} rows)")

def save_parquet(data, filename):
    """Save data as Parquet using DuckDB."""
    import duckdb
    import pandas as pd

    filepath = os.path.join(OUTPUT_DIR, filename)

    # Convert to pandas DataFrame first, then use DuckDB to save as Parquet
    df = pd.DataFrame(data)
    conn = duckdb.connect()
    conn.execute(f"COPY (SELECT * FROM df) TO '{filepath}' (FORMAT PARQUET, COMPRESSION ZSTD)")
    conn.close()

    print(f"  Saved {filepath} ({len(data):,} rows)")

def save_json(data, filename):
    """Save data as newline-delimited JSON."""
    filepath = os.path.join(OUTPUT_DIR, filename)
    with open(filepath, 'w') as f:
        for row in data:
            f.write(json.dumps(row) + '\n')

    print(f"  Saved {filepath} ({len(data):,} rows)")

def main():
    """Generate all datasets."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("Generating sample data for DuckDB exploration...")
    print(f"  Customers: {NUM_CUSTOMERS:,}")
    print(f"  Products: {NUM_PRODUCTS:,}")
    print(f"  Transactions: {NUM_TRANSACTIONS:,}")
    print()

    print("Generating customers...")
    customers = generate_customers()

    print("Generating products...")
    products = generate_products()

    print("Generating transactions...")
    transactions = generate_transactions(customers, products)

    print("\nSaving files...")

    # Save in multiple formats
    print("\nCSV format:")
    save_csv(customers, "customers.csv")
    save_csv(products, "products.csv")
    save_csv(transactions, "transactions.csv")

    print("\nParquet format:")
    save_parquet(customers, "customers.parquet")
    save_parquet(products, "products.parquet")
    save_parquet(transactions, "transactions.parquet")

    print("\nJSON format (newline-delimited):")
    save_json(customers, "customers.json")
    save_json(products, "products.json")
    # Only save subset of transactions as JSON (it's verbose)
    save_json(transactions[:50000], "transactions_sample.json")

    # Get file sizes
    print("\nFile sizes:")
    for filename in sorted(os.listdir(OUTPUT_DIR)):
        filepath = os.path.join(OUTPUT_DIR, filename)
        size = os.path.getsize(filepath)
        if size > 1024 * 1024:
            print(f"  {filename}: {size / (1024*1024):.2f} MB")
        else:
            print(f"  {filename}: {size / 1024:.2f} KB")

    print("\nData generation complete!")

if __name__ == "__main__":
    main()
