#!/usr/bin/env python3
import pandas as pd
from collections import Counter

# CSV 로드
df = pd.read_csv('ref_table/tb_worklog_filtered_2026.1.13.csv', encoding='utf-8')

# Project 타입이면서 프로젝트 ID가 있는 레코드
project_records = df[df['IsProject?'] == 'Project'].copy()

print('=== 스킵된 레코드의 Description 키워드 분석 ===\n')

# Description에서 대문자로 시작하는 단어들 추출 (프로젝트 이름일 가능성)
all_keywords = []
for desc in project_records['Title'].dropna():
    desc_str = str(desc)
    # 대문자 단어들 추출
    words = desc_str.split()
    for word in words:
        if len(word) > 3 and (word[0].isupper() or word.isupper()):
            # 특수문자 제거
            clean_word = ''.join(c for c in word if c.isalnum() or c in ['-', '_'])
            if len(clean_word) > 3:
                all_keywords.append(clean_word)

# 가장 많이 나타나는 키워드 (프로젝트 이름 후보)
keyword_freq = Counter(all_keywords)
print('가장 많이 등장하는 키워드 (상위 30):')
for keyword, count in keyword_freq.most_common(30):
    print(f'  {keyword}: {count}회')

print('\n\n=== 특정 프로젝트 ID의 Description 샘플 ===\n')

# 많이 사용된 프로젝트 ID별 description 샘플
top_project_ids = [136, 23, 123, 135, 69, 120, 4, 166, 165, 156]

for pid in top_project_ids[:5]:
    samples = project_records[project_records['Project.Id'] == pid]['Title'].head(5)
    print(f'\n프로젝트 ID {pid}의 description 샘플:')
    for i, desc in enumerate(samples, 1):
        print(f'  {i}. {desc}')
