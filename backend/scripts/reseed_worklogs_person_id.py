#!/usr/bin/env python3
"""
워크로그 데이터 재시딩 스크립트 - Person.id 직접 매칭
CSV의 Createdby.Id를 db_users.csv의 Person.id로 직접 매칭합니다.
"""

import os
import sys
import pandas as pd
import psycopg2
from psycopg2 import sql
from datetime import datetime
from typing import Optional, Dict, List, Tuple
import logging
from pathlib import Path

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class Colors:
    CYAN = '\033[36m'
    GREEN = '\033[32m'
    YELLOW = '\033[33m'
    RED = '\033[31m'
    RESET = '\033[0m'


def log_colored(message: str, color: str = ''):
    """컬러로 로그 출력"""
    logger.info(f"{color}{message}{Colors.RESET}")


class WorklogSeederPersonId:
    def __init__(self, db_host='localhost', db_port=5434, db_name='edwards', 
                 db_user='postgres', db_password='postgres'):
        self.db_host = db_host
        self.db_port = db_port
        self.db_name = db_name
        self.db_user = db_user
        self.db_password = db_password
        self.conn = None
        self.users = {}  # {email: uuid}
        self.person_id_to_uuid = {}  # {Person.id: uuid}
        self.default_user_id = None
        self.project_id_cache = {}
        self.worktype_id_cache = {}
        self.valid_projects = set()  # 존재하는 프로젝트 ID 캐시
    
    def connect(self):
        """DB 연결"""
        try:
            self.conn = psycopg2.connect(
                host=self.db_host,
                port=self.db_port,
                database=self.db_name,
                user=self.db_user,
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
            cur.execute("SELECT id, email FROM users WHERE is_active = true")
            for user_id, email in cur.fetchall():
                self.users[email.lower()] = user_id
            
            # 기본 사용자 (Ian Kim) 찾기
            cur.execute("SELECT id FROM users WHERE email ILIKE '%ian.kim%' LIMIT 1")
            result = cur.fetchone()
            if result:
                self.default_user_id = result[0]
            
            cur.close()
            log_colored(f"✅ 사용자 {len(self.users)}명 로드됨", Colors.GREEN)
            log_colored(f"   기본 사용자: {self.default_user_id}", Colors.CYAN)
        except psycopg2.Error as e:
            log_colored(f"❌ 사용자 로드 실패: {e}", Colors.RED)
            sys.exit(1)
    
    def load_projects(self):
        """DB에서 프로젝트 ID와 이름 로드 - 텍스트 매칭용"""
        try:
            cur = self.conn.cursor()
            cur.execute("SELECT id, name FROM projects")
            valid_project_ids = set()
            self.project_name_to_id = {}  # 프로젝트 이름 → UUID 매핑
            self.default_project_id = None  # 기본 프로젝트 (General/Non-Project)
            
            for project_id, project_name in cur.fetchall():
                valid_project_ids.add(project_id)
                # 이름을 소문자로 변환하여 저장 (대소문자 무관 매칭)
                name_lower = project_name.lower() if project_name else ''
                self.project_name_to_id[name_lower] = project_id
                
                # General/Non-Project를 기본 프로젝트로 설정
                if 'general/non-project' in name_lower:
                    self.default_project_id = project_id
                    log_colored(f"   기본 프로젝트: {project_name} ({project_id})", Colors.CYAN)
                
                # 키워드 추출 (프로젝트 이름에서)
                # 예: "2025 EUV Gen4 Phase 1 Tumalo" → ["tumalo", "gen4", "euv"]
                keywords = name_lower.replace('_', ' ').replace('-', ' ').split()
                for keyword in keywords:
                    if len(keyword) > 3 and keyword not in ['phase', 'project', 'for']:
                        if keyword not in self.project_name_to_id or len(name_lower) > len(self.project_name_to_id.get(keyword, '')):
                            self.project_name_to_id[keyword] = project_id
            
            self.valid_projects = valid_project_ids
            cur.close()
            log_colored(f"✅ 프로젝트 {len(valid_project_ids)}개 로드됨 (키워드 {len(self.project_name_to_id)}개)", Colors.GREEN)
        except psycopg2.Error as e:
            log_colored(f"❌ 프로젝트 로드 실패: {e}", Colors.RED)
            sys.exit(1)
    
    def match_project_by_description(self, description: str) -> Optional[str]:
        """Description에서 프로젝트 이름 키워드 추출하여 매칭"""
        if not description or not hasattr(self, 'project_name_to_id'):
            return None
        
        desc_lower = description.lower()
        
        # 우선순위 키워드 (더 구체적인 프로젝트 이름)
        priority_keywords = ['vizeon', 'tumalo', 'protron', 'savas', 'unify', 'hermes', 
                            'havasu', 'zenith', 'areca', 'lpln', 'micron', 'taylor']
        
        # 1차: 우선순위 키워드 매칭
        for keyword in priority_keywords:
            if keyword in desc_lower and keyword in self.project_name_to_id:
                return self.project_name_to_id[keyword]
        
        # 2차: 모든 키워드 매칭 (긴 키워드 우선)
        for keyword in sorted(self.project_name_to_id.keys(), key=len, reverse=True):
            if len(keyword) > 4 and keyword in desc_lower:
                return self.project_name_to_id[keyword]
        
        return None
    
    def load_reference_data(self):
        """db_users.csv에서 Person.id → email 매핑 로드"""
        try:
            ref_path = Path(__file__).parent.parent.parent / 'ref_table' / 'db_users.csv'
            df = pd.read_csv(ref_path)
            
            log_colored(f"\n📋 db_users.csv 로드 - {len(df)}개 레코드", Colors.CYAN)
            
            # Person.id → email 매핑 생성
            person_email_map = {}
            for _, row in df.iterrows():
                person_id = str(int(row['Person.id'])).strip()
                email = str(row['Person.email']).strip().lower()
                person_email_map[person_id] = email
                
                # email이 DB에 있으면 UUID 저장
                if email in self.users:
                    self.person_id_to_uuid[person_id] = self.users[email]
            
            log_colored(f"✅ Person.id 매핑: {len(self.person_id_to_uuid)}/{len(df)}개", Colors.GREEN)
            
            # 매핑 통계
            log_colored(f"\n=== Person.id → email 매핑 샘플 ===", Colors.CYAN)
            for person_id in sorted(list(self.person_id_to_uuid.keys())[:10]):
                if person_id in person_email_map:
                    email = person_email_map[person_id]
                    uuid = self.person_id_to_uuid[person_id]
                    log_colored(f"  {person_id} -> {email} -> {uuid}", Colors.CYAN)
            
        except Exception as e:
            log_colored(f"❌ 참조 데이터 로드 실패: {e}", Colors.RED)
            sys.exit(1)
    
    def get_user_id(self, created_by_id_raw: str) -> Optional[str]:
        """Createdby.Id → Person.id → email → UUID 변환"""
        if not created_by_id_raw or not str(created_by_id_raw).strip():
            return self.default_user_id
        
        try:
            person_id = str(int(float(str(created_by_id_raw).strip())))
            
            # Person.id 직접 매칭
            if person_id in self.person_id_to_uuid:
                return self.person_id_to_uuid[person_id]
        except (ValueError, TypeError):
            pass
        
        return self.default_user_id
    
    def load_worklog_csv(self) -> pd.DataFrame:
        """워크로그 CSV 로드"""
        try:
            csv_path = Path(__file__).parent.parent.parent / 'ref_table' / 'tb_worklog_filtered_2026.1.13.csv'
            df = pd.read_csv(csv_path, encoding='utf-8')
            log_colored(f"✅ 워크로그 CSV 로드: {len(df)}개 레코드", Colors.GREEN)
            return df
        except Exception as e:
            log_colored(f"❌ CSV 로드 실패: {e}", Colors.RED)
            sys.exit(1)
    
    def delete_seeded_worklogs(self):
        """이전에 잘못 시딩된 데이터 삭제"""
        try:
            cur = self.conn.cursor()
            
            # 2026-01-13에 생성된 워크로그 삭제
            cur.execute("""
                DELETE FROM worklogs 
                WHERE created_at >= '2026-01-13 00:00:00' 
                AND created_at < '2026-01-14 00:00:00'
            """)
            
            deleted = cur.rowcount
            self.conn.commit()
            cur.close()
            
            if deleted > 0:
                log_colored(f"✅ 이전 시딩 데이터 삭제: {deleted}개 레코드", Colors.YELLOW)
            else:
                log_colored("ℹ️  삭제할 데이터 없음", Colors.CYAN)
        except psycopg2.Error as e:
            log_colored(f"❌ 삭제 실패: {e}", Colors.RED)
            self.conn.rollback()
    
    def seed_worklogs(self, dry_run=False):
        """워크로그 데이터 시딩"""
        df = self.load_worklog_csv()
        
        success_count = 0
        skip_count = 0
        error_count = 0
        
        # 통계 수집
        user_stats = {}  # {user_id: count}
        skip_reasons = {}  # {reason: count}
        project_match_stats = {'matched': 0, 'not_matched': 0, 'non_project': 0}  # 프로젝트 매칭 통계
        
        log_colored(f"\n{'='*100}", Colors.CYAN)
        log_colored(f"{'행':<6} {'Createdby.Id':<15} {'Person.id 매칭':<20} {'사용자':<35} {'상태':<30}", Colors.CYAN)
        log_colored(f"{'='*100}", Colors.CYAN)
        
        # 배치 처리 (100개씩)
        batch_size = 100
        batches = []
        current_batch = []
        
        for idx, row in df.iterrows():
            try:
                # 필수 필드 추출
                created_by_id_raw = str(row['Createdby.Id']) if pd.notna(row['Createdby.Id']) else ''
                
                # Person.id 변환
                user_id = self.get_user_id(created_by_id_raw)
                
                # 매핑 상태 확인
                person_id_str = str(int(float(str(created_by_id_raw).strip()))) if created_by_id_raw else 'NULL'
                is_mapped = person_id_str in self.person_id_to_uuid
                
                if not is_mapped:
                    skip_count += 1
                    reason = f"Person.id {person_id_str} 미등재"
                    skip_reasons[reason] = skip_reasons.get(reason, 0) + 1
                    
                    status = f"⏭️  {reason}"
                    logger.info(f"{idx+1:<6} {created_by_id_raw:<15} {person_id_str:<20} {'-':<35} {status:<30}")
                    continue
                
                # 나머지 필드 처리
                hours = float(row['Hours']) if pd.notna(row['Hours']) else 1.0
                description = str(row['Title']).strip()  # CSV의 Title → description
                is_project = str(row['IsProject?']).strip() if pd.notna(row['IsProject?']) else 'NonProject'
                project_id_raw = str(row['Project.Id']) if pd.notna(row['Project.Id']) else ''
                worktype_id_raw = str(row['Worktype.Id']).strip() if pd.notna(row['Worktype.Id']) else ''
                
                # 프로젝트 ID 처리 (개선된 로직)
                project_id = None
                if is_project == 'Project':
                    # 1차: CSV의 프로젝트 ID로 직접 매칭 시도
                    if project_id_raw:
                        try:
                            old_project_id = int(project_id_raw)
                            # 구 시스템 ID는 신 시스템에 없으므로 스킵
                        except:
                            pass
                    
                    # 2차: Description에서 프로젝트 이름 키워드 추출하여 매칭
                    matched_id = self.match_project_by_description(description)
                    if matched_id:
                        project_id = matched_id
                        project_match_stats['matched'] += 1
                        # 디버깅용 (처음 5개만 출력)
                        if project_match_stats['matched'] <= 5:
                            logger.info(f"  ✅ 프로젝트 매칭: '{description[:50]}...' → {project_id}")
                    else:
                        # 프로젝트 타입이지만 매칭 실패 - General/Non-Project에 할당
                        if self.default_project_id:
                            project_id = self.default_project_id
                            project_match_stats['default_assigned'] = project_match_stats.get('default_assigned', 0) + 1
                            if project_match_stats.get('default_assigned', 0) <= 5:
                                logger.info(f"  📁 General/Non-Project 할당: '{description[:50]}...'")
                        else:
                            project_match_stats['not_matched'] += 1
                            if project_match_stats['not_matched'] <= 5:
                                logger.info(f"  ⚠️ 프로젝트 미매칭: '{description[:50]}...'")
                else:
                    project_match_stats['non_project'] += 1
                
                # 워크타입 ID 처리
                worktype_id = None
                if worktype_id_raw:
                    try:
                        worktype_id = int(worktype_id_raw)
                    except:
                        pass
                
                # 날짜 파싱
                date_str = str(row['Date']).strip()
                date = None
                try:
                    # 여러 포맷 시도
                    for fmt in ['%A, %B %d, %Y', '%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y', '%Y/%m/%d']:
                        try:
                            date = datetime.strptime(date_str, fmt).date()
                            break
                        except ValueError:
                            pass
                except:
                    pass
                
                # date가 None이면 스킵
                if date is None:
                    skip_count += 1
                    logger.warning(f"{idx+1:<6} {created_by_id_raw:<15} 날짜 파싱 실패: {date_str}")
                    continue
                
                current_batch.append({
                    'date': date,
                    'hours': hours,
                    'description': description,
                    'user_id': user_id,
                    'project_id': project_id,
                    'worktype_id': worktype_id,
                    'is_sudden_work': str(row['SuddenWork?']).upper() == 'TRUE' if pd.notna(row['SuddenWork?']) else False,
                    'is_business_trip': str(row['BusinessTrip']).upper() == 'TRUE' if pd.notna(row['BusinessTrip']) else False,
                })
                
                success_count += 1
                user_stats[user_id] = user_stats.get(user_id, 0) + 1
                
                status = "✅ 매핑성공"
                logger.info(f"{idx+1:<6} {created_by_id_raw:<15} {person_id_str:<20} {str(user_id)[:35]:<35} {status:<30}")
                
                # 배치 완성
                if len(current_batch) >= batch_size:
                    batches.append(current_batch)
                    current_batch = []
                    log_colored(f"   → 배치 {len(batches)} 준비 ({len(batches) * batch_size} 레코드)", Colors.CYAN)
            
            except Exception as e:
                error_count += 1
                logger.error(f"{idx+1:<6} 오류: {e}")
        
        # 마지막 배치
        if current_batch:
            batches.append(current_batch)
        
        # 통계
        log_colored(f"\n{'='*100}", Colors.CYAN)
        log_colored(f"\n📊 시딩 통계 (DRY-RUN={dry_run})", Colors.CYAN)
        log_colored(f"  ✅ 성공: {success_count}개", Colors.GREEN)
        log_colored(f"  ❌ 스킵: {skip_count}개", Colors.YELLOW)
        
        log_colored(f"\n📋 프로젝트 매칭 통계", Colors.CYAN)
        log_colored(f"  ✅ 키워드 매칭 성공: {project_match_stats['matched']}개", Colors.GREEN)
        log_colored(f"  📁 General/Non-Project 할당: {project_match_stats.get('default_assigned', 0)}개", Colors.YELLOW)
        log_colored(f"  ⚠️ 매칭 실패 (project_id=NULL): {project_match_stats['not_matched']}개", Colors.YELLOW)
        log_colored(f"  ℹ️  NonProject 타입: {project_match_stats['non_project']}개", Colors.CYAN)
        
        total_projects = project_match_stats['matched'] + project_match_stats.get('default_assigned', 0)
        total_attempts = project_match_stats['matched'] + project_match_stats.get('default_assigned', 0) + project_match_stats['not_matched']
        if total_attempts > 0:
            coverage_rate = (total_projects / total_attempts) * 100
            log_colored(f"  📈 프로젝트 할당률: {coverage_rate:.1f}% ({total_projects}/{total_attempts})", Colors.GREEN)
        
        if skip_reasons:
            log_colored(f"\n❌ 스킵 사유", Colors.YELLOW)
            for reason, count in sorted(skip_reasons.items(), key=lambda x: -x[1])[:5]:
                log_colored(f"   {reason}: {count}개", Colors.YELLOW)
        
        if user_stats:
            log_colored(f"\n👥 사용자별 레코드 수 (상위 10)", Colors.GREEN)
            for user_id, count in sorted(user_stats.items(), key=lambda x: -x[1])[:10]:
                log_colored(f"   {user_id}: {count}개", Colors.GREEN)
        
        # 실제 삽입
        if not dry_run and success_count > 0:
            log_colored(f"\n🔄 DB에 {len(batches)} 배치 삽입 중...", Colors.CYAN)
            self.insert_batches(batches)
    
    def insert_batches(self, batches: List[List[Dict]]):
        """배치로 DB에 삽입"""
        try:
            cur = self.conn.cursor()
            total_inserted = 0
            
            for batch_num, batch in enumerate(batches, 1):
                for item in batch:
                    cur.execute("""
                        INSERT INTO worklogs (date, hours, description, user_id, project_id, work_type_category_id, is_sudden_work, is_business_trip, created_at, updated_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
                    """, (
                        item['date'], item['hours'], item['description'], item['user_id'],
                        item['project_id'], item['worktype_id'],
                        item['is_sudden_work'], item['is_business_trip']
                    ))
                
                self.conn.commit()
                total_inserted += len(batch)
                log_colored(f"   ✅ 배치 {batch_num}/{len(batches)} 완료 ({len(batch)}개)", Colors.GREEN)
            
            cur.close()
            log_colored(f"\n✅ 총 {total_inserted}개 레코드 삽입 완료", Colors.GREEN)
        except psycopg2.Error as e:
            log_colored(f"❌ 삽입 실패: {e}", Colors.RED)
            self.conn.rollback()
    
    def close(self):
        """DB 연결 종료"""
        if self.conn:
            self.conn.close()
            log_colored("✅ DB 연결 종료", Colors.GREEN)


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='워크로그 데이터 시딩 (Person.id 직접 매칭)')
    parser.add_argument('--dry-run', action='store_true', help='실행 없이 검증만 수행')
    parser.add_argument('--no-delete', action='store_true', help='이전 데이터 삭제 안 함')
    args = parser.parse_args()
    
    # 환경 변수에서 비밀번호 가져오기 (기본값: password)
    db_password = os.getenv('POSTGRES_PASSWORD', 'password')
    seeder = WorklogSeederPersonId(db_password=db_password)
    
    try:
        log_colored("\n" + "="*100, Colors.CYAN)
        log_colored("🚀 워크로그 시딩 시작 (Person.id 직접 매칭)", Colors.CYAN)
        log_colored("="*100, Colors.CYAN)
        
        seeder.connect()
        seeder.load_users()
        seeder.load_projects()  # 프로젝트 로드 추가
        seeder.load_reference_data()
        
        if not args.no_delete and not args.dry_run:
            seeder.delete_seeded_worklogs()
        
        seeder.seed_worklogs(dry_run=args.dry_run)
        
        log_colored("\n" + "="*100, Colors.CYAN)
        if args.dry_run:
            log_colored("✅ DRY-RUN 완료 (DB에 반영되지 않음)", Colors.YELLOW)
        else:
            log_colored("✅ 시딩 완료!", Colors.GREEN)
        log_colored("="*100, Colors.CYAN + "\n")
    
    except Exception as e:
        log_colored(f"❌ 오류 발생: {e}", Colors.RED)
        sys.exit(1)
    
    finally:
        seeder.close()


if __name__ == '__main__':
    main()
