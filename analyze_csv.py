#!/usr/bin/env python3
import pandas as pd

# CSV 로드
df = pd.read_csv('ref_table/tb_worklog_filtered_2026.1.13.csv', encoding='utf-8')

print('=== CSV 통계 ===')
print(f'총 레코드: {len(df)}')
print(f'\nIsProject 분포:')
print(df['IsProject?'].value_counts())
print(f'\n프로젝트 타입인 레코드에서 Project.Id가 숫자인 경우:')
project_only = df[df['IsProject?'] == 'Project']
print(f'Project 타입 레코드 수: {len(project_only)}')

# Project.Id에서 실제 숫자 ID만 추출
numeric_project_ids = project_only['Project.Id'].apply(lambda x: str(x).strip() if pd.notna(x) else '')
numeric_only = numeric_project_ids.apply(lambda x: x.isdigit())
print(f'숫자 프로젝트 ID를 가진 레코드: {numeric_only.sum()}')

if numeric_only.sum() > 0:
    numeric_ids = numeric_project_ids[numeric_only].astype(int)
    print(f'\n가장 많이 사용된 프로젝트 ID (상위 10):')
    print(numeric_ids.value_counts().head(10))

# NonProject 분포도 확인
print(f'\n\nNonProject 타입 레코드: {len(df[df["IsProject?"] == "NonProject"])}')
