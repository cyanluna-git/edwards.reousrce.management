"""
Migration script to move Meeting/Collaboration (미팅/협업) from L2 under PRJ to top-level L1.

Before:
  PRJ (L1) - 프로젝트 실행
    └─ PRJ-MTG (L2) - 미팅/협업
         ├─ PRJ-MTG-INT (L3) - 내부 회의
         ├─ PRJ-MTG-EXT (L3) - 고객/외부 미팅
         ├─ PRJ-MTG-REP (L3) - 보고
         ├─ PRJ-MTG-INF (L3) - 정보 공유
         ├─ PRJ-MTG-DEC (L3) - 의사 결정
         ├─ PRJ-MTG-PRB (L3) - 문제 해결
         ├─ PRJ-MTG-UPD (L3) - 정기 점검
         └─ PRJ-MTG-FDB (L3) - 피드백

After:
  MTG (L1) - 미팅/협업
    ├─ MTG-INT (L2) - 내부 회의
    ├─ MTG-EXT (L2) - 고객/외부 미팅
    ├─ MTG-REP (L2) - 보고
    ├─ MTG-INF (L2) - 정보 공유
    ├─ MTG-DEC (L2) - 의사 결정
    ├─ MTG-PRB (L2) - 문제 해결
    ├─ MTG-UPD (L2) - 정기 점검
    └─ MTG-FDB (L2) - 피드백
"""

from sqlalchemy.orm import Session
from sqlalchemy import text


def migrate_mtg_to_l1(db: Session):
    """Migrate Meeting/Collaboration from L2 to L1"""

    print("=" * 60)
    print("Starting Migration: MTG to L1")
    print("=" * 60)

    # Code mapping: old -> new
    CODE_MAPPING = {
        "PRJ-MTG": "MTG",
        "PRJ-MTG-INT": "MTG-INT",
        "PRJ-MTG-EXT": "MTG-EXT",
        "PRJ-MTG-REP": "MTG-REP",
        "PRJ-MTG-INF": "MTG-INF",
        "PRJ-MTG-DEC": "MTG-DEC",
        "PRJ-MTG-PRB": "MTG-PRB",
        "PRJ-MTG-UPD": "MTG-UPD",
        "PRJ-MTG-FDB": "MTG-FDB",
    }

    # Step 1: Get current PRJ-MTG category
    result = db.execute(
        text("SELECT id, code, name, name_ko, parent_id FROM work_type_categories WHERE code = 'PRJ-MTG'")
    ).fetchone()

    if not result:
        print("ERROR: PRJ-MTG category not found. Migration may have already been applied.")
        return False

    prj_mtg_id = result[0]
    print(f"Found PRJ-MTG (id={prj_mtg_id})")

    # Step 2: Get all L3 categories under PRJ-MTG
    l3_categories = db.execute(
        text("SELECT id, code, name, name_ko FROM work_type_categories WHERE parent_id = :parent_id"),
        {"parent_id": prj_mtg_id}
    ).fetchall()

    print(f"Found {len(l3_categories)} L3 categories under PRJ-MTG")
    for cat in l3_categories:
        print(f"  - {cat[1]}: {cat[3]}")

    # Step 3: Get the sort_order for new L1 (insert after PRJ which is sort_order=2)
    # We'll use sort_order=2.5 temporarily, then reorder

    # Step 4: Update PRJ-MTG to become MTG (L1)
    print("\nUpdating PRJ-MTG -> MTG (L1)...")
    db.execute(
        text("""
            UPDATE work_type_categories
            SET code = 'MTG',
                level = 1,
                parent_id = NULL,
                sort_order = 2,
                description = '미팅, 회의, 협업 활동'
            WHERE id = :id
        """),
        {"id": prj_mtg_id}
    )

    # Step 5: Update sort_order for other L1 categories (shift by 1 for those >= 2)
    print("Adjusting sort_order for other L1 categories...")
    db.execute(
        text("""
            UPDATE work_type_categories
            SET sort_order = sort_order + 1
            WHERE level = 1 AND code != 'MTG' AND sort_order >= 2
        """)
    )

    # Step 6: Update all L3 categories to become L2
    print("\nUpdating L3 categories to L2...")
    for cat in l3_categories:
        old_code = cat[1]
        new_code = CODE_MAPPING.get(old_code, old_code)

        db.execute(
            text("""
                UPDATE work_type_categories
                SET code = :new_code,
                    level = 2
                WHERE id = :id
            """),
            {"new_code": new_code, "id": cat[0]}
        )
        print(f"  {old_code} -> {new_code}")

    # Step 7: Worklogs use work_type_category_id (FK to category ID)
    # Since we're updating categories in place (same ID, just changing code/level),
    # worklogs will automatically reference the correct updated categories.
    print("\nWorklogs use FK reference - no update needed (category IDs preserved)")

    # Step 8: Update legacy mapping
    print("\nUpdating legacy mapping for 'Meeting'...")
    db.execute(
        text("""
            UPDATE work_type_legacy_mappings
            SET category_id = :mtg_id
            WHERE legacy_work_type = 'Meeting'
        """),
        {"mtg_id": prj_mtg_id}
    )

    db.commit()

    print("\n" + "=" * 60)
    print("Migration completed successfully!")
    print("=" * 60)

    # Verify
    print("\nVerification - New MTG hierarchy:")
    mtg = db.execute(
        text("SELECT id, code, name_ko, level, parent_id, sort_order FROM work_type_categories WHERE code = 'MTG'")
    ).fetchone()
    print(f"  MTG (L{mtg[3]}): {mtg[2]} (sort_order={mtg[5]})")

    l2_cats = db.execute(
        text("SELECT code, name_ko, level FROM work_type_categories WHERE parent_id = :parent_id ORDER BY sort_order"),
        {"parent_id": mtg[0]}
    ).fetchall()
    for cat in l2_cats:
        print(f"    └─ {cat[0]} (L{cat[2]}): {cat[1]}")

    return True


