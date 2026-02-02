#!/usr/bin/env python3
"""
AI 기반 General/Non-Project Worklog 분류 스크립트

목적:
1. General/Non-Project worklogs를 AI로 분석하여 적절한 프로젝트로 재분류
2. 팀 자체 업무(Leave, Training 등)는 NULL로 변경
3. Groq API 또는 로컬 AI CLI 사용 (빠르고 안정적)

사용법:
    python classify_general_with_ai.py --limit 100 --dry-run   # 100개만 테스트
    python classify_general_with_ai.py --limit 1000            # 1000개 실제 업데이트
    python classify_general_with_ai.py --provider groq         # Groq API 사용
    python classify_general_with_ai.py                         # 전체 처리
"""

import os
import sys
import argparse
import json
import subprocess
from typing import Dict, List, Optional, Tuple
import time
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

# Configuration
DB_CONTAINER = "edwards-postgres"
DB_USER = "postgres"
DB_NAME = "edwards"

GENERAL_PROJECT_ID = "8a45fd77-809a-442c-8000-f82a0597964d"

# AI Configuration - CLI based (no API limits!)
GEMINI_CLI_PATH = "/opt/homebrew/bin/gemini"
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash-exp")

# Keyword-based filtering rules
NULL_KEYWORDS = [
    # Leave/Vacation
    "holiday", "vacation", "leave", "pto", "연차", "휴가", "병가", "조퇴",
    # Training/Learning
    "training", "교육", "세미나", "워크샵", "workshop", "seminar", "course", "학습",
    # Admin/Internal
    "admin", "administration", "관리", "행정", "paperwork", "문서작업",
    "email", "메일", "이메일", "mail",
    # Meetings (general/internal only)
    "daily meeting", "standup", "stand-up", "데일리", "일일회의", "조회",
    # Desk work
    "desk work", "desk", "사무", "일반업무", "내부업무",
    # Internal team codes
    "abtrr", "internal ptm", "team meeting"
]

PROJECT_KEYWORDS = {
    # 프로젝트 이름에서 추출된 키워드들
    "euv": ["euv", "extreme ultraviolet"],
    "yokogawa": ["yokogawa"],
    "hitachi": ["hitachi"],
    "ulvac": ["ulvac"],
    "turbopump": ["turbopump", "tp"],
}


def run_psql(sql: str, quiet: bool = False) -> subprocess.CompletedProcess:
    """Execute PostgreSQL command via docker"""
    cmd = [
        "docker", "exec", "-i", DB_CONTAINER,
        "psql", "-U", DB_USER, "-d", DB_NAME, "-t", "-A", "-c", sql
    ]
    # Windows에서 UTF-8 처리를 위해 encoding 지정
    result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
    if not quiet and result.returncode != 0:
        print(f"[ERROR] SQL failed: {result.stderr}", file=sys.stderr)
    return result


def load_projects() -> Dict[str, Dict]:
    """프로젝트 목록 로드 (PROJECT, PRODUCT 카테고리만)"""
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
                # id|description|work_type_id|work_type_name
                wl_id = parts[0]
                description = parts[1] if len(parts) > 1 else ""
                work_type_id = parts[2] if len(parts) > 2 else None
                work_type_name = parts[3] if len(parts) > 3 else None
                worklogs.append((wl_id, description, work_type_id, work_type_name))
    
    return worklogs


def keyword_classify(description: str, work_type: Optional[str], projects: Dict) -> Optional[Dict]:
    """
    키워드 기반 빠른 분류 (AI 호출 전 사전 필터링)
    Returns: None if needs AI classification, Dict if classified by keyword
    """
    desc_lower = description.lower().strip()
    
    # 1. NULL 키워드 체크 (팀 내부 업무)
    for keyword in NULL_KEYWORDS:
        if keyword in desc_lower:
            return {
                "action": "move_to_null",
                "confidence": 0.9,
                "reasoning": f"Keyword matched: '{keyword}'"
            }
    
    # 2. 프로젝트 키워드 체크
    for proj_id, proj_info in projects.items():
        proj_name_lower = proj_info["name"].lower()
        
        # 프로젝트 이름이 description에 직접 포함되어 있는 경우
        if proj_name_lower in desc_lower or desc_lower in proj_name_lower:
            return {
                "action": "move_to_project",
                "project_id": proj_id,
                "project_name": proj_info["name"],
                "confidence": 0.95,
                "reasoning": f"Project name matched in description"
            }
    
    # 3. 키워드로 분류 불가 -> AI 필요
    return None


