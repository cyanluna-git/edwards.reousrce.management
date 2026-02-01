"""
2026년도 General/Non-Project 워크로그를 Support 업무로 분류하거나 팀 자체 업무로 비움
"""
import re
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Database connection
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5434/edwards")
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)

# Support project IDs
SUPPORT_PROJECTS = {
    "PRE_GATE": "7da15734-c7e1-4211-a424-c44ae66bc3ed",  # Pre-Gate Support
    "SUN_OPS": "025852db-8ed0-487f-8f1f-684aef35400a",   # SUN Operations Support
    "SUN_IMPROVE": "f63dfcaf-f50f-4ef0-a064-1b57aa84441f", # SUN Product Improvement
    "VSS_IMPROVE": "c101b5a3-e075-489c-8df6-214efe057229", # VSS Product Improvement
    "VSS_SERVICE": "89f2b110-cf2f-4f96-be95-6d56519b1678", # VSS Sales/Service Support
}

GENERAL_PROJECT_ID = "8a45fd77-809a-442c-8000-f82a0597964d"

# 팀 자체 업무 패턴 (project_id = NULL)
TEAM_INTERNAL_PATTERNS = [
    # 휴가/연차
    r'연차', r'휴가', r'day\s*off', r'leave', r'half\s*day', r'개인\s*연차', r'오전\s*반차', r'오후\s*반차', r'연속휴가',
    # 영어 공부
    r'EF\s*(영어|공부|study)', r'English\s*self[-\s]*study', r'전화\s*영어', r'영어\s*공부',
    # 메일/업무 정리
    r'메일\s*확인\s*/?\s*업무\s*(준비|정리)', r'Email\s*check', r'메일\s*정리', r'업무\s*정리',
    r'E[-]?Mail\s*Check\s*(및|and)?\s*업무\s*처리',
    # 미팅/Town hall
    r'Town\s*hall', r'Townhall', r'Engineering\s*Town\s*Hall',
    r'1\s*(to|on)\s*1', r'1:1', r'1on1',
    r'Team\s*(Weekly|Meeting)', r'팀\s*미팅', r'팀미팅',
    r'Weekly\s*meeting', r'주간\s*미팅',
    # 교육
    r'정기안전보건교육', r'SHE\s*(Training|Starts)', r'안전보건교육', r'연구개발업\s*근로자정기교육',
    r'VT\s*SHE\s*Training',
    # 개인 업무
    r'노트북\s*백업', r'자리\s*이동', r'환경\s*구축',
    r'windows\s*upgrade', r'Autocad.*설치', r'3DX.*설치',
    # 내부 행정
    r'Time\s*Attendant', r'headcount\s*작성',
    r'Admin\s*권한', r'License\s*등록',
    # 세미나 (일반)
    r'CS\s*세미나', r'Docker.*세미나', r'seminar',
    # Lean/Kanban (내부 프로세스)
    r'Lean\s*Kanban', r'Kanban\s*meeting',
    # 성과 정리
    r'성과\s*정리', r'자료\s*정리', r'파일\s*정리',
    # 월간보고 (내부)
    r'월간\s*보고',
    # Innovation 내부 활동
    r'Innovation\s*(Meeting|활동)', r'Cost\s*Reduction\s*회의',
]

# VSS Sales/Service Support 패턴
VSS_SERVICE_PATTERNS = [
    r'\[?Field\]?', r'현장\s*(지원|대응|문의)', r'고객\s*(문의|검수)',
    r'서비스\s*전달', r'문서\s*대응',
    r'Sales', r'Service\s*Support',
    r'Troubleshooting', r'issue\s*대응',
    r'설계\s*자료\s*전달',
    r'영업\s*문의', r'CC\s*문의',
    r'SECS/GEM\s*기술\s*문의',
]

# SUN Operations Support 패턴
SUN_OPS_PATTERNS = [
    r'Lab\s*Test\s*지원', r'QC\s*관련', r'OQC',
    r'ME\s*업무', r'제조.*지원', r'품질.*지원',
    r'Factory\s*Test', r'FT&CC',
    r'Lab.*Schedule.*Meeting',
    r'분석기.*점검', r'측정.*데이터',
    r'검교정', r'분석법\s*정립',
    r'계측기\s*메뉴얼',
]