def rollback_mtg_migration(db: Session):
    """Rollback the migration (in case something goes wrong)"""

    print("Rolling back MTG migration...")

    CODE_MAPPING_REVERSE = {
        "MTG": "PRJ-MTG",
        "MTG-INT": "PRJ-MTG-INT",
        "MTG-EXT": "PRJ-MTG-EXT",
        "MTG-REP": "PRJ-MTG-REP",
        "MTG-INF": "PRJ-MTG-INF",
        "MTG-DEC": "PRJ-MTG-DEC",
        "MTG-PRB": "PRJ-MTG-PRB",
        "MTG-UPD": "PRJ-MTG-UPD",
        "MTG-FDB": "PRJ-MTG-FDB",
    }

    # Get PRJ id
    prj = db.execute(
        text("SELECT id FROM work_type_categories WHERE code = 'PRJ'")
    ).fetchone()

    if not prj:
        print("ERROR: PRJ category not found")
        return False

    # Get MTG id
    mtg = db.execute(
        text("SELECT id FROM work_type_categories WHERE code = 'MTG'")
    ).fetchone()

    if not mtg:
        print("MTG category not found. Nothing to rollback.")
        return False

    mtg_id = mtg[0]

    # Update MTG back to PRJ-MTG
    db.execute(
        text("""
            UPDATE work_type_categories
            SET code = 'PRJ-MTG',
                level = 2,
                parent_id = :prj_id,
                sort_order = 1
            WHERE id = :id
        """),
        {"id": mtg_id, "prj_id": prj[0]}
    )

    # Update L2 back to L3
    l2_cats = db.execute(
        text("SELECT id, code FROM work_type_categories WHERE parent_id = :parent_id"),
        {"parent_id": mtg_id}
    ).fetchall()

    for cat in l2_cats:
        new_code = CODE_MAPPING_REVERSE.get(cat[1], cat[1])
        db.execute(
            text("UPDATE work_type_categories SET code = :new_code, level = 3 WHERE id = :id"),
            {"new_code": new_code, "id": cat[0]}
        )

    # Worklogs use FK - no update needed

    # Fix sort_orders
    db.execute(
        text("""
            UPDATE work_type_categories
            SET sort_order = sort_order - 1
            WHERE level = 1 AND sort_order > 2
        """)
    )

    db.commit()
    print("Rollback completed!")
    return True


if __name__ == "__main__":
    import sys
    from app.core.database import get_engine
    from sqlalchemy.orm import sessionmaker

    engine = get_engine()
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        if len(sys.argv) > 1 and sys.argv[1] == "--rollback":
            rollback_mtg_migration(db)
        else:
            migrate_mtg_to_l1(db)
    except Exception as e:
        print(f"ERROR: {e}")
        db.rollback()
        raise
    finally:
        db.close()
