#!/usr/bin/env python3
"""
키워드 기반 General/Non-Project Worklog 분류 스크립트 (빠른 버전)

목적:
1. General/Non-Project worklogs를 키워드로 빠르게 분류
2. 팀 자체 업무 -> NULL로
3. 프로젝트 키워드 매칭 -> 해당 프로젝트로

사용법:
    python classify_general_fast.py --dry-run   # 미리보기
    python classify_general_fast.py             # 실제 업데이트
"""

import subprocess
import sys
import argparse
import re
from typing import Dict, List, Tuple, Optional

DB_CONTAINER = "edwards-postgres"
DB_USER = "postgres"
DB_NAME = "edwards"

GENERAL_PROJECT_ID = "8a45fd77-809a-442c-8000-f82a0597964d"

# 팀 내부 업무 키워드 (NULL로 이동)
TEAM_INTERNAL_KEYWORDS = [
    # Leave/Absence
    "holiday", "day off", "dayoff", "연차", "반차", "휴가", "조퇴", "지각",
    "vacation", "leave", "병가", "경조사", "예비군", "공가",
    
    # Admin/Email
    "메일", "mail", "e-mail", "email check", "업무 정리", "업무 준비",
    "time attendant", "expense", "행정",
    
    # Meeting (internal only)
    "weekly", "주간회의", "scrum", "standup", "1on1", "1 on 1", "bbl",
    
    # Training
    "training", "교육", "세미나", "seminar", "self study", "self-study",
]

# 프로젝트 키워드 매핑 (대표 키워드만)
PROJECT_KEYWORDS = {
    # EUV Projects
    "euv": ["euv ", "e.u.v"],
    "gen3": ["gen3", "gen 3"],
    "gen4": ["gen4", "gen 4", "tumalo"],
    "vizeon": ["vizeon", "vision"],
    "src": ["src ", " src"],
    "pyrex": ["pyrex"],
    
    # Customer Projects
    "tsmc": ["tsmc", "taiwan"],
    "samsung": ["samsung", "삼성"],
    "sk": ["sk hynix", "sk-hynix", "sk ", "skhynix"],
    "micron": ["micron"],
    "ymtc": ["ymtc"],
    
    # Product Lines
    "acm": ["acm "],
    "abatement": ["abatement", "abt "],
    "h2d": ["h2d"],
    "lpln": ["lpln"],
    "bcd": ["bcd"],
    
    # Support
    "eto": ["eto support", "eto "],
    "tsg": ["tsg support", "tsg "],
    "field": ["field failure", "현장 "],
}


def run_psql(sql: str) -> subprocess.CompletedProcess:
    """Execute PostgreSQL command"""
    cmd = [
        "docker", "exec", "-i", DB_CONTAINER,
        "psql", "-U", DB_USER, "-d", DB_NAME, "-t", "-A", "-c", sql
    ]
    return subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')


def load_projects() -> Dict[str, Dict]:
    """프로젝트 목록 로드"""
    sql = """
        SELECT id, name, category
        FROM projects
        WHERE category IN ('PROJECT', 'PRODUCT')
        ORDER BY name;
    """
    result = run_psql(sql)
    
    projects = {}
    if result.returncode == 0:
        for line in result.stdout.strip().split('\n'):
            if line and '|' in line:
                parts = line.split('|')
                if len(parts) >= 2:
                    proj_id, name = parts[0], parts[1]
                    category = parts[2] if len(parts) > 2 else "UNKNOWN"
                    projects[proj_id] = {"name": name, "category": category}
    
    return projects


def is_team_internal(description: str) -> bool:
    """팀 내부 업무 여부 확인"""
    desc_lower = description.lower()
    for keyword in TEAM_INTERNAL_KEYWORDS:
        if keyword.lower() in desc_lower:
            return True
    return False


def find_project_by_keyword(description: str, projects: Dict) -> Optional[Tuple[str, str, str]]:
    """키워드로 프로젝트 찾기 - Returns (project_id, project_name, matched_keyword)"""
    desc_lower = description.lower()
    
    # 1차: 프로젝트 이름 직접 매칭 (정확도 높음)
    for proj_id, proj_info in projects.items():
        proj_name = proj_info["name"]
        # 프로젝트 이름이 설명에 포함되어 있는지
        if proj_name.lower() in desc_lower:
            return (proj_id, proj_name, proj_name)
    
    # 2차: 키워드 매핑으로 찾기
    for category, keywords in PROJECT_KEYWORDS.items():
        for keyword in keywords:
            if keyword.lower() in desc_lower:
                # 해당 키워드를 포함하는 프로젝트 찾기
                for proj_id, proj_info in projects.items():
                    proj_name_lower = proj_info["name"].lower()
                    if category in proj_name_lower or keyword.lower() in proj_name_lower:
                        return (proj_id, proj_info["name"], keyword)
    
    return None