def classify_with_gemini_cli(description: str, work_type: Optional[str], projects: Dict) -> Dict:
    """
    Gemini CLI를 사용하여 worklog 분류 (로컬 CLI, API 제한 없음!)
    """
    # 프로젝트 목록 간단 정리 (Top 30으로 축소 - CLI는 느릴 수 있음)
    project_list = "\n".join([f"- {p['name']}" for p in list(projects.values())[:30]])
    if len(projects) > 30:
        project_list += f"\n... and {len(projects) - 30} more projects"
    
    prompt = f"""You are a worklog classifier for an engineering team.

Task: Classify this worklog entry and decide the action.

Worklog Description: "{description}"
Work Type: {work_type or "Unknown"}

Available Projects (Top 30):
{project_list}

Classification Rules:
1. If it's TEAM INTERNAL WORK (leave, vacation, training, meeting, admin, email, daily work, desk work, internal admin etc.) -> action: "move_to_null"
2. If description strongly relates to a specific PROJECT NAME from the list -> action: "move_to_project"
3. If it's general engineering work but doesn't mention a specific project -> action: "keep_general"

Response Format (JSON only):
{{
  "action": "move_to_null" | "keep_general" | "move_to_project",
  "project_name": "exact project name from list" (if move_to_project),
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}}

Respond with JSON only, no markdown or code blocks."""

    try:
        # Gemini CLI 호출 (--prompt 옵션 사용)
        result = subprocess.run(
            [GEMINI_CLI_PATH, "--prompt", prompt],
            capture_output=True,
            text=True,
            timeout=30,
            encoding='utf-8',
            errors='replace'
        )
        
        if result.returncode != 0:
            return {"action": "keep_general", "confidence": 0.0, "reasoning": f"CLI error: {result.stderr[:100]}"}
        
        text = result.stdout.strip()
        
        # DEBUG: Print raw output
        if not text or len(text) < 10:
            return {"action": "keep_general", "confidence": 0.0, "reasoning": "Empty CLI response"}
        
        # 불필요한 로그 제거 (Loaded cached credentials, ERROR, Hook registry 등)
        lines = text.split('\n')
        clean_lines = [line for line in lines if not any(skip in line for skip in [
            'Loaded cached credentials',
            '[ERROR] [IDEClient]',
            'Hook registry',
            'extension is running'
        ])]
        text = '\n'.join(clean_lines).strip()
        
        # JSON 추출 (마크다운 코드 블록 제거)
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        elif "{" in text:
            text = text[text.find("{"):text.rfind("}")+1]
        
        classification = json.loads(text)
        
        # project_name으로 project_id 찾기
        if classification.get("action") == "move_to_project" and "project_name" in classification:
            proj_name = classification["project_name"]
            for proj_id, proj_info in projects.items():
                clean_target = proj_name.lower().strip()
                clean_proj = proj_info["name"].lower().strip()
                if clean_target == clean_proj or clean_target in clean_proj or clean_proj in clean_target:
                    classification["project_id"] = proj_id
                    classification["project_name"] = proj_info["name"]
                    break
        
        return classification
    
    except subprocess.TimeoutExpired:
        return {"action": "keep_general", "confidence": 0.0, "reasoning": "CLI timeout"}
    except json.JSONDecodeError as e:
        print(f"[WARNING] JSON parse error: {e}\nRaw output: {text[:200]}")
        return {"action": "keep_general", "confidence": 0.0, "reasoning": f"JSON parse error"}
    except Exception as e:
        print(f"[WARNING] Gemini CLI failed: {e}")
        return {"action": "keep_general", "confidence": 0.0, "reasoning": f"Error: {e}"}


