#!/usr/bin/env python3
"""
General/Non-Project Worklog 자동 분류 스크립트

목적:
1. General/Non-Project의 worklogs 중 프로젝트 추론 가능한 것들을 해당 프로젝트로 재분류
2. 팀 자체 업무(Leave, Training, Meeting 등)는 project_id를 NULL로 유지

사용법:
    python classify_general_worklogs.py --dry-run  # 미리보기 (실제 업데이트 안함)
    python classify_general_worklogs.py           # 실제 업데이트
"""

import os
import sys
import argparse
from datetime import datetime
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from typing import Dict, List, Tuple, Optional
import re

# Environment variables
DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://postgres:password@localhost:5434/edwards"
)

# General/Non-Project 프로젝트 ID
GENERAL_PROJECT_ID = "8a45fd77-809a-442c-8000-f82a0597964d"

# 팀 자체 업무로 판단할 work_type_category_id 목록
TEAM_INTERNAL_WORK_TYPES = {
    38,  # Leave
    29,  # Training
    30,  # Self-Study
    36,  # General Admin
    18,  # Team Management
    35,  # Email & Communication
    73,  # Internal Meeting
    79,  # Periodic Updates
}

# 팀 자체 업무로 판단할 description 키워드 (대소문자 무시)
TEAM_INTERNAL_KEYWORDS = [
    "연차", "휴가", "holiday", "leave", "vacation",
    "조퇴", "지각", "결근",
    "메일", "email", "e-mail",
    "업무 정리", "업무 준비",
    "weekly", "meeting",
    "seminar", "세미나",
    "training", "교육",
    "self-study", "self study", "자기계발",
    "admin", "행정",
]


