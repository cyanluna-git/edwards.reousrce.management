#!/usr/bin/env python3
"""
로직 기반 General/Non-Project Worklog 분류 스크립트 (AI 없이)

목적:
1. General/Non-Project worklogs를 키워드/규칙으로 빠르게 분류
2. 팀 자체 업무(Leave, Training 등)는 NULL로 변경
3. 프로젝트명이 명확한 것은 해당 프로젝트로 이동
4. AI 없이 순수 로직만 사용 -> 초고속 처리 (35K worklogs in ~1분)

사용법:
    python classify_general_logic_only.py --limit 1000 --dry-run   # 1000개 테스트
    python classify_general_logic_only.py --limit 10000            # 10000개 실제 업데이트  
    python classify_general_logic_only.py                          # 전체 처리
"""

import os
import sys
import argparse
import subprocess
from typing import Dict, List, Optional, Tuple
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
DB_CONTAINER = "edwards-postgres"
DB_USER = "postgres"
DB_NAME = "edwards"

GENERAL_PROJECT_ID = "8a45fd77-809a-442c-8000-f82a0597964d"

# NULL 키워드 (팀 내부 업무) - Phase 4 정밀판
NULL_KEYWORDS = [
    # Leave/Vacation/Health
    "holiday", "vacation", "leave", "pto", "연차", "휴가", "병가", "조퇴", "반차",
    "day off", "off day", "dayoff", "휴무", "summer vacation", "월차", "반휴", "오후 반휴",
    "건강검진", "health check", "건강 검진", "입원", "공가", "출장",
    # Training/Learning
    "training", "교육", "세미나", "워크샵", "workshop", "seminar", "course", "학습",
    "engineering seminar", "교육 계획", "외부 교육", "사내 교육", "learning link",
    "supporting new workers", "신입 교육",
    # Admin/Internal
    "admin", "administration", "관리", "행정", "paperwork", "문서작업",
    "email", "메일", "이메일", "mail", "메일 확인", "업무 정리", "업무 준비",
    "일정 정리", "주간업무 보고", "주간 보고", "weekly report update",
    "concur", "time attendant", "resource review", "자재 정리", "물품 정리",
    "ogsm", "감리", "e-req creation", "bom 검토",
    "general 업무", "monthly report", "weekly report 작성",
    "manual work", "현장 정리", "test arrange",
    # Meetings (general/internal)
    "daily meeting", "standup", "stand-up", "stand up", "데일리", "일일회의", "조회",
    "team meeting", "weekly meeting", "주간회의", "weekly team meeting", "팀미팅",
    "department meeting", "부서회의", "전체회의", "all hands",
    "1 to 1", "1to1", "1:1", "one to one",
    "team leader meeting", "leader meeting", "리더 미팅",
    "townhall", "town hall",
    "coe weekly", "coe innovation", "coe monthly",
    "elec abt weekly", "abt weekly",
    "v&v meeting", "mentoring time",
    "monthly meeting", "cost saving meeting", "resource 미팅", "torch meeting",
    "신년회", "송년회", "회식", "company event", "문화행사", "체육대회", "운동회",
    "opening ceremony", "주차 통제",
    # Internal codes
    "abtrr", "internal ptm", "pcas weekly", "weekly ptm",
    "abt elec weekly", "sw weekly", "eto mech weekly",
    "culture designer", "consolidation",
    # Desk work
    "desk work", "desk", "사무", "일반업무", "내부업무", "자리정리",
    # Events/Activities
    "ai expo", "참관", "견학", "clean up day", "정리의 날",
    # Inspections (general lab maintenance)
    "daily inspection", "연구동 점검", "연구동 daily 점검", "분석기 점검",
]

# Work Type 기반 NULL 분류 (팀 내부 업무) - 확장
NULL_WORK_TYPES = [
    "Training",
    "Team Management",
    "General Admin",
    "Email & Communication",
    "Meeting & Collaboration",  # 프로젝트 명시 없으면 전부 NULL
]