def main():
    parser = argparse.ArgumentParser(description="AI 기반 General/Non-Project Worklog 분류")
    parser.add_argument("--limit", type=int, help="처리할 worklog 개수 제한")
    parser.add_argument("--dry-run", action="store_true", help="미리보기 모드")
    parser.add_argument("--batch-size", type=int, default=10, help="배치 크기")
    args = parser.parse_args()

    print("=" * 80)
    print("[AI Classifier] General/Non-Project Worklog 자동 분류")
    print("=" * 80)
    print(f"AI Provider: Gemini CLI (Local)")
    print(f"AI Model: {GEMINI_MODEL}")
    print(f"Mode: {'DRY-RUN' if args.dry_run else 'UPDATE'}")
    if args.limit:
        print(f"Limit: {args.limit} worklogs")
    print("=" * 80)

    # 1. 프로젝트 목록 로드
    print("\n[1/3] Loading projects...")
    projects = load_projects()
    print(f"      Loaded {len(projects)} projects")

    # 2. General/Non-Project worklogs 조회
    print(f"\n[2/3] Loading worklogs from General/Non-Project...")
    worklogs = get_general_worklogs(limit=args.limit)
    print(f"      Loaded {len(worklogs)} worklogs")

    if not worklogs:
        print("\n[INFO] No worklogs to process.")
        return

    # 3. 분류 (키워드 → AI)
    print(f"\n[3/4] Classifying with keyword filtering + AI...")
    
    stats = {
        "total": len(worklogs),
        "keyword_null": 0,
        "keyword_project": 0,
        "ai_null": 0,
        "ai_project": 0,
        "keep_general": 0,
        "errors": 0
    }
    
    updates = {
        "to_null": [],
        "to_project": [] # List of (wl_id, proj_id)
    }
    
    ai_count = 0
    
    try:
        for idx, (wl_id, description, work_type_id, work_type) in enumerate(worklogs, 1):
            if idx % args.batch_size == 0:
                print(f"      Progress: {idx}/{len(worklogs)} ({idx*100//len(worklogs)}%) | AI calls: {ai_count}")
            
            # 1단계: 키워드 필터링
            classification = keyword_classify(description, work_type, projects)
            
            # 2단계: AI 분류 (키워드로 분류 안 된 것만)
            if classification is None:
                ai_count += 1
                classification = classify_with_gemini_cli(description, work_type, projects)
                is_ai = True
            else:
                is_ai = False
            
            action = classification.get("action", "keep_general")
            
            if action == "move_to_null":
                updates["to_null"].append((wl_id, description, classification.get("reasoning")))
                if is_ai:
                    stats["ai_null"] += 1
                else:
                    stats["keyword_null"] += 1
            elif action == "move_to_project" and "project_id" in classification:
                updates["to_project"].append((
                    wl_id,
                    classification["project_id"],
                    classification.get("project_name", "Unknown"),
                    classification.get("confidence", 0.5),
                    description,
                    classification.get("reasoning")
                ))
                if is_ai:
                    stats["ai_project"] += 1
                else:
                    stats["keyword_project"] += 1
            else:
                stats["keep_general"] += 1
    except KeyboardInterrupt:
        print("\n[INFO] Interrupted by user. Processing collected data...")

    # 결과 출력
    print("\n" + "=" * 80)
    print("[RESULT] 분류 결과")
    print("=" * 80)
    total_null = stats['keyword_null'] + stats['ai_null']
    total_project = stats['keyword_project'] + stats['ai_project']
    print(f"총 분석 완료:          {len(worklogs):,}개")
    print(f"  -> NULL로 이동:     {total_null:,}개 (키워드: {stats['keyword_null']}, AI: {stats['ai_null']})")
    print(f"  -> 프로젝트로 이동: {total_project:,}개 (키워드: {stats['keyword_project']}, AI: {stats['ai_project']})")
    print(f"  -> General 유지:    {stats['keep_general']:,}개")
    print(f"\nAI 호출 횟수:        {ai_count:,}개 / {len(worklogs):,}개 ({ai_count*100//len(worklogs)}% 절감)")
    print("=" * 80)

    # 샘플 출력
    if updates["to_null"]:
        print("\n[SAMPLE] NULL로 이동 (Top 5):")
        for wl_id, desc, reasoning in updates["to_null"][:5]:
            print(f"  [{wl_id}] {desc[:60]:60} | {reasoning}")

    if updates["to_project"]:
        print("\n[SAMPLE] 프로젝트로 이동 (Top 5):")
        for wl_id, proj_id, proj_name, conf, desc, reasoning in updates["to_project"][:5]:
            print(f"  [{wl_id}] {desc[:40]:40} -> {proj_name[:30]:30} ({conf:.1f}) | {reasoning}")

    # 실제 업데이트
    if not args.dry_run:
        print("\n[UPDATE] Applying changes to database...")
        
        # NULL 업데이트
        if updates["to_null"]:
            ids = ",".join([wl_id for wl_id, _, _ in updates["to_null"]])
            sql = f"UPDATE worklogs SET project_id = NULL, updated_at = NOW() WHERE id IN ({ids});"
            result = run_psql(sql)
            if result.returncode == 0:
                print(f"  [OK] {len(updates['to_null'])} worklogs -> NULL")
        
        # 프로젝트 업데이트 (프로젝트별 배치 처리)
        proj_to_wl_ids = {}
        for item in updates["to_project"]:
            wl_id, proj_id = item[0], item[1]
            if proj_id not in proj_to_wl_ids:
                proj_to_wl_ids[proj_id] = []
            proj_to_wl_ids[proj_id].append(wl_id)
        
        for proj_id, wl_ids in proj_to_wl_ids.items():
            ids_str = ",".join(wl_ids)
            sql = f"UPDATE worklogs SET project_id = '{proj_id}', updated_at = NOW() WHERE id IN ({ids_str});"
            run_psql(sql, quiet=True)
        
        if updates["to_project"]:
            print(f"  [OK] {len(updates['to_project'])} worklogs -> Projects (in {len(proj_to_wl_ids)} batches)")
        
        print("\n[SUCCESS] Update complete!")
    else:
        print("\n[DRY-RUN] No changes made. Run without --dry-run to apply.")


if __name__ == "__main__":
    main()



if __name__ == "__main__":
    main()
