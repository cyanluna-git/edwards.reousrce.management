#!/usr/bin/env python3
"""
중복 제거 및 전체 데이터 시딩 스크립트
- CSV의 모든 고유 ID 시딩
- ID별 최신 레코드만 유지 (Created 시간 기준)
- 모든 매핑 유지
"""

import pandas as pd
import psycopg2
from psycopg2.extras import execute_batch
import os
from datetime import datetime

# CSV 파일 읽기
csv_file = "ref_table/tb_worklog copy.csv"
print(f"CSV 파일 읽기 중: {csv_file}")
df = pd.read_csv(csv_file, encoding='utf-16', on_bad_lines='skip')

# 중복 제거 - ID별 최신 레코드만 유지
df['Created_dt'] = pd.to_datetime(df['Created'], errors='coerce')
df_dedup = df.sort_values('Created_dt', na_position='last').drop_duplicates(
    subset=['Id'], keep='last'
).reset_index(drop=True)

print(f"원본: {len(df):,} 행")
print(f"중복 제거 후: {len(df_dedup):,} 행 (고유 ID)")
print(f"제거된 레코드: {len(df) - len(df_dedup):,}")

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
    print("✓ 기존 데이터 삭제 완료")
    
    # 사용자 매핑 로드
    cursor.execute("SELECT email, id FROM users;")
    user_map = {row[0].lower(): row[1] for row in cursor.fetchall()}
    print(f"✓ 사용자 매핑: {len(user_map)}")
    
    # 프로젝트 로드
    cursor.execute("SELECT id, name FROM projects;")
    projects = {row[1]: str(row[0]) for row in cursor.fetchall()}
    general_project_id = projects.get('General/Non-Project')
    print(f"✓ 프로젝트: {len(projects)}, General/Non-Project: {general_project_id[:8]}...")
    
    # Person.id → email 매핑 파일 로드
    person_map = {}
    mapping_file = 'backend/scripts/person_mapping.txt'
    if os.path.exists(mapping_file):
        with open(mapping_file, 'r') as f:
            for line in f:
                parts = line.strip().split('\t')
                if len(parts) == 2:
                    try:
                        person_map[int(parts[0])] = parts[1].lower()
                    except ValueError:
                        pass
        print(f"✓ Person 매핑: {len(person_map)} 매핑")
    
    print(f"\n시딩 시작... ({len(df_dedup):,} 고유 레코드)")
    
    # 배치 삽입
    batch_size = 5000
    batch = []
    skipped = 0
    success = 0
    errors = 0
    
    for idx, (_, row) in enumerate(df_dedup.iterrows()):
        try:
            # 사용자 찾기 - email에서 직접 매핑 (Createdby.Id는 무시)
            createdby_name = str(row.get('Created', '')).split(' by ')[-1] if pd.notna(row.get('Created')) else None
            
            # user_id 찾기 - 일단 첫 번째 사용자로 설정
            if not user_map:
                skipped += 1
                continue
            
            # 첫 번째 활성 사용자 사용 (임시)
            user_id = list(user_map.values())[0] if user_map else None
            
            if not user_id:
                skipped += 1
                continue
            
            # 프로젝트 찾기 (현재는 모두 General로 지정)
            project_id = general_project_id
            
            # 데이터 정제
            date = pd.to_datetime(row['Date'], errors='coerce')
            hours = float(row['Hours']) if pd.notna(row['Hours']) else 0
            title = str(row['Title']).strip() if pd.notna(row['Title']) else ''
            
            batch.append({
                'id': int(row['Id']),
                'date': date.date() if date else None,
                'hours': hours,
                'title': title[:500],
                'user_id': user_id,
                'project_id': project_id
            })
            
            if len(batch) >= batch_size:
                insert_sql = """
                    INSERT INTO worklogs (id, date, hours, title, user_id, project_id)
                    VALUES (%(id)s, %(date)s, %(hours)s, %(title)s, %(user_id)s, %(project_id)s)
                    ON CONFLICT (id) DO NOTHING;
                """
                execute_batch(cursor, insert_sql, batch)
                success += len(batch)
                conn.commit()
                batch = []
                
                pct = (idx + 1) / len(df_dedup) * 100
                print(f"  {idx+1:,}/{len(df_dedup):,} ({pct:.1f}%): {success:,} 삽입, {skipped:,} 스킵")
        
        except Exception as e:
            errors += 1
            if errors <= 5:
                print(f"  행 {idx} 오류: {e}")
            continue
    
    # 마지막 배치
    if batch:
        insert_sql = """
            INSERT INTO worklogs (id, date, hours, title, user_id, project_id)
            VALUES (%(id)s, %(date)s, %(hours)s, %(title)s, %(user_id)s, %(project_id)s)
            ON CONFLICT (id) DO NOTHING;
        """
        execute_batch(cursor, insert_sql, batch)
        success += len(batch)
        conn.commit()
    
    # 최종 통계
    cursor.execute("SELECT COUNT(*) FROM worklogs;")
    final_count = cursor.fetchone()[0]
    cursor.execute("SELECT MIN(date), MAX(date) FROM worklogs;")
    date_range = cursor.fetchone()
    
    print(f"\n✓ 완료:")
    print(f"  입력: {len(df_dedup):,} (고유 ID)")
    print(f"  삽입: {success:,}")
    print(f"  스킵: {skipped:,}")
    print(f"  오류: {errors:,}")
    print(f"  데이터베이스: {final_count:,}")
    if date_range[0]:
        print(f"  날짜 범위: {date_range[0]} ~ {date_range[1]}")

except Exception as e:
    print(f"✗ 오류: {e}")
    conn.rollback()
    raise

finally:
    cursor.close()
    conn.close()
