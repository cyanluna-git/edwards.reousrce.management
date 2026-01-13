#!/usr/bin/env python3
"""
CSV 데이터 중복 분석
"""

import pandas as pd

csv_file = "ref_table/tb_worklog copy.csv"
df = pd.read_csv(csv_file, encoding='utf-16', on_bad_lines='skip')

print("=== CSV 데이터 분석 ===")
print(f"전체 행: {len(df):,}")
print(f"\n컬럼: {df.columns.tolist()}")

# Id 컬럼 분석
print(f"\n[Id 컬럼]")
print(f"고유 ID: {df['Id'].nunique():,}")
print(f"중복 ID: {len(df) - df['Id'].nunique():,}")

# 행별 고유성 확인 - 완전 중복 (모든 컬럼 동일)
print(f"\n[행 고유성]")
df_all_dup = df.duplicated(keep=False).sum()
print(f"완전 중복 행 (모든 컬럼 동일): {df_all_dup:,}")

# 샘플 중복 확인
print(f"\n[중복 ID 샘플]")
id_counts = df['Id'].value_counts()
dup_ids = id_counts[id_counts > 1].head(5)

for id_val, count in dup_ids.items():
    print(f"\nID {id_val}: {count}개 행")
    dup_rows = df[df['Id'] == id_val][['Date', 'Hours', 'Title', 'Created', 'Createdby.Id']]
    for idx, (_, row) in enumerate(dup_rows.iterrows(), 1):
        print(f"  {idx}. {row['Date']} | {row['Hours']}시간 | {row['Createdby.Id']} | '{str(row['Title'])[:40]}'")

# 데이터베이스 vs CSV 비교
import psycopg2

conn = psycopg2.connect(
    host='localhost',
    port=5434,
    database='edwards',
    user='postgres',
    password='password'
)

cursor = conn.cursor()
cursor.execute("SELECT COUNT(*) FROM worklogs;")
db_count = cursor.fetchone()[0]
cursor.close()
conn.close()

print(f"\n[데이터베이스 vs CSV]")
print(f"CSV 전체: {len(df):,}")
print(f"CSV 고유 ID: {df['Id'].nunique():,}")
print(f"DB 레코드: {db_count:,}")
print(f"차이: {len(df) - db_count:,}")