# 프로젝트 키워드 매핑 (Phase 4 확장판)
PROJECT_KEYWORDS = {
    # EUV 관련
    "euv": ["euv ", " euv", "extreme ultraviolet"],
    "halo": ["halo"],
    "vizeon": ["vizeon"],
    
    # 세대/모델
    "gen2": ["gen2", "gen 2"],
    "gen4": ["gen4", "gen 4"],
    
    # 시스템/제품 (확장)
    "catox": ["catox"],
    "degasser": ["degasser"],
    "turbopump": ["turbopump", "turbo pump"],
    "bmm": ["bmm", "bmm4"],
    "pfa": ["pfa"],
    "omt": ["omt"],
    "7src": ["7src"],
    "pscl": ["pscl"],
    "fssop": ["fssop"],
    "gdas": ["gdas"],
    "hmi": ["hmi "],
    "dcs": ["dcs"],
    
    # 고객사/파트너 (확장)
    "tsmc": ["tsmc"],
    "asml": ["asml"],
    "yokogawa": ["yokogawa"],
    "hitachi": ["hitachi"],
    "ulvac": ["ulvac"],
    "micron": ["micron"],
    "intel": ["intel"],
    "ibm": ["ibm"],
    "samsung": ["삼성", "samsung"],
    "taylor": ["taylor"],
    "clk": ["clk"],
    "ls": [" ls ", "ls "],
    
    # 기타 프로젝트
    "hydrogen": ["hydrogen", "수소"],
    "nrtl": ["nrtl"],
}