def classify_worklogs(projects: Dict, dry_run: bool = True, limit: Optional[int] = None):
    """Worklog 분류 및 업데이트"""
    
    # General/Non-Project worklogs 조회
    limit_clause = f"LIMIT {limit}" if limit else ""
    sql = f"""
        SELECT id, description
        FROM worklogs
        WHERE project_id = '{GENERAL_PROJECT_ID}'
        AND description IS NOT NULL
        AND LENGTH(description) > 2
        ORDER BY date DESC
        {limit_clause};
    """
    
    result = run_psql(sql)
    if result.returncode != 0:
        print(f"[ERROR] Failed to fetch worklogs: {result.stderr}")
        return
    
    worklogs = []
    for line in result.stdout.strip().split('\n'):
        if line and '|' in line:
            parts = line.split('|')
            if len(parts) >= 2:
                wl_id, description = parts[0], parts[1]
                worklogs.append((wl_id, description))
    
    print(f"[INFO] Analyzing {len(worklogs)} worklogs...")
    
    stats = {
        "total": len(worklogs),
        "to_null": 0,
        "to_project": 0,
        "no_change": 0
    }
    
    updates = {
        "to_null": [],
        "to_project": []
    }
    
    # 분류
    for wl_id, description in worklogs:
        # 1. 팀 내부 업무 체크
        if is_team_internal(description):
            updates["to_null"].append((wl_id, description))
            stats["to_null"] += 1
            continue
        
        # 2. 프로젝트 매칭
        match = find_project_by_keyword(description, projects)
        if match:
            proj_id, proj_name, keyword = match
            updates["to_project"].append((wl_id, proj_id, proj_name, keyword, description))
            stats["to_project"] += 1
            continue
        
        # 3. 매칭 실패
        stats["no_change"] += 1
    
    # 결과 출력
    print("\n" + "=" * 100)
    print("[RESULT] 분류 결과")
    print("=" * 100)
    print(f"총 처리:              {stats['total']:,}개")
    print(f"  -> NULL로 이동:     {stats['to_null']:,}개 ({stats['to_null']*100/stats['total']:.1f}%) - 팀 내부 업무")
    print(f"  -> 프로젝트로 이동: {stats['to_project']:,}개 ({stats['to_project']*100/stats['total']:.1f}%)")
    print(f"  -> 변경 없음:       {stats['no_change']:,}개 ({stats['no_change']*100/stats['total']:.1f}%)")
    print("=" * 100)
    
    # 샘플 출력
    if updates["to_null"]:
        print("\n[SAMPLE] NULL로 이동될 항목 (팀 내부 업무) - Top 15:")
        for wl_id, desc in updates["to_null"][:15]:
            print(f"  [{wl_id:6}] {desc[:90]}")
    
    if updates["to_project"]:
        print("\n[SAMPLE] 프로젝트로 이동될 항목 - Top 15:")
        for wl_id, proj_id, proj_name, keyword, desc in updates["to_project"][:15]:
            print(f"  [{wl_id:6}] {desc[:50]:50} -> {proj_name[:35]:35} (kw: {keyword})")
    
    # 실제 업데이트
    if not dry_run and (updates["to_null"] or updates["to_project"]):
        print("\n[UPDATE] Applying changes to database...")
        
        # NULL 업데이트 (배치 처리)
        if updates["to_null"]:
            ids = [wl_id for wl_id, _ in updates["to_null"]]
            # SQL injection 방지를 위해 직접 처리
            batch_size = 500
            for i in range(0, len(ids), batch_size):
                batch = ids[i:i+batch_size]
                ids_str = ",".join(batch)
                sql = f"""
                    UPDATE worklogs
                    SET project_id = NULL, updated_at = NOW()
                    WHERE id IN ({ids_str});
                """
                result = run_psql(sql)
                if result.returncode == 0:
                    print(f"  [OK] Batch {i//batch_size + 1}: {len(batch)} worklogs -> NULL")
                else:
                    print(f"  [ERROR] Batch {i//batch_size + 1} failed")
        
        # 프로젝트 업데이트 (배치 처리)
        if updates["to_project"]:
            # 프로젝트별로 그룹화
            proj_groups = {}
            for wl_id, proj_id, proj_name, keyword, desc in updates["to_project"]:
                if proj_id not in proj_groups:
                    proj_groups[proj_id] = []
                proj_groups[proj_id].append(wl_id)
            
            for proj_id, wl_ids in proj_groups.items():
                batch_size = 500
                for i in range(0, len(wl_ids), batch_size):
                    batch = wl_ids[i:i+batch_size]
                    ids_str = ",".join(batch)
                    sql = f"""
                        UPDATE worklogs
                        SET project_id = '{proj_id}', updated_at = NOW()
                        WHERE id IN ({ids_str});
                    """
                    result = run_psql(sql)
            
            print(f"  [OK] {len(updates['to_project'])} worklogs -> Projects")
        
        print("\n[SUCCESS] Update complete!")
        
        # 최종 확인
        check_sql = f"SELECT COUNT(*) FROM worklogs WHERE project_id = '{GENERAL_PROJECT_ID}';"
        result = run_psql(check_sql)
        remaining = result.stdout.strip()
        print(f"\n[INFO] Remaining in General/Non-Project: {remaining}")
    
    elif dry_run:
        print("\n[DRY-RUN] No changes made. Run without --dry-run to apply.")


def main():
    parser = argparse.ArgumentParser(description="키워드 기반 Worklog 분류")
    parser.add_argument("--dry-run", action="store_true", help="미리보기 모드")
    parser.add_argument("--limit", type=int, help="처리할 worklog 개수 제한")
    args = parser.parse_args()
    
    print("=" * 100)
    print("[Fast Classifier] General/Non-Project Worklog 키워드 기반 분류")
    print("=" * 100)
    print(f"Mode: {'DRY-RUN (미리보기)' if args.dry_run else '실제 업데이트'}")
    if args.limit:
        print(f"Limit: {args.limit} worklogs")
    print("=" * 100)
    
    # 프로젝트 로드
    print("\n[1/2] Loading projects...")
    projects = load_projects()
    print(f"      Loaded {len(projects)} projects")
    
    # 분류 실행
    print("\n[2/2] Classifying worklogs...")
    classify_worklogs(projects, dry_run=args.dry_run, limit=args.limit)


if __name__ == "__main__":
    main()
