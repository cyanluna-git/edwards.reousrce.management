#!/usr/bin/env python3
"""
워크로그의 user_id를 실제 사용자와 연결
CSV의 Createdby.Id (Person.id) → DB의 users (email) → UUID로 매핑
"""

import pandas as pd
import psycopg2
from psycopg2.extras import execute_batch

# 1. 매핑 데이터 로드
print("=== 매핑 데이터 로드 ===")

# db_users.csv: Person.id → email
df_users = pd.read_csv('ref_table/db_users.csv', encoding='utf-8', low_memory=False)
person_to_email = {}
for _, row in df_users.iterrows():
    person_id = str(int(row['Person.id']))
    email = str(row['email']).strip().lower()
    person_to_email[person_id] = email

print(f"Person.id → Email 매핑: {len(person_to_email)}")

# 2. DB 사용자 매핑: email → UUID
conn = psycopg2.connect(
    host='localhost',
    port=5434,
    database='edwards',
    user='postgres',
    password='password'
)

cursor = conn.cursor()

cursor.execute("SELECT email, id FROM users WHERE is_active = true;")
email_to_uuid = {row[0].lower(): row[1] for row in cursor.fetchall()}
print(f"Email → UUID 매핑: {len(email_to_uuid)}")

# 3. CSV에서 user mapping 추출
csv_file = "ref_table/tb_worklog copy.csv"
df = pd.read_csv(csv_file, encoding='utf-16', on_bad_lines='skip')

# Createdby.Id → UUID 매핑 구성
createdby_to_uuid = {}
unmapped = []

for createdby_id in df['Createdby.Id'].unique():
    if pd.isna(createdby_id):
        continue
    
    person_id = str(int(createdby_id))
    
    if person_id not in person_to_email:
        unmapped.append(person_id)
        continue
    
    email = person_to_email[person_id]
    
    if email not in email_to_uuid:
        unmapped.append(f"{person_id} ({email})")
        continue
    
    uuid = email_to_uuid[email]
    createdby_to_uuid[person_id] = uuid

print(f"Createdby.Id → UUID 매핑 성공: {len(createdby_to_uuid)}/{df['Createdby.Id'].nunique()}")

if unmapped:
    print(f"매핑 실패: {len(unmapped)}")
    for item in unmapped[:5]:
        print(f"  - {item}")
    if len(unmapped) > 5:
        print(f"  ... 외 {len(unmapped)-5}개")

# 4. 워크로그 user_id 업데이트
print(f"\n=== 워크로그 user_id 업데이트 ===")

update_sql = """
    UPDATE worklogs 
    SET user_id = %(user_id)s 
    WHERE id IN (
        SELECT w.id FROM worklogs w
        WHERE EXISTS (
            SELECT 1 FROM (
                SELECT id, CAST(description LIKE '%%%s%%' AS INTEGER) as match
            ) t 
            WHERE t.match = 1 LIMIT 1
        )
    );
"""

# 간단한 방법: 워크로그 테이블에 Createdby.Id 저장했다면 사용 가능하지만,
# 현재는 description만 있으므로 직접 update 불가

# 대신 모든 워크로그를 다시 UPDATE해야 함
# 워크로그가 이미 시딩된 상태이므로, 원본 CSV와 동기화 필요

print("워크로그 테이블에 Createdby.Id 정보가 없습니다.")
print("다시 시딩하면서 user_id를 올바르게 설정해야 합니다.")

# 5. 매핑 요약
print(f"\n=== 매핑 요약 ===")
print(f"총 고유 사용자: {len(createdby_to_uuid)}")
print(f"매핑된 레코드 (예상): {df[df['Createdby.Id'].isin([int(k) for k in createdby_to_uuid.keys()])].shape[0]:,}")

# 상위 10명
print(f"\n상위 10명 매핑:")
for person_id in sorted(createdby_to_uuid.keys()):
    email = person_to_email.get(person_id, 'N/A')
    uuid = createdby_to_uuid[person_id]
    count = len(df[df['Createdby.Id'] == int(person_id)])
    print(f"  Person.Id {person_id} ({email}) -> {uuid} ({count:,} 레코드)")
    if len([k for k in createdby_to_uuid.keys()]) >= 10:
        if person_id == sorted(createdby_to_uuid.keys())[9]:
            break

cursor.close()
conn.close()