# SUN Product Improvement 패턴
SUN_IMPROVE_PATTERNS = [
    r'CIP', r'EC[-\s]?\d+', r'ECO[-\s]?\d+',
    r'개선\s*(작업|Test)', r'Improvement',
    r'ETO\s*(Project|Support)?',
    r'Legacy.*개선',
]

# Pre-Gate Support 패턴
PRE_GATE_PATTERNS = [
    r'Gate\s*\d', r'TR\s*\d', r'TRR',
    r'Peer\s*Review', r'DFMEA', r'FAST\s*Review',
    r'NPI', r'Pre[-\s]?Gate',
    r'Alpha\s*Release',
]


# InProgress 프로젝트 매핑 (프로젝트 ID -> 키워드 패턴)
# DB에서 조회한 InProgress 프로젝트들
INPROGRESS_PROJECT_PATTERNS = {
    # PRODUCT 프로젝트
    "c8cd3717-bff8-4a70-8489-3f1b6cb9ecb1": [r'ACM\s*NPI'],  # ACM NPI
    "2c41416a-3d11-406f-b12c-c1b1d4896d50": [r'EUV.*Gen3.*Plus.*Micron', r'Gen3\+.*Micron\s*ID'],  # EUV Gen3 Plus Micron ID
    "74a3027f-ac1f-4db6-b1df-7a3b699a1fb2": [r'EUV.*Gen4.*Phase\s*1', r'Tumalo.*Phase\s*1'],  # EUV Gen4 Phase 1 Tumalo
    # EUV Gen4 Phase 2 Tumalo - Vizeon 키워드 포함
    "dbf7bb73-6519-4e1b-a339-e7f666f526cf": [
        r'EUV.*Gen4.*Phase\s*2', r'Tumalo.*Phase\s*2',
        r'Vizeon', r'VIZEON', r'vizeon',  # Vizeon 매핑
        r'EUV6550', r'6xSRC',  # EUV6550LP, 6xSRC 시스템
    ],
    "6e40f828-de5a-43ee-abf1-0dcb7d44b316": [r'Gen3\+.*HRSD', r'H2D[-\s]*HP.*HVM'],  # Gen3+, HRSD, H2D-HP x 2, HVM
    "4857578e-a911-43df-b03b-d1332f9ffda1": [r'Gen3\+\s*Micron(?!\s*ID)'],  # Gen3+ Micron
    "b8710a18-e296-4765-928d-0cfa88f94fac": [r'Gen3\+\s*Rapidus', r'Rapidus'],  # Gen3+ Rapidus
    "f9914dab-90fc-4e73-92f3-e17d638b9b02": [r'Havasu'],  # Havasu
    "b403a619-92fc-4450-b5d6-5c9064b373a1": [r'High\s*Performance\s*H2D', r'H2D\s*1000slm'],  # High Performance H2D (1000slm)
    "c1380ec9-96dd-4575-afc4-41f7f5f83803": [r'HRS\s*Transition'],  # HRS Transition
    "9793cb65-4eaf-4cd6-9feb-b4d8809fdf94": [r'Hydrogen\s*Recycling', r'HRS.*KR'],  # Hydrogen Recycling System_KR
    "64055402-4035-44ed-bc58-df2a43c256b6": [r'LPLN\s*SAVAS', r'SAVAS'],  # LPLN SAVAS
    "fba35a7d-71a9-4fad-8962-862a71f36373": [r'LPLN\s*TOP150', r'TOP150\s*DUAL', r'TOP\s*150\s*Dual'],  # LPLN TOP150 DUAL HVM
    "47f93fd7-7497-436e-b99e-b05fc7c03444": [r'Proteus\s*H2\s*Injection'],  # Proteus H2 Injection Kit
    "3149c0c4-5ee6-497d-8078-a1916babb4b3": [r'Protron\s*Field\s*CIP'],  # Protron Field CIP
    "c786e448-7c70-43be-89c2-3e0b21fa612c": [r'Protron.*Single\s*ROW'],  # Protron | Single ROW
    "b5a03051-7d3d-4bef-8d4a-887f3da52c91": [r'SDC\s*Plasma.*Etch', r'SDC.*Single\s*Etch'],  # SDC Plasma Single Etch
    "77bc14b5-157f-4d3c-b2c7-2dd81a5d7367": [r'Taylor\s*향?\s*SAR', r'Taylor.*SAR', r'SAR\s*Taylor', r'Taylor\s*(PJT|측정)'],  # Taylor 향 SAR
    "a0f09df6-1141-4748-89a6-3513bf97603f": [r'TOP400\s*SLED'],  # TOP400 SLED (for TRR handover)
    "013c7ee7-edcc-46bc-bcc8-55b15bb2481f": [r'Unify\s*Plasma'],  # Unify Plasma Single
    # FUNCTIONAL 프로젝트
    "5d3cdf79-3015-44e0-b642-4dbee65aeab5": [r'Core\s*Technology'],  # Core Technology
    "ac78d5ae-a15e-4a40-9638-8109539d6633": [r'OQC\s*Digitalization'],  # OQC Digitalization Infrastructure
}

