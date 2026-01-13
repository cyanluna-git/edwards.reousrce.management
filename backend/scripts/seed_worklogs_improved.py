#!/usr/bin/env python3
"""
개선된 워크로그 시딩 스크립트
- 사용자: Person.id로 직접 매칭 (ID 기반)
- 프로젝트: Title 키워드 추론 + Project.Id 빈도 검증
- NonProject: General/Non-Project로 할당 (NULL 아님)
- Title 비어있음: General/Non-Project로 할당
"""

import os
import sys
import pandas as pd
import psycopg2
from pathlib import Path
from datetime import datetime
import logging
from collections import Counter

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    CYAN = '\033[96m'
    RESET = '\033[0m'

def log_colored(msg, color=Colors.RESET):
    print(f"{color}{msg}{Colors.RESET}")
    logger.info(msg)

class WorklogSeederImproved:
    def __init__(self, db_password='password'):
        self.db_password = db_password
        self.conn = None
        self.person_id_to_uuid = {}
        self.project_name_to_id = {}
        self.project_id_to_name = {}
        self.default_project_id = None
        self.csv_project_id_map = {}  # Project.Id (int) → name (구 시스템)

    def connect(self):
        try:
            self.conn = psycopg2.connect(
                host='localhost', port=5434, database='edwards',
                user='postgres', password=self.db_password
            )
            log_colored("✅ DB 연결 성공", Colors.GREEN)
        except psycopg2.Error as e:
            log_colored(f"❌ DB 연결 실패: {e}", Colors.RED)
            sys.exit(1)

    def load_users(self):
        """사용자 매핑 (Person.id → UUID)"""
        try:
            cur = self.conn.cursor()
            cur.execute("SELECT u.id, u.email FROM users u WHERE u.is_active = true")
            db_users = cur.fetchall()
            
            csv_path = Path(__file__).parent.parent.parent / 'ref_table' / 'db_users.csv'
            df_users = pd.read_csv(csv_path, encoding='utf-8', low_memory=False)
            
            user_map = {}
            for idx, row in df_users.iterrows():
                try:
                    person_id = str(int(float(str(row['Person.id']).strip())))
                    email = str(row['email']).strip()
                    user_map[person_id] = email
                except:
                    pass
            
            for user_id, email in db_users:
                for person_id, user_email in user_map.items():
                    if user_email == email:
                        self.person_id_to_uuid[person_id] = user_id
            
            log_colored(f"✅ 사용자 로드: {len(self.person_id_to_uuid)}개 매핑", Colors.GREEN)
            cur.close()
        except Exception as e:
            log_colored(f"❌ 사용자 로드 실패: {e}", Colors.RED)
            sys.exit(1)

    def load_projects(self):
        """프로젝트 매핑"""
        try:
            cur = self.conn.cursor()
            cur.execute("SELECT id, name FROM projects")
            
            for project_id, project_name in cur.fetchall():
                name_lower = project_name.lower()
                self.project_id_to_name[project_id] = project_name
                
                # General/Non-Project 감지
                if 'general/non-project' in name_lower:
                    self.default_project_id = project_id
                
                # 키워드 추출
                keywords = name_lower.split()
                for keyword in keywords:
                    if len(keyword) > 2:
                        if keyword not in self.project_name_to_id:
                            self.project_name_to_id[keyword] = []
                        self.project_name_to_id[keyword].append(project_id)
            
            log_colored(f"✅ 프로젝트 로드: 기본={self.default_project_id}", Colors.GREEN)
            log_colored(f"   키워드 매핑: {len(self.project_name_to_id)}개", Colors.GREEN)
            cur.close()
        except Exception as e:
            log_colored(f"❌ 프로젝트 로드 실패: {e}", Colors.RED)
            sys.exit(1)

    def load_csv_project_mapping(self, df_csv):
        """CSV의 Project.Id → project name 매핑 구성"""
        # Project.Id별 Title 수집
        project_titles = {}
        for idx, row in df_csv.iterrows():
            if row['IsProject?'] == 'Project':
                try:
                    project_id_int = int(float(row['Project.Id']))
                    title = str(row['Title']).strip() if pd.notna(row['Title']) else ''
                    
                    if project_id_int not in project_titles:
                        project_titles[project_id_int] = []
                    if title:
                        project_titles[project_id_int].append(title)
                except:
                    pass
        
        log_colored(f"✅ CSV 프로젝트 매핑: {len(project_titles)}개 프로젝트", Colors.CYAN)
        self.csv_project_id_map = project_titles

    def get_user_id(self, person_id_raw):
        """Person.id로 UUID 조회"""
        try:
            person_id_str = str(int(float(str(person_id_raw).strip()))) if person_id_raw else None
            return self.person_id_to_uuid.get(person_id_str)
        except:
            return None

    def match_project_by_title(self, title, csv_project_id=None):
        """
        Title에서 프로젝트 매칭 (개선된 방식)
        1. Title에서 키워드 추론
        2. CSV Project.Id 기반 검증 (있으면)
        """
        if not title or not title.strip():
            return None, 'empty'
        
        title_lower = title.lower()
        matched_projects = {}
        
        # 키워드별 매칭
        for keyword, project_ids in self.project_name_to_id.items():
            if keyword in title_lower:
                for project_id in project_ids:
                    matched_projects[project_id] = matched_projects.get(project_id, 0) + 1
        
        # CSV Project.Id 정보가 있으면 검증
        if csv_project_id and csv_project_id in self.csv_project_id_map:
            csv_titles = self.csv_project_id_map[csv_project_id]
            
            # 같은 Project.Id를 가진 다른 타이틀들도 참고
            title_keywords = title.split()
            for csv_title in csv_titles[:5]:  # 상위 5개만
                csv_title_lower = csv_title.lower()
                for keyword in title_keywords:
                    if len(keyword) > 2 and keyword.lower() in csv_title_lower:
                        # 신뢰도 높음
                        pass
        
        if matched_projects:
            # 가장 많이 매칭된 프로젝트 선택
            best_project = max(matched_projects.items(), key=lambda x: x[1])
            return best_project[0], 'keyword'
        
        return None, 'no_match'

    def seed_worklogs_batch(self, batch_df):
        """배치 단위 시딩"""
        success_count = 0
        skip_count = 0
        skip_reasons = {}
        project_stats = {
            'keyword_matched': 0,
            'general_assigned': 0,
            'nonproject_general': 0,
            'failed': 0
        }
        
        current_batch = []
        
        for idx, row in batch_df.iterrows():
            try:
                # 1. 사용자 매핑 (ID 기반)
                created_by_id_raw = row['Createdby.Id']
                user_id = self.get_user_id(created_by_id_raw)
                
                if not user_id:
                    skip_count += 1
                    person_id_str = str(int(float(str(created_by_id_raw).strip()))) if created_by_id_raw else 'NULL'
                    skip_reasons[f'Person.id {person_id_str} 미등재'] = skip_reasons.get(f'Person.id {person_id_str} 미등재', 0) + 1
                    continue
                
                # 2. 기본 필드
                worklog_id = int(row['Id']) if pd.notna(row['Id']) else None
                hours = float(row['Hours']) if pd.notna(row['Hours']) else 1.0
                title = str(row['Title']).strip() if pd.notna(row['Title']) else ''
                is_project = str(row['IsProject?']).strip() if pd.notna(row['IsProject?']) else 'NonProject'
                
                # 3. 날짜 파싱
                date = None
                date_str = str(row['Date']).strip()
                for fmt in ["%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"]:
                    try:
                        date = datetime.strptime(date_str, fmt).date()
                        break
                    except ValueError:
                        pass
                
                if date is None:
                    skip_count += 1
                    skip_reasons['날짜 파싱 실패'] = skip_reasons.get('날짜 파싱 실패', 0) + 1
                    continue
                
                # 4. 프로젝트 매칭
                project_id = None
                
                if is_project == 'Project':
                    # Title 기반 추론
                    csv_project_id = int(float(row['Project.Id'])) if pd.notna(row['Project.Id']) else None
                    matched_id, match_type = self.match_project_by_title(title, csv_project_id)
                    
                    if matched_id:
                        project_id = matched_id
                        project_stats['keyword_matched'] += 1
                    else:
                        # 실패 시 General/Non-Project
                        project_id = self.default_project_id
                        project_stats['general_assigned'] += 1
                else:
                    # NonProject는 항상 General/Non-Project로
                    project_id = self.default_project_id
                    project_stats['nonproject_general'] += 1
                
                # 5. 배치에 추가
                current_batch.append({
                    'id': worklog_id,
                    'date': date,
                    'hours': hours,
                    'description': title,
                    'user_id': user_id,
                    'project_id': project_id,
                    'is_sudden_work': str(row['SuddenWork?']).upper() == 'TRUE' if pd.notna(row['SuddenWork?']) else False,
                    'is_business_trip': str(row['BusinessTrip']).upper() == 'TRUE' if pd.notna(row['BusinessTrip']) else False,
                    'worktype_id': int(row['Worktype.Id']) if pd.notna(row['Worktype.Id']) else None,
                    'created_at': datetime.now(),
                    'updated_at': datetime.now(),
                })
                
                success_count += 1
            
            except Exception as e:
                skip_count += 1
                skip_reasons[f'처리 오류'] = skip_reasons.get(f'처리 오류', 0) + 1
        
        # DB 삽입
        if current_batch:
            self._insert_batch(current_batch)
        
        return {
            'success': success_count,
            'skipped': skip_count,
            'project_stats': project_stats,
            'skip_reasons': skip_reasons
        }

    def _insert_batch(self, batch):
        """배치 DB 삽입 (중복 무시)"""
        try:
            cur = self.conn.cursor()
            
            for item in batch:
                cur.execute("""
                    INSERT INTO worklogs (id, date, hours, description, user_id, project_id, 
                                         is_sudden_work, is_business_trip, work_type_category_id, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO NOTHING
                """, (
                    item['id'], item['date'], item['hours'], item['description'], item['user_id'],
                    item['project_id'], item['is_sudden_work'], item['is_business_trip'],
                    item['worktype_id'], item['created_at'], item['updated_at']
                ))
            
            self.conn.commit()
            cur.close()
        except psycopg2.Error as e:
            self.conn.rollback()
            raise e

    def seed_from_csv(self, batch_size=5000):
        """CSV에서 배치 단위로 시딩"""
        try:
            csv_path = Path(__file__).parent.parent.parent / 'ref_table' / 'tb_worklog copy.csv'
            
            log_colored(f"\n📂 CSV 로드 중: {csv_path}", Colors.CYAN)
            
            # 전체 CSV 로드 (Project.Id 매핑용)
            df_full = pd.read_csv(csv_path, encoding='utf-16', low_memory=False)
            self.load_csv_project_mapping(df_full)
            
            total_success = 0
            total_skipped = 0
            total_stats = {
                'keyword_matched': 0,
                'general_assigned': 0,
                'nonproject_general': 0,
            }
            
            chunk_num = 0
            for chunk_df in pd.read_csv(csv_path, encoding='utf-16', chunksize=batch_size, low_memory=False):
                chunk_num += 1
                log_colored(f"\n📋 배치 {chunk_num} 처리 ({len(chunk_df)}개 레코드)...", Colors.CYAN)
                
                result = self.seed_worklogs_batch(chunk_df)
                
                total_success += result['success']
                total_skipped += result['skipped']
                total_stats['keyword_matched'] += result['project_stats']['keyword_matched']
                total_stats['general_assigned'] += result['project_stats']['general_assigned']
                total_stats['nonproject_general'] += result['project_stats']['nonproject_general']
                
                log_colored(f"   ✅ 성공: {result['success']}", Colors.GREEN)
                log_colored(f"   ⏭️  스킵: {result['skipped']}", Colors.YELLOW)
                
                if chunk_num % 5 == 0:
                    log_colored(f"   📊 누적: {total_success}개 성공, {total_skipped}개 스킵", Colors.CYAN)
            
            # 최종 통계
            log_colored(f"\n\n{'='*100}", Colors.CYAN)
            log_colored(f"📊 최종 통계", Colors.CYAN)
            log_colored(f"  ✅ 총 성공: {total_success:,}개", Colors.GREEN)
            log_colored(f"  ⏭️  총 스킵: {total_skipped:,}개", Colors.YELLOW)
            log_colored(f"\n📋 프로젝트 할당 상세:", Colors.CYAN)
            log_colored(f"  🎯 키워드 매칭: {total_stats['keyword_matched']:,}개", Colors.GREEN)
            log_colored(f"  📁 General/Non-Project (매칭 실패): {total_stats['general_assigned']:,}개", Colors.YELLOW)
            log_colored(f"  ℹ️  NonProject 타입: {total_stats['nonproject_general']:,}개", Colors.CYAN)
            log_colored(f"{'='*100}", Colors.CYAN)
            
        except Exception as e:
            log_colored(f"❌ 시딩 실패: {e}", Colors.RED)
            raise

    def close(self):
        if self.conn:
            self.conn.close()
            log_colored("✅ DB 연결 종료", Colors.GREEN)

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='개선된 워크로그 데이터 시딩')
    parser.add_argument('--batch-size', type=int, default=5000, help='배치 크기 (기본: 5000)')
    args = parser.parse_args()
    
    db_password = os.getenv('POSTGRES_PASSWORD', 'password')
    seeder = WorklogSeederImproved(db_password=db_password)
    
    try:
        log_colored("\n" + "="*100, Colors.CYAN)
        log_colored("🚀 개선된 워크로그 데이터 시딩 시작", Colors.CYAN)
        log_colored("="*100 + "\n", Colors.CYAN)
        
        seeder.connect()
        seeder.load_users()
        seeder.load_projects()
        seeder.seed_from_csv(batch_size=args.batch_size)
        
        log_colored("\n✅ 시딩 완료!", Colors.GREEN)
        
    except Exception as e:
        log_colored(f"\n❌ 오류 발생: {e}", Colors.RED)
        sys.exit(1)
    finally:
        seeder.close()

if __name__ == '__main__':
    main()
