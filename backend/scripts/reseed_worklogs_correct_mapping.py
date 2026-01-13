#!/usr/bin/env python3
"""
워크로그 데이터 정확한 사용자 매핑 후 재시딩
db_users.csv를 참고해서 정확한 사용자에게 할당합니다.
"""

import os
import sys
import pandas as pd
import psycopg2
from psycopg2 import sql
from datetime import datetime
from typing import Optional, Dict
import logging

# 로깅 설정
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class Colors:
    CYAN = '\033[36m'
    GREEN = '\033[32m'
    YELLOW = '\033[33m'
    RED = '\033[31m'
    RESET = '\033[0m'


def log_colored(message: str, color: str = ''):
    logger.info(f"{color}{message}{Colors.RESET}")


class WorklogReseeder:
    def __init__(self, 
                 host: str = 'localhost',
                 port: int = 5434,
                 database: str = 'edwards',
                 user: str = 'postgres',
                 password: str = 'postgres'):
        self.connection = None
        self.cursor = None
        self.connect(host, port, database, user, password)
        
        self.users_map = {}  # {email -> uuid}
        self.csv_users_map = {}  # {csv_id -> email}
        self.work_types = {}  # {id -> {code, name}}
        self.load_reference_data()
    
    def connect(self, host: str, port: int, database: str, user: str, password: str):
        try:
            self.connection = psycopg2.connect(
                host=host, port=port, database=database,
                user=user, password=password, client_encoding='UTF8'
            )
            self.cursor = self.connection.cursor()
            log_colored(f"✅ PostgreSQL 연결 성공", Colors.GREEN)
        except psycopg2.Error as e:
            log_colored(f"❌ DB 연결 실패: {e}", Colors.RED)
            raise
    
    def load_reference_data(self):
        try:
            # DB의 사용자 로드 (UUID와 이메일 매핑)
            self.cursor.execute("SELECT id, email FROM users WHERE is_active = true")
            self.users_map = {
                row[1].lower(): row[0] for row in self.cursor.fetchall()
            }
            
            # CSV의 사용자 매핑 로드
            users_csv = pd.read_csv('ref_table/db_users.csv', encoding='utf-8-sig')
            for _, row in users_csv.iterrows():
                csv_id = row['ID']
                email = str(row['Person.email']).lower()
                self.csv_users_map[csv_id] = email
            
            # 업무 유형 로드
            self.cursor.execute("SELECT id, code, name FROM work_type_categories WHERE parent_id IS NULL")
            self.work_types = {row[0]: {'code': row[1], 'name': row[2]} for row in self.cursor.fetchall()}
            
            log_colored(
                f"✅ 참조 데이터 로드:\n"
                f"   - DB 사용자: {len(self.users_map)}명\n"
                f"   - CSV 사용자 매핑: {len(self.csv_users_map)}개\n"
                f"   - 업무유형: {len(self.work_types)}개",
                Colors.GREEN
            )
        except psycopg2.Error as e:
            log_colored(f"❌ 참조 데이터 로드 실패: {e}", Colors.RED)
            raise
    
    def get_user_id(self, csv_created_by_id: int) -> Optional[str]:
        """CSV의 Createdby.Id를 DB의 user UUID로 변환"""
        if csv_created_by_id not in self.csv_users_map:
            return None
        
        email = self.csv_users_map[csv_created_by_id]
        return self.users_map.get(email, None)
    
    def parse_date(self, date_str: str) -> Optional[str]:
        try:
            dt = pd.to_datetime(date_str, format='%A, %B %d, %Y', errors='coerce')
            if pd.isna(dt):
                return None
            return dt.strftime('%Y-%m-%d')
        except Exception:
            return None
    
    def delete_seeded_worklogs(self):
        """기존 시딩 데이터 삭제 (Ian Kim - 기본 사용자)"""
        try:
            # Ian Kim의 ID 찾기
            self.cursor.execute("SELECT id FROM users WHERE email = %s", ('ian.a.kim@csk.kr',))
            result = self.cursor.fetchone()
            if result:
                ian_kim_id = result[0]
                self.cursor.execute(
                    "DELETE FROM worklogs WHERE user_id = %s AND created_at >= %s",
                    (ian_kim_id, datetime(2026, 1, 13))
                )
                count = self.cursor.rowcount
                self.connection.commit()
                log_colored(f"✅ 기존 시딩 데이터 삭제: {count}개", Colors.GREEN)
        except psycopg2.Error as e:
            log_colored(f"⚠️  기존 데이터 삭제 실패: {e}", Colors.YELLOW)
    
    def seed_worklogs(self, csv_file: str, batch_size: int = 100):
        try:
            df = pd.read_csv(csv_file, encoding='latin1')
            log_colored(f"✅ CSV 로드: {len(df)}개 행", Colors.GREEN)
            
            inserted = 0
            skipped = 0
            errors = []
            
            log_colored(f"\n{'='*80}\n", Colors.CYAN)
            
            for idx, row in df.iterrows():
                try:
                    # 날짜 파싱
                    date = self.parse_date(str(row['Date']))
                    if not date:
                        skipped += 1
                        continue
                    
                    # 필수 필드
                    hours = float(row['Hours']) if pd.notna(row['Hours']) else 1.0
                    title = str(row['Title']).strip()
                    created_by_id_raw = int(row['Createdby.Id']) if pd.notna(row['Createdby.Id']) else None
                    
                    # 사용자 ID 매핑
                    user_id = self.get_user_id(created_by_id_raw) if created_by_id_raw else None
                    if not user_id:
                        skipped += 1
                        continue
                    
                    # 업무 유형 (기본값: Engineering)
                    worktype_id = list(self.work_types.keys())[0] if self.work_types else 1
                    
                    # 프로젝트 ID (선택사항)
                    project_id = None
                    
                    # SQL 삽입
                    insert_query = sql.SQL("""
                        INSERT INTO worklogs 
                        (date, hours, description, project_id, user_id, work_type_category_id, created_at, updated_at)
                        VALUES (%s, %s, %s, %s, %s, %s, NOW(), NOW())
                        ON CONFLICT DO NOTHING
                    """)
                    
                    self.cursor.execute(insert_query, (
                        date, hours, title, project_id, user_id, worktype_id
                    ))
                    
                    inserted += 1
                    
                    if inserted % batch_size == 0:
                        self.connection.commit()
                        log_colored(f"   ✓ {inserted}개 행 커밋됨...", Colors.GREEN)
                
                except Exception as e:
                    error_msg = f"행 {idx+1}: {str(e)[:80]}"
                    errors.append(error_msg)
                    skipped += 1
                    continue
            
            # 최종 커밋
            self.connection.commit()
            
            log_colored(f"{'='*80}\n", Colors.CYAN)
            log_colored("🎉 재시딩 완료!", Colors.GREEN)
            log_colored(f"   - 성공: {inserted}개", Colors.GREEN)
            log_colored(f"   - 스킵: {skipped}개", Colors.YELLOW)
            
            if errors:
                log_colored(f"\n⚠️  오류 ({len(errors)}개):", Colors.YELLOW)
                for error in errors[:10]:
                    log_colored(f"   - {error}", Colors.YELLOW)
        
        except Exception as e:
            log_colored(f"❌ 재시딩 실패: {e}", Colors.RED)
            self.connection.rollback()
            raise
        finally:
            self.close()
    
    def close(self):
        if self.cursor:
            self.cursor.close()
        if self.connection:
            self.connection.close()
        log_colored("✅ DB 연결 종료", Colors.GREEN)


if __name__ == "__main__":
    try:
        seeder = WorklogReseeder(
            host='localhost',
            port=5434,
            database='edwards',
            user='postgres',
            password='password'
        )
        
        # 기존 시딩 데이터 삭제
        seeder.delete_seeded_worklogs()
        
        # 정확한 사용자 매핑으로 재시딩
        seeder.seed_worklogs('ref_table/tb_worklog_filtered_2026.01.13.csv')
    
    except Exception as e:
        log_colored(f"프로그램 종료: {e}", Colors.RED)
        sys.exit(1)