# 서브팀별 기본 프로젝트 매핑 (키워드 기반)
SUBTEAM_PROJECT_KEYWORDS = {
    "Electrical (IS)": {
        "dbf7bb73-6519-4e1b-a339-e7f666f526cf": [r'TSMC', r'Power\s*[Bb]ox', r'ECDP', r'EUV', r'Phase\s*[12]'],  # EUV Gen4 Phase 2
        "fba35a7d-71a9-4fad-8962-862a71f36373": [r'LPLN', r'TOP\s*150'],  # LPLN TOP150
    },
    "Software (IS)": {
        "dbf7bb73-6519-4e1b-a339-e7f666f526cf": [r'TSMC', r'EUV', r'Vizeon', r'Python\s*Simulator', r'Gen[234]'],
        "fba35a7d-71a9-4fad-8962-862a71f36373": [r'LPLN'],
    },
    "Electrical (ABT)": {
        "77bc14b5-157f-4d3c-b2c7-2dd81a5d7367": [r'Torch', r'harness', r'S300'],  # Taylor 향 SAR (Torch 관련)
        "fba35a7d-71a9-4fad-8962-862a71f36373": [r'LPLN', r'TOP\s*150'],
    },
    "Software (ABT)": {
        "77bc14b5-157f-4d3c-b2c7-2dd81a5d7367": [r'Torch', r'SCO[-\s]*\d+', r'Auto\s*Sampling'],  # Taylor 향 SAR
        "fba35a7d-71a9-4fad-8962-862a71f36373": [r'LPLN'],
    },
    "Systems Engineering": {
        "dbf7bb73-6519-4e1b-a339-e7f666f526cf": [r'Vizeon', r'Phase\s*[12]', r'TSMC', r'DVP', r'Reliability', r'FT&CC'],
        "fba35a7d-71a9-4fad-8962-862a71f36373": [r'LPLN', r'TOP\s*150'],
    },
    "Mechanical Engineering": {
        "dbf7bb73-6519-4e1b-a339-e7f666f526cf": [r'Vizeon', r'VPSA', r'Micron\s*A&D', r'IBM'],
        "fba35a7d-71a9-4fad-8962-862a71f36373": [r'LPLN'],
    },
    "Analysis Tech.": {
        "77bc14b5-157f-4d3c-b2c7-2dd81a5d7367": [r'Taylor', r'SEC\s*V1L', r'측정', r'분석'],
    },
}

# 특수 프로젝트 키워드 (미분류 항목에서 프로젝트명 추출)
SPECIAL_PROJECT_KEYWORDS = {
    # Vizeon 관련 - 별도 Vizeon 프로젝트가 있을 수 있으므로 확인 필요
    "Vizeon": None,  # 별도 처리
    "IBM": None,  # IBM 프로젝트
    "Micron A&D": None,  # Micron 프로젝트
    "TSMC": None,  # TSMC 관련
}


