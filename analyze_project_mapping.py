#!/usr/bin/env python3
"""
프로젝트 매핑 분석 및 워크로그 업데이트 (UPDATE 방식)
"""

import pandas as pd
import psycopg2
from pathlib import Path
import os

# CSV의 Project.Id 분포
csv_file = "ref_table/tb_worklog copy.csv"
df = pd.read_csv(csv_file, encoding='utf-16', on_bad_lines='skip')

print("=== CSV의 Project.Id 분포 ===")
print(f"고유 Project.Id: {df['Project.Id'].nunique()}")
print(f"범위: {int(df['Project.Id'].min())} ~ {int(df['Project.Id'].max())}")

# db_projects.csv 로드
print("\n=== 매핑 파일 로드 ===")
csv_projects_file = "ref_table/db_projects.csv"

if os.path.exists(csv_projects_file):
    df_proj_csv = pd.read_csv(csv_projects_file, encoding='utf-8', low_memory=False)
    print(f"✓ db_projects.csv 있음")
    print(f"컬럼: {df_proj_csv.columns.tolist()}")
    print(f"레코드: {len(df_proj_csv)}")
    
    # Project.Id → 프로젝트명 매핑
    if 'Project.id' in df_proj_csv.columns and 'Project.name' in df_proj_csv.columns:
        csv_id_to_name = {}
        for _, row in df_proj_csv.iterrows():
            csv_id = int(row['Project.id'])
            name = str(row['Project.name']).strip()
            csv_id_to_name[csv_id] = name
        
        print(f"\nProject.Id → 이름 매핑: {len(csv_id_to_name)}")
        print("샘플:")
        for pid, name in list(csv_id_to_name.items())[:5]:
            print(f"  {pid} → {name}")
    else:
        print(f"✗ 필요한 컬럼 없음: {df_proj_csv.columns.tolist()}")
else:
    print(f"✗ {csv_projects_file} 없음")

# 현재 DB의 프로젝트
conn = psycopg2.connect(
    host='localhost',
    port=5434,
    database='edwards',
    user='postgres',
    password='password'
)

cursor = conn.cursor()

print("\n=== 현재 DB 프로젝트 ===")
cursor.execute("SELECT id, name FROM projects ORDER BY name;")
db_projects = {}
for project_id, name in cursor.fetchall():
    db_projects[name.strip()] = project_id

print(f"총 프로젝트: {len(db_projects)}")
print("샘플:")
for name, id in list(db_projects.items())[:5]:
    print(f"  {name} → {id}")

# 워크로그의 현재 상태
print("\n=== 현재 워크로그 상태 ===")
cursor.execute("""
    SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT project_id) as unique_projects
    FROM worklogs;
""")
total, unique_projects = cursor.fetchone()
print(f"총 워크로그: {total}")
print(f"고유 프로젝트: {unique_projects}")

cursor.execute("""
    SELECT project_id, COUNT(*) as count
    FROM worklogs
    GROUP BY project_id
    ORDER BY count DESC
    LIMIT 5;
""")
print("상위 프로젝트:")
for pid, count in cursor.fetchall():
    cursor.execute("SELECT name FROM projects WHERE id = %s;", (pid,))
    proj_name = cursor.fetchone()[0]
    print(f"  {proj_name}: {count:,}")

# 매핑 가능성 분석
if 'csv_id_to_name' in locals():
    print("\n=== 매핑 분석 ===")
    mappable = 0
    unmappable = []
    
    for csv_id, csv_name in csv_id_to_name.items():
        if csv_name in db_projects:
            mappable += 1
        else:
            unmappable.append((csv_id, csv_name))
    
    print(f"매핑 가능: {mappable}/{len(csv_id_to_name)} ({mappable*100/len(csv_id_to_name):.1f}%)")
    print(f"매핑 불가: {len(unmappable)}")
    
    if unmappable:
        print("\n매핑 불가능한 프로젝트 (샘플):")
        for csv_id, csv_name in unmappable[:5]:
            # 유사한 이름 찾기
            similar = [name for name in db_projects.keys() if csv_name.lower() in name.lower()]
            if similar:
                print(f"  {csv_id}: '{csv_name}' → 유사: {similar[0]}")
            else:
                print(f"  {csv_id}: '{csv_name}' (매칭 없음)")

cursor.close()
conn.close()
