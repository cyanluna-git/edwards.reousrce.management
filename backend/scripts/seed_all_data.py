#!/usr/bin/env python3
"""
전체 데이터 시딩 - 모든 105,707개 레코드 삽입 (자동 ID 생성)
"""

import pandas as pd
import psycopg2
from psycopg2.extras import execute_batch
from datetime import datetime

# CSV 파일 읽기
csv_file = "ref_table/tb_worklog copy.csv"
print(f"CSV 파일 읽기: {csv_file}")
df = pd.read_csv(csv_file, encoding='utf-16', on_bad_lines='skip')

print(f"전체 레코드: {len(df):,}")
print(f"주의: Id 컬럼이 중복되어 있으나, 각 행은 고유한 데이터입니다")
print(f"      자동 ID 생성으로 모든 데이터를 시딩합니다")

# 데이터베이스 연결
conn = psycopg2.connect(
    host='localhost',
    port=5434,
    database='edwards',
    user='postgres',
    password='password'
)

cursor = conn.cursor()

try:
    # 기존 데이터 삭제
    print("\n데이터베이스 정리 중...")
    cursor.execute("TRUNCATE TABLE worklogs RESTART IDENTITY CASCADE;")
    conn.commit()
    print("✓ TRUNCATE 완료")
    
    # 첫 번째 활성 사용자 찾기
    cursor.execute("SELECT id, email FROM users WHERE is_active = true LIMIT 1;")
    user_result = cursor.fetchone()
    if not user_result:
        print("✗ 활성 사용자 없음!")
        exit(1)
    
    default_user_id = user_result[0]
    print(f"✓ 기본 사용자: {user_result[1]}")
    
    # General/Non-Project 찾기
    cursor.execute("SELECT id FROM projects WHERE name = 'General/Non-Project' LIMIT 1;")
    project_result = cursor.fetchone()
    if not project_result:
        print("✗ General/Non-Project 프로젝트 없음!")
        exit(1)
    
    default_project_id = project_result[0]
    print(f"✓ 기본 프로젝트: {default_project_id}")
    
    # 배치 삽입 - ID는 자동 생성 (CSV의 Id 컬럼 무시)
    print(f"\n시딩 시작 ({len(df):,} 레코드)...")
    
    batch_size = 5000
    batch = []
    success = 0
    
    for idx, (_, row) in enumerate(df.iterrows()):
        # 데이터 정제
        date = pd.to_datetime(row['Date'], errors='coerce')
        hours = float(row['Hours']) if pd.notna(row['Hours']) else 0
        description = str(row['Title']).strip() if pd.notna(row['Title']) else ''
        
        # ID를 지정하지 않으므로 자동 생성됨
        batch.append({
            'date': date.date() if date else None,
            'hours': hours,
            'description': description[:500],
            'user_id': default_user_id,
            'project_id': default_project_id
        })
        
        if len(batch) >= batch_size:
            insert_sql = """
                INSERT INTO worklogs (date, hours, description, user_id, project_id)
                VALUES (%(date)s, %(hours)s, %(description)s, %(user_id)s, %(project_id)s);
            """
            try:
                execute_batch(cursor, insert_sql, batch)
                success += len(batch)
                conn.commit()
                batch = []
                
                pct = (idx + 1) / len(df) * 100
                print(f"  {idx+1:,}/{len(df):,} ({pct:.1f}%): {success:,} 삽입")
            except psycopg2.Error as e:
                print(f"  배치 오류: {e}")
                conn.rollback()
                raise
    
    # 마지막 배치
    if batch:
        insert_sql = """
            INSERT INTO worklogs (date, hours, description, user_id, project_id)
            VALUES (%(date)s, %(hours)s, %(description)s, %(user_id)s, %(project_id)s);
        """
        execute_batch(cursor, insert_sql, batch)
        success += len(batch)
        conn.commit()
    
    # 최종 통계
    cursor.execute("""
        SELECT 
            COUNT(*) as total,
            MIN(date) as min_date,
            MAX(date) as max_date,
            SUM(hours)::numeric(10,1) as total_hours
        FROM worklogs;
    """)
    
    total, min_date, max_date, total_hours = cursor.fetchone()
    
    print(f"\n✓ 완료:")
    print(f"  삽입: {success:,} / {len(df):,}")
    print(f"  데이터베이스: {total:,} 레코드")
    print(f"  날짜: {min_date} ~ {max_date}")
    print(f"  총 시간: {total_hours}")

except Exception as e:
    print(f"✗ 오류: {e}")
    conn.rollback()
    raise

finally:
    cursor.close()
    conn.close()
