#!/usr/bin/env python3
"""
AI 기반 General/Non-Project Worklog 분류 스크립트

목적:
1. General/Non-Project worklogs를 AI로 분석하여 적절한 프로젝트로 재분류
2. 팀 자체 업무(Leave, Training 등)는 NULL로 변경
3. Gemini 2.0 Flash API 사용 (빠르고 무료)

사용법:
    python classify_general_with_ai.py --limit 100 --dry-run   # 100개만 테스트
    python classify_general_with_ai.py --limit 1000            # 1000개 실제 업데이트
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

# AI Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyBr4pqyuH6u3nBdjfudsXPyEM_M5D1UhgQ")
GEMINI_MODEL = "gemini-2.0-flash-exp"


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


def classify_with_ai(description: str, work_type: Optional[str], projects: Dict) -> Dict:
    """
    AI를 사용하여 worklog 분류
    """
    import requests
    
    # 프로젝트 목록을 간단하게 정리 (전체 로드하도록 수정)
    project_list = "\n".join([f"- {p['name']}" for p in projects.values()])
    
    prompt = f"""You are a worklog classifier for an engineering team.

Task: Classify this worklog entry and decide the action.

Worklog Description: "{description}"
Work Type: {work_type or "Unknown"}

Available Projects:
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

Respond with JSON only, no markdown:"""

    try:
        response = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}",
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.1,
                    "maxOutputTokens": 200,
                }
            },
            timeout=15
        )
        
        if response.status_code == 200:
            result = response.json()
            text = result["candidates"][0]["content"]["parts"][0]["text"].strip()
            
            # JSON 추출 개선
            if "{" in text:
                text = text[text.find("{"):text.rfind("}")+1]
            
            classification = json.loads(text)
            
            # project_name으로 project_id 찾기
            if classification.get("action") == "move_to_project" and "project_name" in classification:
                proj_name = classification["project_name"]
                for proj_id, proj_info in projects.items():
                    # 대소문자 무시 및 부분 일치 (공백 제거 등)
                    clean_target = proj_name.lower().strip()
                    clean_proj = proj_info["name"].lower().strip()
                    if clean_target == clean_proj or clean_target in clean_proj or clean_proj in clean_target:
                        classification["project_id"] = proj_id
                        classification["project_name"] = proj_info["name"] # 정확한 이름으로 교체
                        break
            
            return classification
        else:
            print(f"[WARNING] AI API error: {response.status_code} - {response.text}")
            return {"action": "keep_general", "confidence": 0.0, "reasoning": f"API error: {response.status_code}"}
    
    except Exception as e:
        print(f"[WARNING] AI classification failed: {e}")
        return {"action": "keep_general", "confidence": 0.0, "reasoning": f"Error: {e}"}


def main():
    parser = argparse.ArgumentParser(description="AI 기반 General/Non-Project Worklog 분류")
    parser.add_argument("--limit", type=int, help="처리할 worklog 개수 제한")
    parser.add_argument("--dry-run", action="store_true", help="미리보기 모드")
    parser.add_argument("--batch-size", type=int, default=10, help="배치 크기 (API 호출 간격)")
    args = parser.parse_args()

    print("=" * 80)
    print("[AI Classifier] General/Non-Project Worklog 자동 분류")
    print("=" * 80)
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

    # 3. AI로 분류
    print(f"\n[3/3] Classifying with AI...")
    
    stats = {
        "total": len(worklogs),
        "move_to_null": 0,
        "move_to_project": 0,
        "keep_general": 0,
        "errors": 0
    }
    
    updates = {
        "to_null": [],
        "to_project": [] # List of (wl_id, proj_id)
    }
    
    try:
        for idx, (wl_id, description, work_type_id, work_type) in enumerate(worklogs, 1):
            if idx % args.batch_size == 0:
                print(f"      Progress: {idx}/{len(worklogs)} ({idx*100//len(worklogs)}%)")
                time.sleep(0.5)  # Flash is fast
            
            # AI 분류
            classification = classify_with_ai(description, work_type, projects)
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
        print("\n[INFO] Interrupted by user. Processing collected data...")

    # 결과 출력
    print("\n" + "=" * 80)
    print("[RESULT] 분류 결과")
    print("=" * 80)
    print(f"총 분석 완료:          {sum(stats.values()) - stats['total'] + len(worklogs):,}개")
    print(f"  -> NULL로 이동:     {stats['move_to_null']:,}개 (팀 내부 업무)")
    print(f"  -> 프로젝트로 이동: {stats['move_to_project']:,}개")
    print(f"  -> General 유지:    {stats['keep_general']:,}개")
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
