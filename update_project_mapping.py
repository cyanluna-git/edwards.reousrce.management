#!/usr/bin/env python3
"""
워크로그 프로젝트 매핑 업데이트 (UPDATE 방식)
CSV의 Project.Id → 프로젝트명 → 현재 DB의 UUID로 매핑
"""

import pandas as pd
import psycopg2

print("=== 프로젝트 매핑 및 워크로그 업데이트 ===\n")

# 1. CSV의 Project.Id → 프로젝트명 매핑
df_proj = pd.read_csv('ref_table/db_projects.csv', encoding='utf-8', low_memory=False)

csv_id_to_name = {}
for _, row in df_proj.iterrows():
    csv_id = int(row['ID'])
    name = str(row['Project']).strip()
    csv_id_to_name[csv_id] = name

print(f"✓ CSV 프로젝트 매핑: {len(csv_id_to_name)}")

# 2. 현재 DB의 프로젝트명 → UUID 매핑
conn = psycopg2.connect(
    host='localhost',
    port=5434,
    database='edwards',
    user='postgres',
    password='password'
)

cursor = conn.cursor()

cursor.execute("SELECT id, name FROM projects;")
db_projects = {row[1].strip(): row[0] for row in cursor.fetchall()}

print(f"✓ DB 프로젝트: {len(db_projects)}")

# 3. 전체 매핑: CSV Project.Id → DB UUID
print("\n=== 매핑 분석 ===")

csv_to_db = {}
unmapped = []

for csv_id, proj_name in csv_id_to_name.items():
    if proj_name in db_projects:
        csv_to_db[csv_id] = db_projects[proj_name]
    else:
        unmapped.append((csv_id, proj_name))

print(f"매핑 성공: {len(csv_to_db)}/{len(csv_id_to_name)} ({len(csv_to_db)*100/len(csv_id_to_name):.1f}%)")
print(f"매핑 실패: {len(unmapped)}")

if unmapped:
    print(f"\n매핑 불가능 (샘플):")
    for csv_id, name in unmapped[:5]:
        print(f"  ID {csv_id}: '{name}'")

# 4. 워크로그 UPDATE
print(f"\n=== 워크로그 프로젝트 업데이트 ===")

# CSV에서 각 워크로그의 Project.Id 읽기
df_worklogs = pd.read_csv('ref_table/tb_worklog copy.csv', encoding='utf-16', on_bad_lines='skip')

# Project.Id → UUID 매핑 구성
proj_id_to_uuid = {}
for _, row in df_worklogs.iterrows():
    proj_id = int(row['Project.Id'])
    if proj_id in csv_to_db:
        proj_id_to_uuid[proj_id] = csv_to_db[proj_id]

print(f"워크로그에서 찾은 Project.Id: {len(set(df_worklogs['Project.Id'].astype(int).unique()))}")
print(f"매핑 가능한 ID: {len(proj_id_to_uuid)}")

# UPDATE 쿼리 생성 및 실행
update_count = 0
for proj_id, uuid in proj_id_to_uuid.items():
    # worklogs 테이블에서 CSV의 description이나 다른 정보로 이 프로젝트의 레코드를 찾기는 불가능
    # 대신 원본 CSV와의 동기화를 위해 row-by-row 업데이트 필요
    pass

print("\n⚠️ 주의: worklogs 테이블에는 원본 Project.Id가 저장되지 않아서,")
print("       현재 데이터만으로는 매핑이 불가능합니다.")
print("\n솔루션:")
print("1. worklogs 테이블에 'original_project_id' 컬럼 추가")
print("2. CSV에서 original_project_id로 재시딩")
print("3. 또는 description 기반 휴리스틱 매핑 사용")

cursor.close()
conn.close()
