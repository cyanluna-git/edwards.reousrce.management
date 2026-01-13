#!/usr/bin/env python3
import pandas as pd

# 매핑 테이블 로드
users_csv = pd.read_csv('ref_table/db_users.csv', encoding='utf-8-sig')
worklog_csv = pd.read_csv('ref_table/tb_worklog_filtered_2026.01.13.csv', encoding='latin1')

print("=== 매핑 테이블 분석 ===\n")

# Gerald Park 찾기
gerald = users_csv[users_csv['Person.email'].str.contains('gerald', case=False, na=False)]
print("Gerald Park 매핑:")
print(gerald[['Person.id', 'ID', 'Person.email', 'English Name', 'KoreanName']].to_string())
print()

# CSV에서 ID=1인 데이터 개수
gerald_worklogs = worklog_csv[worklog_csv['Createdby.Id'] == 1]
print(f"\nCSV에서 Createdby.Id=1 (Gerald Park)의 워크로그: {len(gerald_worklogs)}개")
print(f"날짜 범위: {gerald_worklogs['Date'].min()} ~ {gerald_worklogs['Date'].max()}\n")

# 상위 5개 사용자의 매핑 정보
print("상위 5개 Createdby.Id의 매핑 정보:")
for csv_id in sorted(worklog_csv['Createdby.Id'].value_counts().head(5).index):
    count = len(worklog_csv[worklog_csv['Createdby.Id'] == csv_id])
    user_info = users_csv[users_csv['ID'] == csv_id]
    if not user_info.empty:
        email = user_info['Person.email'].iloc[0]
        name = user_info['English Name'].iloc[0]
        print(f"  CSV ID {csv_id}: {email} ({name}) - {count}개 워크로그")
    else:
        print(f"  CSV ID {csv_id}: ❌ 매핑 없음")
