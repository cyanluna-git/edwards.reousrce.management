import sys
import os

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.core.database import get_session_local
from app.models.resource import WorkLog
from app.models.work_type import WorkTypeCategory


def migrate_meeting_types():
    SessionLocal = get_session_local()
    db = SessionLocal()

    try:
        # 1. Load Meeting Categories
        # Parent code: PRJ-MTG
        prj_mtg = db.query(WorkTypeCategory).filter_by(code="PRJ-MTG").first()
        if not prj_mtg:
            print("Error: PRJ-MTG category not found.")
            return

        # Fetch L3s
        l3_cats = db.query(WorkTypeCategory).filter_by(parent_id=prj_mtg.id).all()
        cat_map = {c.code: c for c in l3_cats}

        # Mapping rules (Keyword -> Category Code)
        # Order matters: more specific first
        rules = [
            # Decision Making
            (
                [
                    "decision",
                    "decid",
                    "option",
                    "select",
                    "choose",
                    "의사",
                    "결정",
                    "선택",
                    "선정",
                ],
                "PRJ-MTG-DEC",
            ),
            # Problem Solving
            (
                [
                    "problem",
                    "solve",
                    "solv",
                    "issue",
                    "trouble",
                    "obstacle",
                    "해결",
                    "장애",
                    "이슈",
                ],
                "PRJ-MTG-PRB",
            ),
            # Feedback
            (
                [
                    "feedback",
                    "retro",
                    "lesson",
                    "learned",
                    "review",
                    "eval",
                    "피드백",
                    "회고",
                    "평가",
                    "리뷰",
                ],
                "PRJ-MTG-FDB",
            ),
            # Information Sharing
            (
                [
                    "info",
                    "share",
                    "announce",
                    "notice",
                    "kickoff",
                    "intro",
                    "공유",
                    "공지",
                    "소개",
                    "킥오프",
                ],
                "PRJ-MTG-INF",
            ),
            # Periodic Updates (Default for syncs)
            (
                [
                    "update",
                    "sync",
                    "daily",
                    "weekly",
                    "monthly",
                    "scrum",
                    "standup",
                    "report",
                    "check",
                    "status",
                    "점검",
                    "주간",
                    "월간",
                    "현황",
                ],
                "PRJ-MTG-UPD",
            ),
        ]

        # 2. Fetch Worklogs
        # Target: Items that are currently PRJ-MTG or its children (re-classify)
        # Get all children IDs of PRJ-MTG including itself
        target_ids = [prj_mtg.id] + [c.id for c in l3_cats]

        worklogs = (
            db.query(WorkLog)
            .filter(WorkLog.work_type_category_id.in_(target_ids))
            .all()
        )
        print(f"Analyzing {len(worklogs)} meeting worklogs...")

        updates = []

        for log in worklogs:
            desc = (log.description or "").lower()
            current_cat_id = log.work_type_category_id
            new_cat = None

            # Apply rules
            for keywords, code in rules:
                if any(k in desc for k in keywords):
                    new_cat = cat_map.get(code)
                    break

            # If no specific match found, but it's a generic "Meeting", default to Periodic Updates or create a "General" bucket?
            # User requested "Periodic Updates" covers general syncs.
            # If generic string like "meeting" or "미팅", map to PRJ-MTG-UPD (most common) or PRJ-MTG-INF?
            if not new_cat:
                if any(k in desc for k in ["meeting", "meet", "미팅", "회의"]):
                    new_cat = cat_map.get(
                        "PRJ-MTG-UPD"
                    )  # Assume generic is update/sync

            if new_cat and new_cat.id != current_cat_id:
                # print(f"  {desc[:30]}... -> {new_cat.name}")
                log.work_type_category_id = new_cat.id
                updates.append((log.id, new_cat.code, desc[:40]))

        print(f"Found {len(updates)} updates.")

        if updates:
            print("\nSample updates:")
            for i in range(min(10, len(updates))):
                uid, code, d = updates[i]
                print(f"  ID {uid}: -> {code} ({d}...)")

            confirm = input(f"\nApply {len(updates)} updates? (y/n): ")
            if confirm.lower() == "y":
                db.commit()
                print("✅ Updates applied.")
            else:
                db.rollback()
                print("Cancelled.")
        else:
            print("No matching updates found.")

    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    migrate_meeting_types()
