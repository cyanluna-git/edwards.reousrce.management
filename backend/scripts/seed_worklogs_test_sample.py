#!/usr/bin/env python3
"""샘플 1000건 테스트 시딩"""

import os
import sys
import pandas as pd
import psycopg2
from pathlib import Path
from datetime import datetime
import logging

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

class WorklogSeederTest:
    def __init__(self, db_password='password'):
        self.db_password = db_password
        self.conn = None
        self.person_id_to_uuid = {}
        self.project_name_to_id = {}
        self.default_project_id = None
        self.existing_ids = set()

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
        try:
            cur = self.conn.cursor()
            cur.execute("SELECT id, name FROM projects")
            
            for project_id, project_name in cur.fetchall():
                name_lower = project_name.lower()
                if 'general/non-project' in name_lower:
                    self.default_project_id = project_id
                
                keywords = name_lower.split()
                for keyword in keywords:
                    if len(keyword) > 2:
                        self.project_name_to_id[keyword] = project_id
            
            log_colored(f"✅ 프로젝트 로드: 기본={self.default_project_id}, 키워드={len(self.project_name_to_id)}개", Colors.GREEN)
            cur.close()
        except Exception as e:
            log_colored(f"❌ 프로젝트 로드 실패: {e}", Colors.RED)
            sys.exit(1)

    def load_existing_ids(self):
        try:
            cur = self.conn.cursor()
            cur.execute("SELECT id FROM worklogs")
            self.existing_ids = set(row[0] for row in cur.fetchall())
            log_colored(f"✅ 기존 ID 로드: {len(self.existing_ids)}개", Colors.GREEN)
            cur.close()
        except Exception as e:
            log_colored(f"⚠️  기존 ID 로드 실패: {e}", Colors.YELLOW)

    def get_user_id(self, person_id_raw):
        try:
            person_id_str = str(int(float(str(person_id_raw).strip()))) if person_id_raw else None
            return self.person_id_to_uuid.get(person_id_str)
        except:
            return None

    def match_project_by_description(self, description):
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

    def seed_sample(self, csv_path):
        """샘플 시딩"""
        try:
            df = pd.read_csv(csv_path, encoding='utf-16', low_memory=False)
            
            success_count = 0
            skip_count = 0
            skip_reasons = {}
            
            batch = []
            
            for idx, row in df.iterrows():
                worklog_id = int(row['Id']) if pd.notna(row['Id']) else None
                if worklog_id in self.existing_ids:
                    skip_count += 1
                    continue
                
                created_by_id_raw = row['Createdby.Id']
                user_id = self.get_user_id(created_by_id_raw)
                
                if not user_id:
                    skip_count += 1
                    skip_reasons['사용자 미매칭'] = skip_reasons.get('사용자 미매칭', 0) + 1
                    continue
                
                hours = float(row['Hours']) if pd.notna(row['Hours']) else 1.0
                description = str(row['Title']).strip() if pd.notna(row['Title']) else ''
                is_project = str(row['IsProject?']).strip() if pd.notna(row['IsProject?']) else 'NonProject'
                
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
                    skip_reasons['날짜 실패'] = skip_reasons.get('날짜 실패', 0) + 1
                    continue
                
                project_id = None
                if is_project == 'Project':
                    project_id = self.match_project_by_description(description)
                    if not project_id:
                        project_id = self.default_project_id
                
                batch.append({
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
            
            # DB 삽입
            if batch:
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
            
            log_colored(f"\n{'='*80}", Colors.CYAN)
            log_colored(f"📊 샘플 테스트 결과", Colors.CYAN)
            log_colored(f"  ✅ 삽입 성공: {success_count}개", Colors.GREEN)
            log_colored(f"  ⏭️  스킵: {skip_count}개", Colors.YELLOW)
            
            if skip_reasons:
                log_colored(f"\n  스킵 사유:", Colors.YELLOW)
                for reason, count in skip_reasons.items():
                    log_colored(f"    - {reason}: {count}개", Colors.YELLOW)
            
            log_colored(f"{'='*80}\n", Colors.CYAN)
            
        except Exception as e:
            log_colored(f"❌ 시딩 실패: {e}", Colors.RED)
            raise

    def close(self):
        if self.conn:
            self.conn.close()

def main():
    db_password = os.getenv('POSTGRES_PASSWORD', 'password')
    seeder = WorklogSeederTest(db_password=db_password)
    
    try:
        log_colored("\n" + "="*80, Colors.CYAN)
        log_colored("🧪 샘플 테스트 시딩 (1000건)", Colors.CYAN)
        log_colored("="*80 + "\n", Colors.CYAN)
        
        seeder.connect()
        seeder.load_users()
        seeder.load_projects()
        seeder.load_existing_ids()
        
        sample_path = Path(__file__).parent.parent.parent / 'ref_table' / 'tb_worklog_sample_1000.csv'
        seeder.seed_sample(sample_path)
        
        log_colored("✅ 샘플 테스트 완료!", Colors.GREEN)
        
    except Exception as e:
        log_colored(f"❌ 오류: {e}", Colors.RED)
        sys.exit(1)
    finally:
        seeder.close()

if __name__ == '__main__':
    main()