def classify_worklog(description: str, inprogress_projects: dict = None, user_subteam: str = None) -> tuple[str | None, str]:
    """
    워크로그 설명을 분석하여 분류 결과 반환
    Returns: (new_project_id, classification_reason)
    """
    if not description:
        return None, "Empty description"

    desc_lower = description.lower()

    # 1. 팀 자체 업무 체크 (NULL로 설정)
    for pattern in TEAM_INTERNAL_PATTERNS:
        if re.search(pattern, description, re.IGNORECASE):
            return None, f"Team internal: {pattern}"

    # 2. InProgress 프로젝트 매칭 (description에 프로젝트명 포함 시)
    for project_id, patterns in INPROGRESS_PROJECT_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, description, re.IGNORECASE):
                return project_id, f"InProgress project match: {pattern}"

    # 3. 서브팀 기반 프로젝트 매칭
    if user_subteam and user_subteam in SUBTEAM_PROJECT_KEYWORDS:
        subteam_mappings = SUBTEAM_PROJECT_KEYWORDS[user_subteam]
        for project_id, patterns in subteam_mappings.items():
            for pattern in patterns:
                if re.search(pattern, description, re.IGNORECASE):
                    return project_id, f"Subteam({user_subteam}) match: {pattern}"

    # 4. DB에서 조회한 InProgress 프로젝트와 매칭
    if inprogress_projects:
        for project_id, project_name in inprogress_projects.items():
            # 프로젝트명에서 키워드 추출하여 매칭
            keywords = extract_keywords(project_name)
            for keyword in keywords:
                if len(keyword) >= 4 and re.search(re.escape(keyword), description, re.IGNORECASE):
                    return project_id, f"Project name match: {keyword}"

    # 5. VSS Sales/Service Support
    for pattern in VSS_SERVICE_PATTERNS:
        if re.search(pattern, description, re.IGNORECASE):
            return SUPPORT_PROJECTS["VSS_SERVICE"], f"VSS Service: {pattern}"

    # 6. SUN Operations Support
    for pattern in SUN_OPS_PATTERNS:
        if re.search(pattern, description, re.IGNORECASE):
            return SUPPORT_PROJECTS["SUN_OPS"], f"SUN Ops: {pattern}"

    # 7. SUN Product Improvement
    for pattern in SUN_IMPROVE_PATTERNS:
        if re.search(pattern, description, re.IGNORECASE):
            return SUPPORT_PROJECTS["SUN_IMPROVE"], f"SUN Improve: {pattern}"

    # 8. Pre-Gate Support
    for pattern in PRE_GATE_PATTERNS:
        if re.search(pattern, description, re.IGNORECASE):
            return SUPPORT_PROJECTS["PRE_GATE"], f"Pre-Gate: {pattern}"

    # 분류 불가 - 기존 유지
    return "KEEP", "No pattern matched"


def extract_keywords(project_name: str) -> list[str]:
    """프로젝트명에서 매칭에 사용할 키워드 추출"""
    # 특수문자 제거 및 분리
    keywords = []

    # 전체 이름 추가 (짧은 것은 제외)
    if len(project_name) >= 4:
        keywords.append(project_name)

    # | 로 분리된 부분 추가
    parts = project_name.split('|')
    for part in parts:
        part = part.strip()
        if len(part) >= 4:
            keywords.append(part)

    return keywords


