#!/usr/bin/env python3
"""
사용자 매핑 정보 출력
"""

import psycopg2
import pandas as pd

# 데이터베이스 연결
conn = psycopg2.connect(
    host='localhost',
    port=5434,
    database='edwards',
    user='postgres',
    password='password'
)

cursor = conn.cursor()

# 현재 users 테이블에서 이메일 추출
cursor.execute("SELECT email, id FROM users ORDER BY email;")
users = cursor.fetchall()

print(f"데이터베이스에 있는 사용자: {len(users)}")
print("샘플 (이메일, UUID):")
for email, uid in users[:10]:
    print(f"  {email} -> {uid}")

# CSV에서 Createdby.Id 확인
csv_file = "ref_table/tb_worklog copy.csv"
df = pd.read_csv(csv_file, encoding='utf-16', on_bad_lines='skip', dtype={'Createdby.Id': 'int64'})

unique_persons = sorted(df['Createdby.Id'].dropna().unique().astype(int))
print(f"\nCSV에 있는 고유 Createdby.Id: {len(unique_persons)}")
print(f"범위: {min(unique_persons)} ~ {max(unique_persons)}")

# 매핑 찾기 시도
print("\n매핑 전략:")
print("- CSV의 Createdby.Id 는 old system Person.Id")
print("- 현재 users 테이블 이메일에서 매핑해야 함")
print("- 하지만 매핑 정보가 없어서 모두 스킵됨")

cursor.close()
conn.close()