class WorklogClassifier:
    """Worklog 분류기"""

    def __init__(self, db_url: str):
        self.engine = create_engine(db_url)
        self.Session = sessionmaker(bind=self.engine)
        self.projects: List[Dict] = []
        self.project_keywords: Dict[str, List[str]] = {}

    def load_projects(self):
        """프로젝트 목록 및 키워드 매핑 로드"""
        with self.Session() as session:
            result = session.execute(
                text("""
                    SELECT id, name, category
                    FROM projects
                    WHERE category IN ('PROJECT', 'PRODUCT')
                    ORDER BY name
                """)
            )
            self.projects = [
                {"id": row[0], "name": row[1], "category": row[2]}
                for row in result
            ]

        print(f"✓ {len(self.projects)}개 프로젝트 로드 완료")

        # 프로젝트별 키워드 추출 (프로젝트 이름에서)
        for proj in self.projects:
            name = proj["name"]
            # 공백, 하이픈, 언더스코어로 단어 분리
            words = re.split(r"[\s\-_]+", name.lower())
            # 2글자 이상 단어만 키워드로 사용
            keywords = [w for w in words if len(w) >= 2]
            self.project_keywords[proj["id"]] = keywords

    def is_team_internal_work(
        self, work_type_id: Optional[int], description: Optional[str]
    ) -> bool:
        """팀 자체 업무 여부 판단"""
        # work_type으로 판단
        if work_type_id in TEAM_INTERNAL_WORK_TYPES:
            return True

        # description 키워드로 판단
        if description:
            desc_lower = description.lower()
            for keyword in TEAM_INTERNAL_KEYWORDS:
                if keyword in desc_lower:
                    return True

        return False

    def infer_project(self, description: Optional[str]) -> Optional[Tuple[str, str, float]]:
        """
        Description에서 프로젝트 추론
        
        Returns:
            Tuple[project_id, project_name, confidence] or None
        """
        if not description:
            return None

        desc_lower = description.lower()
        matches = []

        for proj in self.projects:
            confidence = 0.0
            matched_keywords = []

            # 프로젝트 이름 전체가 포함되어 있으면 높은 점수
            if proj["name"].lower() in desc_lower:
                confidence = 1.0
                matched_keywords.append(proj["name"])
            else:
                # 키워드 매칭
                keywords = self.project_keywords[proj["id"]]
                for keyword in keywords:
                    if keyword in desc_lower:
                        confidence += 0.3
                        matched_keywords.append(keyword)

            if confidence > 0:
                matches.append(
                    {
                        "id": proj["id"],
                        "name": proj["name"],
                        "confidence": min(confidence, 1.0),
                        "keywords": matched_keywords,
                    }
                )

        if not matches:
            return None

        # 가장 높은 confidence를 가진 프로젝트 선택
        best_match = max(matches, key=lambda x: x["confidence"])

        # confidence가 0.3 이상일 때만 반환
        if best_match["confidence"] >= 0.3:
            return (best_match["id"], best_match["name"], best_match["confidence"])

        return None

    def classify_worklogs(self, dry_run: bool = True) -> Dict:
        """
        General/Non-Project worklogs 분류
        
        Returns:
            분류 통계
        """
        stats = {
            "total": 0,
            "team_internal": 0,  # NULL로 변경
            "project_inferred": 0,  # 프로젝트로 이동
            "no_change": 0,  # 그대로 유지
        }

        updates = {
            "to_null": [],  # (worklog_id, description)
            "to_project": [],  # (worklog_id, project_id, project_name, confidence, description)
        }

        with self.Session() as session:
            # General/Non-Project worklogs 조회
            result = session.execute(
                text("""
                    SELECT id, work_type_category_id, description
                    FROM worklogs
                    WHERE project_id = :general_project_id
                    ORDER BY date DESC
                """),
                {"general_project_id": GENERAL_PROJECT_ID},
            )

            worklogs = list(result)
            stats["total"] = len(worklogs)

            print(f"\n[ANALYZING] {stats['total']:,}개 worklog 분석 중...")

            for row in worklogs:
                wl_id, work_type_id, description = row

                # 1. 팀 자체 업무 → NULL로
                if self.is_team_internal_work(work_type_id, description):
                    updates["to_null"].append((wl_id, description))
                    stats["team_internal"] += 1
                    continue

                # 2. 프로젝트 추론
                inferred = self.infer_project(description)
                if inferred:
                    proj_id, proj_name, confidence = inferred
                    updates["to_project"].append(
                        (wl_id, proj_id, proj_name, confidence, description)
                    )
                    stats["project_inferred"] += 1
                    continue

                # 3. 변경 없음
                stats["no_change"] += 1

        # 결과 출력
        print("\n" + "=" * 80)
        print("[RESULT] 분류 결과")
        print("=" * 80)
        print(f"총 worklogs:                {stats['total']:,}개")
        print(f"  -> NULL로 변경 (팀 업무):  {stats['team_internal']:,}개")
        print(f"  -> 프로젝트로 이동:        {stats['project_inferred']:,}개")
        print(f"  -> 변경 없음:              {stats['no_change']:,}개")
        print("=" * 80)

        # 샘플 출력
        if updates["to_null"]:
            print("\n[SAMPLE] NULL로 변경될 샘플 (팀 자체 업무):")
            for wl_id, desc in updates["to_null"][:10]:
                print(f"  [{wl_id}] {desc or '(no description)'}")

        if updates["to_project"]:
            print("\n[SAMPLE] 프로젝트로 이동될 샘플:")
            for wl_id, proj_id, proj_name, conf, desc in updates["to_project"][:10]:
                desc_preview = (desc[:50] if desc else "")
                print(
                    f"  [{wl_id}] {desc_preview:50} -> {proj_name} (confidence: {conf:.1f})"
                )

        # 실제 업데이트
        if not dry_run:
            print("\n[UPDATE] 데이터베이스 업데이트 중...")
            self._apply_updates(updates)
            print("[SUCCESS] 업데이트 완료!")
        else:
            print("\n[WARNING] DRY-RUN 모드: 실제 업데이트는 하지 않았습니다.")
            print("          실제 업데이트하려면: python classify_general_worklogs.py")

        return stats

    def _apply_updates(self, updates: Dict):
        """실제 DB 업데이트 수행"""
        with self.Session() as session:
            # 1. 팀 업무 → NULL
            if updates["to_null"]:
                worklog_ids = [wl_id for wl_id, _ in updates["to_null"]]
                session.execute(
                    text("""
                        UPDATE worklogs
                        SET project_id = NULL, updated_at = NOW()
                        WHERE id = ANY(:ids)
                    """),
                    {"ids": worklog_ids},
                )
                print(f"  ✓ {len(worklog_ids):,}개 worklog → NULL")

            # 2. 프로젝트로 이동
            if updates["to_project"]:
                for wl_id, proj_id, proj_name, conf, desc in updates["to_project"]:
                    session.execute(
                        text("""
                            UPDATE worklogs
                            SET project_id = :project_id, updated_at = NOW()
                            WHERE id = :id
                        """),
                        {"id": wl_id, "project_id": proj_id},
                    )
                print(f"  ✓ {len(updates['to_project']):,}개 worklog → 프로젝트")

            session.commit()


def main():
    parser = argparse.ArgumentParser(
        description="General/Non-Project Worklog 자동 분류"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="미리보기 모드 (실제 업데이트 안함)",
    )
    parser.add_argument(
        "--db-url",
        default=DATABASE_URL,
        help="Database URL (기본값: 환경변수 DATABASE_URL)",
    )
    args = parser.parse_args()

    print("=" * 80)
    print("[AI Classifier] General/Non-Project Worklog 자동 분류")
    print("=" * 80)
    print(f"Database: {args.db_url.split('@')[-1]}")
    print(f"Mode: {'DRY-RUN (미리보기)' if args.dry_run else '실제 업데이트'}")
    print("=" * 80)

    try:
        classifier = WorklogClassifier(args.db_url)
        classifier.load_projects()
        stats = classifier.classify_worklogs(dry_run=args.dry_run)

    except Exception as e:
        print(f"\n❌ 에러 발생: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
