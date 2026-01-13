#!/usr/bin/env python3
"""
전체 워크로그 데이터 시딩 (Person.id 직접 매칭 + 프로젝트 키워드 매칭)
- UTF-16 인코딩 CSV 처리
- 배치 단위 처리 (메모리 효율)
- 중복 감지 및 스킵
"""

import os
import sys
import pandas as pd
import psycopg2
from pathlib import Path
from datetime import datetime
import logging

# 로깅 설정
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

class WorklogSeederFull:
    def __init__(self, db_password='password'):
        self.db_password = db_password
        self.conn = None
        self.person_id_to_uuid = {}
        self.project_name_to_id = {}
        self.default_project_id = None
        self.existing_ids = set()

    def connect(self):
        """DB 연결"""
        try:
            self.conn = psycopg2.connect(
                host='localhost',
                port=5434,
                database='edwards',
                user='postgres',
                password=self.db_password
            )
            log_colored("✅ DB 연결 성공", Colors.GREEN)
        except psycopg2.Error as e:
            log_colored(f"❌ DB 연결 실패: {e}", Colors.RED)
            sys.exit(1)

    def load_users(self):
        """DB에서 사용자 정보 로드"""
        try:
            cur = self.conn.cursor()
            # Person.id → UUID 매핑
            cur.execute("""
                SELECT u.id, u.email FROM users u
                WHERE u.is_active = true
            """)
            
            # CSV에서 Person.id 로드
            csv_path = Path(__file__).parent.parent.parent / 'ref_table' / 'db_users.csv'
            df_users = pd.read_csv(csv_path, encoding='utf-8', low_memory=False)
            
            user_map = {}
            for idx, row in df_users.iterrows():
                try:
                    person_id = str(int(float(str(row['Person.id']).strip())))
                    email = str(row['email']).strip()
                    user_map[person_id] = {'email': email}
                except:
                    pass
            
            # DB에서 가져온 UUID와 매핑
            for user_id, email in cur.fetchall():
                for person_id, data in user_map.items():
                    if data['email'] == email:
                        self.person_id_to_uuid[person_id] = user_id
            
            log_colored(f"✅ 사용자 로드: {len(self.person_id_to_uuid)}개 매핑", Colors.GREEN)
            cur.close()
        except Exception as e:
            log_colored(f"❌ 사용자 로드 실패: {e}", Colors.RED)
            sys.exit(1)

    def load_projects(self):
        """DB에서 프로젝트 정보 로드"""
        try:
            cur = self.conn.cursor()
            cur.execute("SELECT id, name FROM projects")
            
            for project_id, project_name in cur.fetchall():
                name_lower = project_name.lower()
                
                # General/Non-Project 감지
                if 'general/non-project' in name_lower:
                    self.default_project_id = project_id
                    log_colored(f"   기본 프로젝트: {project_name}", Colors.CYAN)
                
                # 프로젝트명 → ID 키워드 매핑
                keywords = name_lower.split()
                for keyword in keywords:
                    if len(keyword) > 2:
                        self.project_name_to_id[keyword] = project_id
            
            log_colored(f"✅ 프로젝트 로드: {len(self.project_name_to_id)}개 키워드", Colors.GREEN)
            cur.close()
        except psycopg2.Error as e:
            log_colored(f"❌ 프로젝트 로드 실패: {e}", Colors.RED)
            sys.exit(1)

    def load_existing_ids(self):
        """기존 워크로그 ID 로드 (중복 방지)"""
        try:
            cur = self.conn.cursor()
            cur.execute("SELECT id FROM worklogs")
            self.existing_ids = set(row[0] for row in cur.fetchall())
            log_colored(f"✅ 기존 ID 로드: {len(self.existing_ids)}개", Colors.GREEN)
            cur.close()
        except psycopg2.Error as e:
            log_colored(f"❌ 기존 ID 로드 실패: {e}", Colors.RED)

    def get_user_id(self, person_id_raw):
        """Person.id로 UUID 찾기"""
        try:
            person_id_str = str(int(float(str(person_id_raw).strip()))) if person_id_raw else None
            return self.person_id_to_uuid.get(person_id_str)
        except:
            return None

    def match_project_by_description(self, description):
        """설명으로 프로젝트 찾기"""
        if not description:
            return None
        
        desc_lower = description.lower()
        matched_projects = {}
        
        for keyword, project_id in self.project_name_to_id.items():
            if keyword in desc_lower:
                matched_projects[project_id] = matched_projects.get(project_id, 0) + 1
        
        if matched_projects:
            return max(matched_projects.items(), key=lambda x: x[1])[0]
        
        return None

    def seed_worklogs_batch(self, batch_df):
        """배치 단위 시딩"""
        success_count = 0
        skip_count = 0
        skip_reasons = {}
        project_stats = {'matched': 0, 'default_assigned': 0, 'not_matched': 0, 'non_project': 0}
        user_stats = {}
        
        current_batch = []
        
        for idx, row in batch_df.iterrows():
            try:
                # 1. 워크로그 ID 중복 확인
                worklog_id = int(row['Id']) if pd.notna(row['Id']) else None
                if worklog_id in self.existing_ids:
                    skip_count += 1
                    skip_reasons['기존 ID 중복'] = skip_reasons.get('기존 ID 중복', 0) + 1
                    continue
                
                # 2. 사용자 매핑
                created_by_id_raw = row['Createdby.Id']
                user_id = self.get_user_id(created_by_id_raw)
                
                if not user_id:
                    skip_count += 1
                    person_id_str = str(int(float(str(created_by_id_raw).strip()))) if created_by_id_raw else 'NULL'
                    skip_reasons[f'Person.id {person_id_str} 미등재'] = skip_reasons.get(f'Person.id {person_id_str} 미등재', 0) + 1
                    continue
                
                user_stats[user_id] = user_stats.get(user_id, 0) + 1
                
                # 3. 나머지 필드 처리
                hours = float(row['Hours']) if pd.notna(row['Hours']) else 1.0
                description = str(row['Title']).strip() if pd.notna(row['Title']) else ''
                is_project = str(row['IsProject?']).strip() if pd.notna(row['IsProject?']) else 'NonProject'
                
                # 날짜 파싱
                date = None
                date_str = str(row['Date']).strip()
                formats = ["%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%m/%d/%Y"]
                
                for fmt in formats:
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
                    project_id = self.match_project_by_description(description)
                    
                    if project_id:
                        project_stats['matched'] += 1
                    elif self.default_project_id:
                        project_id = self.default_project_id
                        project_stats['default_assigned'] += 1
                    else:
                        project_stats['not_matched'] += 1
                else:
                    project_stats['non_project'] += 1
                
                # 5. 배치에 추가
                current_batch.append({
                    'id': worklog_id,
                    'date': date,
                    'hours': hours,
                    'description': description,
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
                skip_reasons[f'처리 오류: {str(e)[:30]}'] = skip_reasons.get(f'처리 오류: {str(e)[:30]}', 0) + 1
        
        # DB 삽입
        if current_batch:
            self._insert_batch(current_batch)
        
        return {
            'success': success_count,
            'skipped': skip_count,
            'project_stats': project_stats,
            'user_stats': user_stats,
            'skip_reasons': skip_reasons
        }

    def _insert_batch(self, batch):
        """배치 DB 삽입"""
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
            
            # 청크 단위로 읽기 (메모리 효율)
            total_success = 0
            total_skipped = 0
            total_projects_matched = 0
            total_projects_assigned = 0
            
            chunk_num = 0
            for chunk_df in pd.read_csv(csv_path, encoding='utf-16', chunksize=batch_size, low_memory=False):
                chunk_num += 1
                log_colored(f"\n📋 배치 {chunk_num} 처리 ({len(chunk_df)}개 레코드)...", Colors.CYAN)
                
                result = self.seed_worklogs_batch(chunk_df)
                
                total_success += result['success']
                total_skipped += result['skipped']
                total_projects_matched += result['project_stats']['matched']
                total_projects_assigned += result['project_stats']['default_assigned']
                
                log_colored(f"   ✅ 성공: {result['success']}", Colors.GREEN)
                log_colored(f"   ⏭️  스킵: {result['skipped']}", Colors.YELLOW)
                
                if chunk_num % 5 == 0:
                    log_colored(f"   📊 누적: {total_success}개 성공, {total_skipped}개 스킵", Colors.CYAN)
            
            # 최종 통계
            log_colored(f"\n\n{'='*100}", Colors.CYAN)
            log_colored(f"📊 최종 통계", Colors.CYAN)
            log_colored(f"  ✅ 총 성공: {total_success:,}개", Colors.GREEN)
            log_colored(f"  ⏭️  총 스킵: {total_skipped:,}개", Colors.YELLOW)
            log_colored(f"  🎯 프로젝트 키워드 매칭: {total_projects_matched:,}개", Colors.GREEN)
            log_colored(f"  📁 General/Non-Project 할당: {total_projects_assigned:,}개", Colors.YELLOW)
            log_colored(f"{'='*100}", Colors.CYAN)
            
        except Exception as e:
            log_colored(f"❌ 시딩 실패: {e}", Colors.RED)
            raise

    def close(self):
        """DB 연결 종료"""
        if self.conn:
            self.conn.close()
            log_colored("✅ DB 연결 종료", Colors.GREEN)

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='전체 워크로그 데이터 시딩')
    parser.add_argument('--batch-size', type=int, default=5000, help='배치 크기 (기본: 5000)')
    args = parser.parse_args()
    
    db_password = os.getenv('POSTGRES_PASSWORD', 'password')
    seeder = WorklogSeederFull(db_password=db_password)
    
    try:
        log_colored("\n" + "="*100, Colors.CYAN)
        log_colored("🚀 전체 워크로그 데이터 시딩 시작", Colors.CYAN)
        log_colored("="*100 + "\n", Colors.CYAN)
        
        seeder.connect()
        seeder.load_users()
        seeder.load_projects()
        seeder.load_existing_ids()
        seeder.seed_from_csv(batch_size=args.batch_size)
        
        log_colored("\n✅ 시딩 완료!", Colors.GREEN)
        
    except Exception as e:
        log_colored(f"\n❌ 오류 발생: {e}", Colors.RED)
        sys.exit(1)
    finally:
        seeder.close()

if __name__ == '__main__':
    main()
