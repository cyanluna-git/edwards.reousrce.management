#!/usr/bin/env python3
"""
워크로그 데이터 시딩 스크립트
CSV 파일의 데이터를 PostgreSQL DB에 삽입합니다.
한글 인코딩 완벽 지원.
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


class WorklogSeeder:
    def __init__(self, 
                 host: str = 'localhost',
                 port: int = 5434,
                 database: str = 'edwards',
                 user: str = 'postgres',
                 password: str = 'postgres'):
        """PostgreSQL 연결 초기화"""
        self.connection = None
        self.cursor = None
        self.connect(host, port, database, user, password)
        
        # 참조 데이터 캐시
        self.projects = {}  # {id: {code, name}}
        self.users = {}  # {id: {email, name}}
        self.work_types = {}  # {id: {code, name}}
        self.load_reference_data()
    
    def connect(self, host: str, port: int, database: str, user: str, password: str):
        """PostgreSQL 연결"""
        try:
            self.connection = psycopg2.connect(
                host=host,
                port=port,
                database=database,
                user=user,
                password=password,
                client_encoding='UTF8'
            )
            self.cursor = self.connection.cursor()
            log_colored(f"✅ PostgreSQL 연결 성공: {host}:{port}/{database}", Colors.GREEN)
        except psycopg2.Error as e:
            log_colored(f"❌ DB 연결 실패: {e}", Colors.RED)
            raise
    
    def load_reference_data(self):
        """기존 데이터 로드 (프로젝트, 사용자, 업무유형)"""
        try:
            # 프로젝트 로드
            self.cursor.execute(
                "SELECT id, code, name FROM projects ORDER BY id"
            )
            self.projects = {
                row[0]: {'code': row[1], 'name': row[2]} 
                for row in self.cursor.fetchall()
            }
            
            # 사용자 로드
            self.cursor.execute(
                "SELECT id, email, name, korean_name FROM users WHERE is_active = true ORDER BY id"
            )
            self.users = {
                row[0]: {'email': row[1], 'name': row[2], 'korean_name': row[3]} 
                for row in self.cursor.fetchall()
            }
            
            # 기본 사용자 설정 (매핑 실패시 사용)
            if self.users:
                self.default_user_id = list(self.users.keys())[0]
            else:
                log_colored(f"❌ 활성 사용자가 없습니다!", Colors.RED)
                raise Exception("활성 사용자 없음")
            
            # 상위 업무 유형 로드 (parent_id IS NULL)
            self.cursor.execute(
                "SELECT id, code, name FROM work_type_categories WHERE parent_id IS NULL ORDER BY id"
            )
            self.work_types = {
                row[0]: {'code': row[1], 'name': row[2]} 
                for row in self.cursor.fetchall()
            }
            
            log_colored(
                f"✅ 참조 데이터 로드 완료:\n"
                f"   - 프로젝트: {len(self.projects)}개\n"
                f"   - 사용자: {len(self.users)}개\n"
                f"   - 업무유형: {len(self.work_types)}개",
                Colors.GREEN
            )
            
            # 데이터 샘플 출력
            if self.projects:
                sample_project = list(self.projects.values())[0]
                logger.info(f"   샘플 프로젝트: {sample_project}")
            
            if self.users:
                sample_user = list(self.users.values())[0]
                logger.info(f"   샘플 사용자: {sample_user}")
            
            if self.work_types:
                logger.info(f"   업무유형: {', '.join([v['name'] for v in self.work_types.values()])}")
        
        except psycopg2.Error as e:
            log_colored(f"❌ 참조 데이터 로드 실패: {e}", Colors.RED)
            raise
    
    def infer_project_id(self, title: str, is_project: str, project_id_raw: str) -> Optional[str]:
        """프로젝트 ID 추론"""
        # 1. 명시적 프로젝트 ID가 있으면 사용
        if is_project.strip().upper() == 'PROJECT' and project_id_raw.strip():
            try:
                pid = int(project_id_raw.strip())
                if pid in self.projects:
                    return pid
            except (ValueError, TypeError):
                pass
        
        # 2. 제목의 키워드로 프로젝트 추론
        keyword_mapping = {
            'LPLN': 'LPLN',
            'SAVAS': 'SAVAS',
            'Protron': 'PROTRON',
            'SDC': 'SDC',
            'Tumalo': 'TUMALO',
            'Vizeon': 'VIZEON',
            'Unify': 'UNIFY',
            'HRS': 'HRS',
            'Gen3': 'GEN3',
            'IBM': 'IBM',
            'OMT': 'OMT',
            'OQC': 'OQC',
            'EUV': 'EUV',
            'Micron': 'MICRON',
        }
        
        for keyword, project_code in keyword_mapping.items():
            if keyword.lower() in title.lower():
                # 프로젝트 코드로 찾기
                for pid, proj_data in self.projects.items():
                    if project_code.lower() in proj_data['code'].lower():
                        return pid
        
        return None
    
    def infer_worktype_id(self, title: str, meeting_type: str, worktype_raw: str) -> int:
        """업무 유형 ID 추론 (항상 기본값 반환)"""
        # 1. 수치 직접 입력 시도
        if worktype_raw and str(worktype_raw).strip():
            try:
                wtid = int(str(worktype_raw).strip())
                if wtid in self.work_types:
                    return wtid
            except (ValueError, TypeError):
                pass
        
        # 2. meeting_type 기반 추론
        if meeting_type and str(meeting_type).strip():
            meeting_lower = str(meeting_type).strip().lower()
            
            # 정확한 매칭
            if 'meeting' in meeting_lower or 'mtg' in meeting_lower:
                # Engineering 카테고리 찾기
                for wtid, wt_data in self.work_types.items():
                    if 'eng' in wt_data['code'].lower():
                        return wtid
            
            # 코드 또는 이름에서 검색
            for wtid, wt_data in self.work_types.items():
                if (meeting_lower in wt_data['code'].lower() or 
                    meeting_lower in wt_data['name'].lower()):
                    return wtid
        
        # 3. 제목 기반 추론
        title_lower = title.lower()
        
        # Meeting 유형
        if any(word in title_lower for word in ['meeting', 'mtg', '1:1', 'weekly', 'ogsm', 'review']):
            for wtid, wt_data in self.work_types.items():
                if 'eng' in wt_data['code'].lower():  # Engineering으로 기본 설정
                    return wtid
        
        # 기타 유형
        type_mappings = {
            'design': 'PRJ',
            'development': 'PRJ',
            'coding': 'PRJ',
            'testing': 'PRJ',
            'test': 'PRJ',
            'verification': 'PRJ',
            'documentation': 'PRJ',
            'document': 'PRJ',
            'training': 'KNW',
            'seminar': 'KNW',
            'research': 'KNW',
            'admin': 'ADM',
            'management': 'ADM',
            'email': 'SUP',
            'support': 'SUP',
            'vacation': 'ABS',
            'leave': 'ABS',
            'absent': 'ABS',
        }
        
        for keyword, code in type_mappings.items():
            if keyword in title_lower:
                for wtid, wt_data in self.work_types.items():
                    if code.lower() in wt_data['code'].lower():
                        return wtid
        
        # 기본값: Engineering (첫 번째 타입) 또는 1번
        if self.work_types:
            return list(self.work_types.keys())[0]
        return 1
    
    def infer_user_id(self, created_by_id_raw: str) -> str:
        """사용자 ID 추론 (매핑 실패시 기본 사용자)"""
        if not created_by_id_raw or not str(created_by_id_raw).strip():
            return self.default_user_id
        
        try:
            user_id_str = str(created_by_id_raw).strip()
            
            # 1. 직접 사용자 ID인 경우 (UUID)
            if user_id_str in self.users:
                return user_id_str
            
            # 2. 정수 ID인 경우 (Legacy)
            try:
                user_num = int(user_id_str)
                sorted_user_ids = sorted(self.users.keys())
                if user_num > 0 and user_num <= len(sorted_user_ids):
                    return sorted_user_ids[user_num - 1]
            except (ValueError, TypeError):
                pass
        
        except Exception:
            pass
        
        # 기본 사용자 반환 (NOT NULL 제약 대응)
        return self.default_user_id
    
    def parse_date(self, date_str: str) -> Optional[str]:
        """날짜 파싱 (ISO 형식)"""
        try:
            # "Monday, December 1, 2025" 형식
            dt = pd.to_datetime(date_str, format='%A, %B %d, %Y', errors='coerce')
            if pd.isna(dt):
                return None
            return dt.strftime('%Y-%m-%d')
        except Exception as e:
            logger.debug(f"날짜 파싱 실패: {date_str}")
            return None
    
    def seed_worklogs(self, csv_file: str, batch_size: int = 50, dry_run: bool = False):
        """워크로그 데이터 시딩"""
        if not os.path.exists(csv_file):
            log_colored(f"❌ CSV 파일 없음: {csv_file}", Colors.RED)
            return
        
        try:
            # CSV 로드 (Latin-1 인코딩 - Excel 호환)
            df = pd.read_csv(csv_file, encoding='latin1')
            log_colored(f"✅ CSV 로드: {len(df)}개 행", Colors.GREEN)
            
            if dry_run:
                log_colored("\n🔍 DRY RUN 모드 - 실제 삽입하지 않음\n", Colors.YELLOW)
            
            inserted = 0
            skipped = 0
            errors = []
            
            log_colored(f"\n{'='*80}", Colors.CYAN)
            log_colored(f"{'행':<5} {'날짜':<12} {'시간':<5} {'제목':<30} {'프로젝트':<5} {'상태'}", Colors.CYAN)
            log_colored(f"{'='*80}", Colors.CYAN)
            
            for idx, row in df.iterrows():
                try:
                    # 날짜 파싱
                    date = self.parse_date(str(row['Date']))
                    if not date:
                        skipped += 1
                        status = "⏭️  날짜파싱실패"
                        logger.info(f"{idx+1:<5} {'-':<12} {'-':<5} {str(row['Title'])[:30]:<30} {'-':<5} {status}")
                        continue
                    
                    # 필수 필드 추출
                    hours = float(row['Hours']) if pd.notna(row['Hours']) else 1.0
                    title = str(row['Title']).strip()
                    is_project = str(row['IsProject?']).strip() if pd.notna(row['IsProject?']) else 'NonProject'
                    project_id_raw = str(row['Project.Id']) if pd.notna(row['Project.Id']) else ''
                    created_by_id_raw = str(row['Createdby.Id']) if pd.notna(row['Createdby.Id']) else ''
                    meeting_type = str(row['MeetingType']).strip() if pd.notna(row['MeetingType']) else ''
                    worktype_id_raw = str(row['Worktype.Id']).strip() if pd.notna(row['Worktype.Id']) else ''
                    sudden_work = str(row['SuddenWork?']).strip().upper() == 'TRUE' if pd.notna(row['SuddenWork?']) else False
                    business_trip = str(row['BusinessTrip']).strip().upper() == 'TRUE' if pd.notna(row['BusinessTrip']) else False
                    
                    # ID 추론
                    project_id = self.infer_project_id(title, is_project, project_id_raw)
                    user_id = self.infer_user_id(created_by_id_raw)
                    worktype_id = self.infer_worktype_id(title, meeting_type, worktype_id_raw)
                    
                    # 사용자 ID가 없으면 NULL 처리 (선택사항)
                    # 업무 유형 필수
                    if not worktype_id:
                        skipped += 1
                        status = "⏭️  업무유형없음"
                        logger.info(f"{idx+1:<5} {date:<12} {hours:<5.1f} {title[:30]:<30} {'-':<5} {status}")
                        continue
                    
                    # DRY RUN 모드에서만 출력
                    if not dry_run:
                        # SQL 삽입
                        insert_query = sql.SQL("""
                            INSERT INTO worklogs 
                            (date, hours, description, project_id, user_id, work_type_category_id, 
                             is_sudden_work, is_business_trip, created_at, updated_at)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
                            ON CONFLICT DO NOTHING
                        """)
                        
                        self.cursor.execute(insert_query, (
                            date,
                            hours,
                            title,
                            project_id,
                            user_id,
                            worktype_id,
                            sudden_work,
                            business_trip
                        ))
                    
                    project_code = self.projects.get(project_id, {}).get('code', '-') if project_id else '-'
                    status = "✅ 성공"
                    logger.info(f"{idx+1:<5} {date:<12} {hours:<5.1f} {title[:30]:<30} {project_code:<5} {status}")
                    
                    inserted += 1
                    
                    # 배치 커밋
                    if not dry_run and inserted % batch_size == 0:
                        self.connection.commit()
                        log_colored(f"   ✓ {inserted}개 행 커밋됨...", Colors.GREEN)
                
                except Exception as e:
                    error_msg = f"행 {idx+1}: {str(e)[:80]}"
                    errors.append(error_msg)
                    skipped += 1
                    status = "❌ 오류"
                    logger.info(f"{idx+1:<5} {'-':<12} {'-':<5} {str(row['Title'])[:30]:<30} {'-':<5} {status}")
                    continue
            
            log_colored(f"{'='*80}\n", Colors.CYAN)
            
            # 최종 커밋
            if not dry_run:
                self.connection.commit()
            
            log_colored("\n" + "="*60, Colors.CYAN)
            log_colored("🎉 시딩 완료!", Colors.GREEN)
            log_colored(f"   - 성공: {inserted}개", Colors.GREEN)
            log_colored(f"   - 스킵: {skipped}개", Colors.YELLOW)
            
            if errors:
                log_colored(f"\n⚠️  처리 중 발생한 오류 ({len(errors)}개):", Colors.YELLOW)
                for error in errors[:10]:
                    log_colored(f"   - {error}", Colors.YELLOW)
                if len(errors) > 10:
                    log_colored(f"   ... 외 {len(errors) - 10}개", Colors.YELLOW)
            
            log_colored("="*60 + "\n", Colors.CYAN)
        
        except Exception as e:
            log_colored(f"❌ 시딩 실패: {e}", Colors.RED)
            if not dry_run:
                self.connection.rollback()
            raise
        finally:
            if not dry_run:
                self.close()
    
    def close(self):
        """DB 연결 종료"""
        if self.cursor:
            self.cursor.close()
        if self.connection:
            self.connection.close()
        log_colored("✅ DB 연결 종료", Colors.GREEN)


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='워크로그 데이터 시딩')
    parser.add_argument('csv_file', help='CSV 파일 경로')
    parser.add_argument('--host', default='localhost', help='PostgreSQL 호스트')
    parser.add_argument('--port', type=int, default=5434, help='PostgreSQL 포트')
    parser.add_argument('--db', default='edwards', help='데이터베이스명')
    parser.add_argument('--user', default='postgres', help='PostgreSQL 사용자')
    parser.add_argument('--password', default='postgres', help='PostgreSQL 비밀번호')
    parser.add_argument('--dry-run', action='store_true', help='실제 삽입하지 않고 미리보기만 수행')
    parser.add_argument('--batch-size', type=int, default=50, help='배치 커밋 크기')
    
    args = parser.parse_args()
    
    try:
        seeder = WorklogSeeder(
            host=args.host,
            port=args.port,
            database=args.db,
            user=args.user,
            password=args.password
        )
        
        seeder.seed_worklogs(
            args.csv_file,
            batch_size=args.batch_size,
            dry_run=args.dry_run
        )
    except Exception as e:
        log_colored(f"프로그램 종료: {e}", Colors.RED)
        sys.exit(1)