def run_psql(sql: str, quiet: bool = False) -> subprocess.CompletedProcess:
    """Execute PostgreSQL command via docker"""
    cmd = [
        "docker", "exec", "-i", DB_CONTAINER,
        "psql", "-U", DB_USER, "-d", DB_NAME, "-t", "-A", "-c", sql
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
    if not quiet and result.returncode != 0:
        print(f"[ERROR] SQL failed: {result.stderr}", file=sys.stderr)
    return result


def load_projects() -> Dict[str, Dict]:
    """프로젝트 목록 로드"""
    sql = """
        SELECT id, name, category
        FROM projects
        WHERE category IN ('PROJECT', 'PRODUCT')
        AND status != 'Closed'
        ORDER BY name;
    """
    result = run_psql(sql)
    if result.returncode != 0:
        return {}
    
    projects = {}
    for line in result.stdout.strip().split('\n'):
        if line:
            parts = line.split('|')
            if len(parts) >= 2:
                proj_id, name = parts[0], parts[1]
                category = parts[2] if len(parts) > 2 else "UNKNOWN"
                projects[proj_id] = {"name": name, "category": category}
    
    return projects


def get_general_worklogs(limit: Optional[int] = None) -> List[Tuple]:
    """General/Non-Project worklogs 조회"""
    limit_clause = f"LIMIT {limit}" if limit else ""
    
    sql = f"""
        SELECT w.id, w.description, w.work_type_category_id, wt.name as work_type
        FROM worklogs w
        LEFT JOIN work_type_categories wt ON w.work_type_category_id = wt.id
        WHERE w.project_id = '{GENERAL_PROJECT_ID}'
        AND w.description IS NOT NULL
        AND LENGTH(w.description) > 3
        ORDER BY w.date DESC
        {limit_clause};
    """
    
    result = run_psql(sql)
    if result.returncode != 0:
        return []
    
    worklogs = []
    for line in result.stdout.strip().split('\n'):
        if line:
            parts = line.split('|')
            if len(parts) >= 2:
                wl_id = parts[0]
                description = parts[1] if len(parts) > 1 else ""
                work_type_id = parts[2] if len(parts) > 2 else None
                work_type_name = parts[3] if len(parts) > 3 else None
                worklogs.append((wl_id, description, work_type_id, work_type_name))
    
    return worklogs


def classify_by_rules(description: str, work_type: Optional[str], projects: Dict) -> Optional[Dict]:
    """
    순수 규칙 기반 분류 (AI 없음) - 확장판
    """
    desc_lower = description.lower().strip()
    
    # 1. NULL 키워드 체크 (팀 내부 업무)
    for keyword in NULL_KEYWORDS:
        if keyword.lower() in desc_lower:
            return {
                "action": "move_to_null",
                "confidence": 1.0,
                "reasoning": f"Keyword: '{keyword}'"
            }
    
    # 2. Work Type 기반 NULL 분류
    if work_type and work_type in NULL_WORK_TYPES:
        return {
            "action": "move_to_null",
            "confidence": 0.9,
            "reasoning": f"Work Type: '{work_type}'"
        }
    
    # 3. 프로젝트 키워드 매칭 (확장)
    for keyword_group, keywords in PROJECT_KEYWORDS.items():
        for keyword in keywords:
            if keyword.lower() in desc_lower:
                # 해당 키워드와 관련된 프로젝트 찾기
                matching_projects = []
                for proj_id, proj_info in projects.items():
                    proj_name_lower = proj_info["name"].lower()
                    # 키워드가 프로젝트 이름에 포함되거나 관련성 있는 경우
                    if (keyword_group in proj_name_lower or 
                        keyword.strip().lower() in proj_name_lower):
                        matching_projects.append((proj_id, proj_info))
                
                if matching_projects:
                    # "General"이 포함된 프로젝트 우선
                    general_projects = [p for p in matching_projects if "general" in p[1]["name"].lower()]
                    if general_projects:
                        proj_id, proj_info = general_projects[0]
                    else:
                        # 가장 구체적인 프로젝트 선택 (이름이 짧은 것)
                        matching_projects.sort(key=lambda x: len(x[1]["name"]))
                        proj_id, proj_info = matching_projects[0]
                    
                    return {
                        "action": "move_to_project",
                        "project_id": proj_id,
                        "project_name": proj_info["name"],
                        "confidence": 0.85,
                        "reasoning": f"Keyword: '{keyword}' -> {proj_info['name']}"
                    }
    
    # 4. 프로젝트 이름 직접 매칭
    for proj_id, proj_info in projects.items():
        proj_name_lower = proj_info["name"].lower()
        
        # 프로젝트 이름이 description에 직접 포함 (5자 이상만)
        if len(proj_name_lower) > 5:
            if proj_name_lower in desc_lower or desc_lower in proj_name_lower:
                return {
                    "action": "move_to_project",
                    "project_id": proj_id,
                    "project_name": proj_info["name"],
                    "confidence": 0.95,
                    "reasoning": f"Project name match"
                }
    
    # 5. 분류 불가 -> General 유지
    return {
        "action": "keep_general",
        "confidence": 0.5,
        "reasoning": "No match"
    }


def main():
    parser = argparse.ArgumentParser(description="로직 기반 Worklog 분류 (AI 없음)")
    parser.add_argument("--limit", type=int, help="처리할 worklog 개수 제한")
    parser.add_argument("--dry-run", action="store_true", help="미리보기 모드")
    parser.add_argument("--batch-size", type=int, default=5000, help="진행상황 표시 간격")
    args = parser.parse_args()

    print("=" * 80)
    print("[Logic Classifier] Phase 4 정밀 분류")
    print("=" * 80)
    print("전략: 놓친 키워드 추가 + 프로젝트 매핑 강화")
    print("=" * 80)
    print(f"Mode: {'DRY-RUN' if args.dry_run else 'UPDATE'}")
    if args.limit:
        print(f"Limit: {args.limit:,} worklogs")
    print("=" * 80)

    # 1. 프로젝트 목록 로드
    print("\n[1/3] Loading projects...")
    projects = load_projects()
    print(f"      Loaded {len(projects)} projects")

    # 2. Worklogs 조회
    print(f"\n[2/3] Loading worklogs...")
    worklogs = get_general_worklogs(limit=args.limit)
    print(f"      Loaded {len(worklogs):,} worklogs")

    if not worklogs:
        print("\n[INFO] No worklogs to process.")
        return

    # 3. 분류
    print(f"\n[3/3] Classifying...")
    
    stats = {
        "total": len(worklogs),
        "move_to_null": 0,
        "move_to_project": 0,
        "keep_general": 0
    }
    
    updates = {
        "to_null": [],
        "to_project": []
    }
    
    try:
        for idx, (wl_id, description, work_type_id, work_type) in enumerate(worklogs, 1):
            if idx % args.batch_size == 0:
                print(f"      Progress: {idx:,}/{len(worklogs):,} ({idx*100//len(worklogs)}%)")
            
            classification = classify_by_rules(description, work_type, projects)
            action = classification.get("action", "keep_general")
            
            if action == "move_to_null":
                updates["to_null"].append((wl_id, description, classification.get("reasoning")))
                stats["move_to_null"] += 1
            elif action == "move_to_project" and "project_id" in classification:
                updates["to_project"].append((
                    wl_id,
                    classification["project_id"],
                    classification.get("project_name", "Unknown"),
                    classification.get("confidence", 0.5),
                    description,
                    classification.get("reasoning")
                ))
                stats["move_to_project"] += 1
            else:
                stats["keep_general"] += 1
    except KeyboardInterrupt:
        print("\n[INFO] Interrupted by user.")

    # 결과 출력
    print("\n" + "=" * 80)
    print("[RESULT] 분류 결과")
    print("=" * 80)
    print(f"총 분석 완료:          {len(worklogs):,}개")
    print(f"  -> NULL로 이동:     {stats['move_to_null']:,}개 (팀 내부 업무)")
    print(f"  -> 프로젝트로 이동: {stats['move_to_project']:,}개")
    print(f"  -> General 유지:    {stats['keep_general']:,}개")
    print("=" * 80)

    # 샘플 출력
    if updates["to_null"]:
        print("\n[SAMPLE] NULL로 이동 (Top 10):")
        for wl_id, desc, reasoning in updates["to_null"][:10]:
            print(f"  [{wl_id}] {desc[:60]:60} | {reasoning}")

    if updates["to_project"]:
        print("\n[SAMPLE] 프로젝트로 이동 (Top 10):")
        for wl_id, proj_id, proj_name, conf, desc, reasoning in updates["to_project"][:10]:
            print(f"  [{wl_id}] {desc[:40]:40} -> {proj_name[:30]:30}")

    # 실제 업데이트
    if not args.dry_run:
        print("\n[UPDATE] Applying changes...")
        
        # NULL 업데이트
        if updates["to_null"]:
            # Batch by 1000
            batch_size = 1000
            for i in range(0, len(updates["to_null"]), batch_size):
                batch = updates["to_null"][i:i+batch_size]
                ids = ",".join([f"'{wl_id}'" for wl_id, _, _ in batch])
                sql = f"UPDATE worklogs SET project_id = NULL, updated_at = NOW() WHERE id IN ({ids});"
                run_psql(sql, quiet=True)
            print(f"  [OK] {len(updates['to_null']):,} worklogs -> NULL")
        
        # 프로젝트 업데이트
        if updates["to_project"]:
            proj_to_wl_ids = {}
            for wl_id, proj_id, _, _, _, _ in updates["to_project"]:
                if proj_id not in proj_to_wl_ids:
                    proj_to_wl_ids[proj_id] = []
                proj_to_wl_ids[proj_id].append(wl_id)
            
            for proj_id, wl_ids in proj_to_wl_ids.items():
                # Batch by 1000
                batch_size = 1000
                for i in range(0, len(wl_ids), batch_size):
                    batch = wl_ids[i:i+batch_size]
                    ids_str = ",".join([f"'{wl_id}'" for wl_id in batch])
                    sql = f"UPDATE worklogs SET project_id = '{proj_id}', updated_at = NOW() WHERE id IN ({ids_str});"
                    run_psql(sql, quiet=True)
            
            print(f"  [OK] {len(updates['to_project']):,} worklogs -> Projects")
        
        print("\n[SUCCESS] Update complete!")
    else:
        print("\n[DRY-RUN] No changes made. Run without --dry-run to apply.")


if __name__ == "__main__":
    main()
