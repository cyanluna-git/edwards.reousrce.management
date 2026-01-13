#!/usr/bin/env python3
"""
워크로그 재시딩 - 올바른 user_id 매핑
"""

import pandas as pd
import psycopg2
from psycopg2.extras import execute_batch
from datetime import datetime

print("=== 매핑 데이터 로드 ===")

# 1. Person.id → Email 매핑
df_users = pd.read_csv('ref_table/db_users.csv', encoding='utf-8', low_memory=False)
person_to_email = {}
for _, row in df_users.iterrows():
    person_id = str(int(row['Person.id']))
    email = str(row['email']).strip().lower()
    person_to_email[person_id] = email

print(f"Person.id → Email: {len(person_to_email)}")

# 2. DB의 email → UUID 매핑
conn = psycopg2.connect(
    host='localhost',
    port=5434,
    database='edwards',
    user='postgres',
    password='password'
)

cursor = conn.cursor()

cursor.execute("SELECT email, id FROM users WHERE is_active = true;")
email_to_uuid = {}
for email, uuid in cursor.fetchall():
    email_to_uuid[email.lower()] = uuid

print(f"Email → UUID: {len(email_to_uuid)}")

# 3. 전체 매핑: Createdby.Id → UUID
createdby_to_uuid = {}
unmapped_ids = set()

for person_id, email in person_to_email.items():
    if email in email_to_uuid:
        createdby_to_uuid[int(person_id)] = email_to_uuid[email]
    else:
        unmapped_ids.add(int(person_id))

print(f"Createdby.Id → UUID: {len(createdby_to_uuid)}")
print(f"매핑 실패: {len(unmapped_ids)}")

# 기본 사용자 (매핑 실패시 사용)
cursor.execute("SELECT id FROM users WHERE email = 'robin.park@edwardsvacuum.com';")
default_user_id = cursor.fetchone()[0]
print(f"기본 사용자: {default_user_id}")

# General/Non-Project
cursor.execute("SELECT id FROM projects WHERE name = 'General/Non-Project';")
default_project_id = cursor.fetchone()[0]

# 4. CSV 읽기
print("\n=== CSV 시딩 준비 ===")
csv_file = "ref_table/tb_worklog copy.csv"
df = pd.read_csv(csv_file, encoding='utf-16', on_bad_lines='skip')
print(f"CSV 레코드: {len(df):,}")

# 5. 데이터베이스 정리
print("\n=== 데이터베이스 정리 ===")
cursor.execute("TRUNCATE TABLE worklogs RESTART IDENTITY CASCADE;")
conn.commit()
print("✓ TRUNCATE 완료")

# 6. 배치 삽입
print(f"\n=== 시딩 시작 ({len(df):,} 레코드) ===")

batch_size = 5000
batch = []
success = 0
mapped_count = 0
unmapped_count = 0

for idx, (_, row) in enumerate(df.iterrows()):
    # 사용자 매핑
    createdby_id = int(row['Createdby.Id']) if pd.notna(row['Createdby.Id']) else None
    
    if createdby_id and createdby_id in createdby_to_uuid:
        user_id = createdby_to_uuid[createdby_id]
        mapped_count += 1
    else:
        user_id = default_user_id
        unmapped_count += 1
    
    # 데이터 정제
    date = pd.to_datetime(row['Date'], errors='coerce')
    hours = float(row['Hours']) if pd.notna(row['Hours']) else 0
    description = str(row['Title']).strip() if pd.notna(row['Title']) else ''
    now = datetime.now()
    
    batch.append({
        'date': date.date() if date else None,
        'hours': hours,
        'description': description[:500],
        'user_id': user_id,
        'project_id': default_project_id,
        'is_sudden_work': False,
        'is_business_trip': False,
        'work_type_category_id': None,
        'created_at': now,
        'updated_at': now
    })
    
    if len(batch) >= batch_size:
        insert_sql = """
            INSERT INTO worklogs (date, hours, description, user_id, project_id, 
                                 is_sudden_work, is_business_trip, work_type_category_id,
                                 created_at, updated_at)
            VALUES (%(date)s, %(hours)s, %(description)s, %(user_id)s, %(project_id)s,
                   %(is_sudden_work)s, %(is_business_trip)s, %(work_type_category_id)s,
                   %(created_at)s, %(updated_at)s);
        """
        execute_batch(cursor, insert_sql, batch)
        success += len(batch)
        conn.commit()
        batch = []
        
        pct = (idx + 1) / len(df) * 100
        print(f"  {idx+1:,}/{len(df):,} ({pct:.1f}%): {success:,} 삽입 (매핑 {mapped_count:,}, 기본 {unmapped_count:,})")

# 마지막 배치
if batch:
    insert_sql = """
        INSERT INTO worklogs (date, hours, description, user_id, project_id,
                             is_sudden_work, is_business_trip, work_type_category_id,
                             created_at, updated_at)
        VALUES (%(date)s, %(hours)s, %(description)s, %(user_id)s, %(project_id)s,
               %(is_sudden_work)s, %(is_business_trip)s, %(work_type_category_id)s,
               %(created_at)s, %(updated_at)s);
    """
    execute_batch(cursor, insert_sql, batch)
    success += len(batch)
    conn.commit()

# 최종 통계
cursor.execute("""
    SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT user_id) as unique_users,
        MIN(date)::text as min_date,
        MAX(date)::text as max_date,
        SUM(hours)::numeric(10,1) as total_hours
    FROM worklogs;
""")

total, unique_users, min_date, max_date, total_hours = cursor.fetchone()

print(f"\n✓ 완료:")
print(f"  삽입: {success:,}")
print(f"  매핑된 사용자: {mapped_count:,} ({mapped_count*100/success:.1f}%)")
print(f"  기본 사용자 사용: {unmapped_count:,} ({unmapped_count*100/success:.1f}%)")
print(f"  데이터베이스: {total:,} 레코드")
print(f"  고유 사용자: {unique_users}")
print(f"  날짜: {min_date} ~ {max_date}")
print(f"  총 시간: {total_hours}")

cursor.close()
conn.close()