def main(dry_run: bool = True):
    session = Session()

    try:
        # InProgress 프로젝트 조회
        inprogress_query = text("""
            SELECT id, name FROM projects
            WHERE status = 'InProgress'
        """)
        inprogress_result = session.execute(inprogress_query)
        inprogress_projects = {row[0]: row[1] for row in inprogress_result.fetchall()}
        print(f"InProgress 프로젝트: {len(inprogress_projects)}개")

        # 사용자별 서브팀 정보 조회
        user_subteam_query = text("""
            SELECT u.id, st.name as subteam
            FROM users u
            LEFT JOIN sub_teams st ON u.sub_team_id = st.id
        """)
        user_subteam_result = session.execute(user_subteam_query)
        user_subteams = {row[0]: row[1] for row in user_subteam_result.fetchall()}

        # 2026년 General/Non-Project 워크로그 조회 (user_id 포함)
        query = text("""
            SELECT w.id, w.description, u.name, w.date, u.id as user_id
            FROM worklogs w
            JOIN users u ON w.user_id = u.id
            WHERE w.date >= '2026-01-01'
            AND w.project_id = :general_project_id
            ORDER BY w.date, u.name
        """)

        result = session.execute(query, {"general_project_id": GENERAL_PROJECT_ID})
        worklogs = result.fetchall()

        print(f"총 {len(worklogs)}개의 General/Non-Project 워크로그 분석")
        print("=" * 80)

        # 분류 통계
        stats = {
            "NULL (팀 자체)": 0,
            "VSS Service": 0,
            "SUN Ops": 0,
            "SUN Improve": 0,
            "Pre-Gate": 0,
            "InProgress 프로젝트": 0,
            "유지 (미분류)": 0,
        }

        updates = []
        project_matches = {}  # 프로젝트별 매칭 카운트

        for worklog in worklogs:
            wl_id, description, user_name, date, user_id = worklog
            user_subteam = user_subteams.get(user_id)
            new_project_id, reason = classify_worklog(description, inprogress_projects, user_subteam)

            if new_project_id == "KEEP":
                stats["유지 (미분류)"] += 1
                # 미분류 항목도 NULL로 처리 (팀 자체 업무)
                updates.append((wl_id, None, "Unclassified -> Team internal"))
                # 미분류 항목 출력 (분석용)
                if dry_run:
                    print(f"[미분류→NULL] {date} | {user_name}: {description[:60]}...")
            elif new_project_id is None:
                stats["NULL (팀 자체)"] += 1
                updates.append((wl_id, None, reason))
            elif new_project_id == SUPPORT_PROJECTS["VSS_SERVICE"]:
                stats["VSS Service"] += 1
                updates.append((wl_id, new_project_id, reason))
            elif new_project_id == SUPPORT_PROJECTS["SUN_OPS"]:
                stats["SUN Ops"] += 1
                updates.append((wl_id, new_project_id, reason))
            elif new_project_id == SUPPORT_PROJECTS["SUN_IMPROVE"]:
                stats["SUN Improve"] += 1
                updates.append((wl_id, new_project_id, reason))
            elif new_project_id == SUPPORT_PROJECTS["PRE_GATE"]:
                stats["Pre-Gate"] += 1
                updates.append((wl_id, new_project_id, reason))
            else:
                # InProgress 프로젝트 매칭
                stats["InProgress 프로젝트"] += 1
                updates.append((wl_id, new_project_id, reason))
                # 프로젝트별 카운트
                project_name = inprogress_projects.get(new_project_id, new_project_id)
                project_matches[project_name] = project_matches.get(project_name, 0) + 1

        print("\n" + "=" * 80)
        print("분류 통계:")
        for category, count in stats.items():
            print(f"  {category}: {count}")

        if project_matches:
            print("\nInProgress 프로젝트별 매칭:")
            for project_name, count in sorted(project_matches.items(), key=lambda x: -x[1]):
                print(f"  {project_name}: {count}건")

        print(f"\n총 변경 대상: {len(updates)}건")

        if dry_run:
            print("\n[DRY RUN] 실제 변경은 수행되지 않았습니다.")
            print("실제 적용하려면 --apply 옵션을 사용하세요.")
        else:
            # 실제 업데이트 수행
            print("\n업데이트 적용 중...")
            for wl_id, new_project_id, reason in updates:
                update_query = text("""
                    UPDATE worklogs
                    SET project_id = :project_id
                    WHERE id = :id
                """)
                session.execute(update_query, {"project_id": new_project_id, "id": wl_id})

            session.commit()
            print(f"✅ {len(updates)}건 업데이트 완료!")

    except Exception as e:
        session.rollback()
        print(f"Error: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    apply = "--apply" in sys.argv
    main(dry_run=not apply)
