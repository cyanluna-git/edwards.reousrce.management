from sqlalchemy.orm import Session
from app.core.database import Base, get_engine
from app.models.user import User
from app.models.organization import BusinessUnit, Department, SubTeam, JobPosition
from app.models.project import Project, ProjectType, Program, ProductLine
from app.schemas.user import UserCreate
from app.services.user_service import UserService
import uuid


def init_data(db: Session):
    """
    Initializes data for the database from PCAS Engineering Team Members CSV.
    """
    print("Initializing data from PCAS Engineering Team Members...")

    # ============================================================
    # 1. Business Units (CSV의 Business Area 기반)
    # ============================================================
    bu_is = BusinessUnit(id="BU_IS", name="Integrated System", code="IS")
    bu_abt = BusinessUnit(id="BU_ABT", name="Abatement", code="ABT")
    bu_acm = BusinessUnit(id="BU_ACM", name="ACM", code="ACM")
    bu_shared = BusinessUnit(id="BU_SHARED", name="Shared", code="SHR")
    db.add_all([bu_is, bu_abt, bu_acm, bu_shared])
    db.commit()
    print("Business Units created: IS, Abatement, ACM, Shared")

    # ============================================================
    # 2. Departments (CSV의 Team 기반)
    # ============================================================
    dept_acm_tech = Department(
        id="DEPT_ACM_TECH", name="ACM Tech", code="ACM_TECH", business_unit_id="BU_ACM"
    )
    dept_central = Department(
        id="DEPT_CENTRAL",
        name="Central Engineering",
        code="CENTRAL",
        business_unit_id="BU_SHARED",
    )
    dept_control = Department(
        id="DEPT_CONTROL",
        name="Control Engineering",
        code="CONTROL",
        business_unit_id="BU_SHARED",
    )
    dept_eto = Department(
        id="DEPT_ETO", name="ETO", code="ETO", business_unit_id="BU_SHARED"
    )
    dept_npi_abt = Department(
        id="DEPT_NPI_ABT",
        name="NPI, Abatement",
        code="NPI_ABT",
        business_unit_id="BU_ABT",
    )
    dept_npi_is = Department(
        id="DEPT_NPI_IS",
        name="NPI, IntegratedSystem",
        code="NPI_IS",
        business_unit_id="BU_IS",
    )
    db.add_all(
        [dept_acm_tech, dept_central, dept_control, dept_eto, dept_npi_abt, dept_npi_is]
    )
    db.commit()
    print(
        "Departments created: ACM Tech, Central Engineering, Control Engineering, ETO, NPI Abatement, NPI IS"
    )

    # ============================================================
    # 3. Sub-Teams (CSV의 Sub-Team 기반)
    # ============================================================
    sub_teams_data = [
        # Central Engineering
        {"id": "ST_DES", "name": "DES", "code": "DES", "department_id": "DEPT_CENTRAL"},
        {
            "id": "ST_LAB",
            "name": "Lab Management",
            "code": "LAB",
            "department_id": "DEPT_CENTRAL",
        },
        {
            "id": "ST_ANALYSIS",
            "name": "Analysis Tech.",
            "code": "ANALYSIS",
            "department_id": "DEPT_CENTRAL",
        },
        {"id": "ST_RA", "name": "RA", "code": "RA", "department_id": "DEPT_CENTRAL"},
        # Control Engineering - IntegratedSystem
        {
            "id": "ST_CTRL_SW_IS",
            "name": "Software (IS)",
            "code": "CTRL_SW_IS",
            "department_id": "DEPT_CONTROL",
        },
        {
            "id": "ST_CTRL_ELEC_IS",
            "name": "Electrical (IS)",
            "code": "CTRL_ELEC_IS",
            "department_id": "DEPT_CONTROL",
        },
        # Control Engineering - Abatement
        {
            "id": "ST_CTRL_SW_ABT",
            "name": "Software (ABT)",
            "code": "CTRL_SW_ABT",
            "department_id": "DEPT_CONTROL",
        },
        {
            "id": "ST_CTRL_ELEC_ABT",
            "name": "Electrical (ABT)",
            "code": "CTRL_ELEC_ABT",
            "department_id": "DEPT_CONTROL",
        },
        # ETO
        {
            "id": "ST_ETO_ELEC",
            "name": "ETO Elec",
            "code": "ETO_ELEC",
            "department_id": "DEPT_ETO",
        },
        # NPI IntegratedSystem
        {
            "id": "ST_SYS_ENG",
            "name": "Systems Engineering",
            "code": "SYS_ENG",
            "department_id": "DEPT_NPI_IS",
        },
        {
            "id": "ST_MECH_ENG",
            "name": "Mechanical Engineering",
            "code": "MECH_ENG",
            "department_id": "DEPT_NPI_IS",
        },
        # NPI Abatement
        {
            "id": "ST_NPI1",
            "name": "NPI 1 Team",
            "code": "NPI1",
            "department_id": "DEPT_NPI_ABT",
        },
    ]

    sub_team_map = {}
    for st in sub_teams_data:
        sub_team = SubTeam(**st)
        db.add(sub_team)
        sub_team_map[st["name"]] = st["id"]
    db.commit()
    print(f"Sub-Teams created: {len(sub_teams_data)} teams")

    # ============================================================
    # 4. Job Positions (기존 유지)
    # ============================================================
    job_positions_data = [
        "Electrical engineer",
        "Mechanical engineer",
        "PM",
        "Service engineer",
        "Software engineer",
        "SW test engineer",
        "System engineer",
        "Tech Lead",
        "Technician",
        "Engineer",  # 기본 직무
    ]

    job_positions = {}
    for name in job_positions_data:
        jp_id = f"JP_{name.upper().replace(' ', '_')}"
        jp = JobPosition(id=jp_id, name=name, is_active=True)
        db.add(jp)
        job_positions[name] = jp_id
    db.commit()
    print(f"Created {len(job_positions_data)} Job Positions.")

    default_position_id = job_positions["Engineer"]

    # ============================================================
    # 5. Admin User (서비스 관리자)
    # ============================================================
    user_service = UserService(db)

    admin_user_data = UserCreate(
        email="admin@edwards.com",
        name="System Admin",
        korean_name="시스템관리자",
        password="password",
        is_active=True,
        role="ADMIN",
        position_id=job_positions["PM"],
        department_id="DEPT_CENTRAL",
    )
    user_service.create_user(admin_user_data)
    print("Admin user created: admin@edwards.com")

    # ============================================================
    # 6. Members from CSV
    # ============================================================
    # CSV 데이터 기반 멤버 목록 (124명)
    members_data = [
        # ACM Tech
        {
            "name": "Dana Lee",
            "korean_name": "이주현C",
            "email": "dana.lee@csk.kr",
            "department_id": "DEPT_ACM_TECH",
            "sub_team_id": None,
        },
        {
            "name": "Soojin Jin",
            "korean_name": "진수진",
            "email": "soojin.jin@csk.kr",
            "department_id": "DEPT_ACM_TECH",
            "sub_team_id": None,
        },
        {
            "name": "Jayden Kang",
            "korean_name": "강재윤",
            "email": "jayden.kang@csk.kr",
            "department_id": "DEPT_ACM_TECH",
            "sub_team_id": None,
        },
        {
            "name": "Claire Park",
            "korean_name": "박연",
            "email": "claire.park@csk.kr",
            "department_id": "DEPT_ACM_TECH",
            "sub_team_id": None,
        },
        {
            "name": "Randy Kim",
            "korean_name": "김대영",
            "email": "randy.kim@csk.kr",
            "department_id": "DEPT_ACM_TECH",
            "sub_team_id": None,
        },
        {
            "name": "Steve Kim",
            "korean_name": "김규진",
            "email": "steve.kim@csk.kr",
            "department_id": "DEPT_ACM_TECH",
            "sub_team_id": None,
        },
        {
            "name": "Ayaan Lee",
            "korean_name": "이호승",
            "email": "ayaan.lee@csk.kr",
            "department_id": "DEPT_ACM_TECH",
            "sub_team_id": None,
        },
        {
            "name": "Ethan Ahn",
            "korean_name": "안치원",
            "email": "Ethan.Ahn@csk.kr",
            "department_id": "DEPT_ACM_TECH",
            "sub_team_id": None,
        },
        {
            "name": "Eric Yang",
            "korean_name": "양승만",
            "email": "eric.a.yang@csk.kr",
            "department_id": "DEPT_ACM_TECH",
            "sub_team_id": None,
        },
        {
            "name": "Marco Park",
            "korean_name": "박성수",
            "email": "marco.park@csk.kr",
            "department_id": "DEPT_ACM_TECH",
            "sub_team_id": None,
        },
        {
            "name": "Shane Lee",
            "korean_name": "이승환",
            "email": "shane.a.lee@csk.kr",
            "department_id": "DEPT_ACM_TECH",
            "sub_team_id": None,
        },
        {
            "name": "Howard Choi",
            "korean_name": "최호원",
            "email": "howard.choi@csk.kr",
            "department_id": "DEPT_ACM_TECH",
            "sub_team_id": None,
        },
        {
            "name": "Aaron Oh",
            "korean_name": "오정윤",
            "email": "aaron.oh@csk.kr",
            "department_id": "DEPT_ACM_TECH",
            "sub_team_id": None,
        },
        {
            "name": "Leo Ko",
            "korean_name": "고제윤",
            "email": "leo.ko@csk.kr",
            "department_id": "DEPT_ACM_TECH",
            "sub_team_id": None,
        },
        # Central Engineering - DES
        {
            "name": "Victor Do",
            "korean_name": "도현모",
            "email": "victor.do@edwardsvacuum.com",
            "department_id": "DEPT_CENTRAL",
            "sub_team_id": "ST_DES",
        },
        {
            "name": "Sophie Kim",
            "korean_name": "김소희",
            "email": "Sophie.Kim@edwardsvacuum.com",
            "department_id": "DEPT_CENTRAL",
            "sub_team_id": "ST_DES",
        },
        {
            "name": "Alice Jin",
            "korean_name": "진미정",
            "email": "alice.jin@edwardsvacuum.com",
            "department_id": "DEPT_CENTRAL",
            "sub_team_id": "ST_DES",
        },
        {
            "name": "Judy Lee",
            "korean_name": "이연주",
            "email": "Judy.lee@edwardsvacuum.com",
            "department_id": "DEPT_CENTRAL",
            "sub_team_id": "ST_DES",
        },
        {
            "name": "Fred Lee",
            "korean_name": "이준영",
            "email": "fred.lee@edwardsvacuum.com",
            "department_id": "DEPT_CENTRAL",
            "sub_team_id": "ST_DES",
        },
        # Central Engineering - Lab Management
        {
            "name": "Matt Lee",
            "korean_name": "이충완",
            "email": "matt.lee@csk.co.kr",
            "department_id": "DEPT_CENTRAL",
            "sub_team_id": "ST_LAB",
        },
        {
            "name": "Hugh So",
            "korean_name": "소장현",
            "email": "hugh.so@csk.co.kr",
            "department_id": "DEPT_CENTRAL",
            "sub_team_id": "ST_LAB",
        },
        # Central Engineering - Analysis Tech
        {
            "name": "Hannah Kim",
            "korean_name": "김은영",
            "email": "hannah.kim@csk.kr",
            "department_id": "DEPT_CENTRAL",
            "sub_team_id": "ST_ANALYSIS",
        },
        {
            "name": "Simone Lee",
            "korean_name": "이정현",
            "email": "simone.lee@csk.kr",
            "department_id": "DEPT_CENTRAL",
            "sub_team_id": "ST_ANALYSIS",
        },
        {
            "name": "Ella Heo",
            "korean_name": "허정희",
            "email": "JeongHui.Heo@csk.kr",
            "department_id": "DEPT_CENTRAL",
            "sub_team_id": "ST_ANALYSIS",
        },
        {
            "name": "Jason Jang",
            "korean_name": "장현상",
            "email": "Jason.b.jang@csk.kr",
            "department_id": "DEPT_CENTRAL",
            "sub_team_id": "ST_ANALYSIS",
        },
        {
            "name": "Daniel Lee",
            "korean_name": "이남종",
            "email": "daniel.a.lee@csk.kr",
            "department_id": "DEPT_CENTRAL",
            "sub_team_id": "ST_ANALYSIS",
        },
        {
            "name": "Evelyn Park",
            "korean_name": "박혜린",
            "email": "evelyn.park@csk.kr",
            "department_id": "DEPT_CENTRAL",
            "sub_team_id": "ST_ANALYSIS",
        },
        {
            "name": "Vivian Shin",
            "korean_name": "신현아",
            "email": "vivian.shin@csk.kr",
            "department_id": "DEPT_CENTRAL",
            "sub_team_id": "ST_ANALYSIS",
        },
        {
            "name": "Janey Park",
            "korean_name": "박지연",
            "email": "Janey.park@csk.kr",
            "department_id": "DEPT_CENTRAL",
            "sub_team_id": "ST_ANALYSIS",
        },
        # Central Engineering - RA
        {
            "name": "Hailey Lee",
            "korean_name": "이희정",
            "email": "hailey.lee@csk.co.kr",
            "department_id": "DEPT_CENTRAL",
            "sub_team_id": "ST_RA",
        },
        # Control Engineering - IntegratedSystem / Software
        {
            "name": "Gerald Park",
            "korean_name": "박근윤",
            "email": "gerald.park@edwardsvacuum.com",
            "department_id": "DEPT_CONTROL",
            "sub_team_id": "ST_CTRL_SW_IS",
        },
        {
            "name": "Ethan Jung",
            "korean_name": "정산호",
            "email": "ethan.jung@edwardsvacuum.com",
            "department_id": "DEPT_CONTROL",
            "sub_team_id": "ST_CTRL_SW_IS",
        },
        {
            "name": "Owen Rim",
            "korean_name": "임우현",
            "email": "owen.rim@edwardsvacuum.com",
            "department_id": "DEPT_CONTROL",
            "sub_team_id": "ST_CTRL_SW_IS",
        },
        {
            "name": "Rachel Bae",
            "korean_name": "배주영",
            "email": "rachel.bae@edwardsvacuum.com",
            "department_id": "DEPT_CONTROL",
            "sub_team_id": "ST_CTRL_SW_IS",
        },
        {
            "name": "Elvin Lee",
            "korean_name": "이상빈",
            "email": "elvin.lee@edwardsvacuum.com",
            "department_id": "DEPT_CONTROL",
            "sub_team_id": "ST_CTRL_SW_IS",
        },
        {
            "name": "Roy Choi",
            "korean_name": "최태현",
            "email": "roy.choi@edwardsvacuum.com",
            "department_id": "DEPT_CONTROL",
            "sub_team_id": "ST_CTRL_SW_IS",
        },
        {
            "name": "Ashley Yun",
            "korean_name": "윤이레",
            "email": "ashley.yun@edwardsvacuum.com",
            "department_id": "DEPT_CONTROL",
            "sub_team_id": "ST_CTRL_SW_IS",
        },
        {
            "name": "Joel Lim",
            "korean_name": "임준혁",
            "email": "joel.lim@edwardsvacuum.com",
            "department_id": "DEPT_CONTROL",
            "sub_team_id": "ST_CTRL_SW_IS",
        },
        {
            "name": "Moonsu Cho",
            "korean_name": "조문수",
            "email": "moonsu.cho@edwardsvacuum.com",
            "department_id": "DEPT_CONTROL",
            "sub_team_id": "ST_CTRL_SW_IS",
        },
        {
            "name": "Dave Kim",
            "korean_name": "김세한",
            "email": "dave.kim@edwardsvacuum.com",
            "department_id": "DEPT_CONTROL",
            "sub_team_id": "ST_CTRL_SW_IS",
        },
        {
            "name": "Amelia An",
            "korean_name": "안유수",
            "email": "amelia.an@edwardsvacuum.com",
            "department_id": "DEPT_CONTROL",
            "sub_team_id": "ST_CTRL_SW_IS",
        },
        # Control Engineering - IntegratedSystem / Electrical
        {
            "name": "Dean Choi",
            "korean_name": "최대규",
            "email": "dean.choi@edwardsvacuum.com",
            "department_id": "DEPT_CONTROL",
            "sub_team_id": "ST_CTRL_ELEC_IS",
        },
        {
            "name": "Julia Mun",
            "korean_name": "문다예",
            "email": "julia.mun@edwardsvacuum.com",
            "department_id": "DEPT_CONTROL",
            "sub_team_id": "ST_CTRL_ELEC_IS",
        },
        {
            "name": "Andy Jang",
            "korean_name": "장석남",
            "email": "andy.jang@edwardsvacuum.com",
            "department_id": "DEPT_CONTROL",
            "sub_team_id": "ST_CTRL_ELEC_IS",
        },
        {
            "name": "May Kwon",
            "korean_name": "권주경",
            "email": "may.kwon@edwardsvacuum.com",
            "department_id": "DEPT_CONTROL",
            "sub_team_id": "ST_CTRL_ELEC_IS",
        },
        {
            "name": "Hana Lee",
            "korean_name": "이하나",
            "email": "hana.lee@edwardsvacuum.com",
            "department_id": "DEPT_CONTROL",
            "sub_team_id": "ST_CTRL_ELEC_IS",
        },
        {
            "name": "Joshua Im",
            "korean_name": "임광은",
            "email": "joshua.im@edwardsvacuum.com",
            "department_id": "DEPT_CONTROL",
            "sub_team_id": "ST_CTRL_ELEC_IS",
        },
        {
            "name": "Camila Lee",
            "korean_name": "이나현",
            "email": "camila.lee@edwardsvacuum.com",
            "department_id": "DEPT_CONTROL",
            "sub_team_id": "ST_CTRL_ELEC_IS",
        },
        # Control Engineering - Abatement / Software
        {
            "name": "JiHoon Jang",
            "korean_name": "장지훈A",
            "email": "jihoon.jang@csk.kr",
            "department_id": "DEPT_CONTROL",
            "sub_team_id": "ST_CTRL_SW_ABT",
        },
        {
            "name": "Jenna Lee",
            "korean_name": "이희주",
            "email": "jenna.lee@csk.kr",
            "department_id": "DEPT_CONTROL",
            "sub_team_id": "ST_CTRL_SW_ABT",
        },
        {
            "name": "Daniel Choi",
            "korean_name": "최인주",
            "email": "daniel.choi@csk.kr",
            "department_id": "DEPT_CONTROL",
            "sub_team_id": "ST_CTRL_SW_ABT",
        },
        {
            "name": "Wookhee Lee",
            "korean_name": "이욱희",
            "email": "wookhee.lee@csk.kr",
            "department_id": "DEPT_CONTROL",
            "sub_team_id": "ST_CTRL_SW_ABT",
        },
        {
            "name": "Jayden Kim",
            "korean_name": "김경진",
            "email": "jayden.kim@csk.kr",
            "department_id": "DEPT_CONTROL",
            "sub_team_id": "ST_CTRL_SW_ABT",
        },
        {
            "name": "Sol Ham",
            "korean_name": "함한솔",
            "email": "sol.ham@csk.kr",
            "department_id": "DEPT_CONTROL",
            "sub_team_id": "ST_CTRL_SW_ABT",
        },
        # Control Engineering - Abatement / Electrical
        {
            "name": "Kevin Choi",
            "korean_name": "최은혁",
            "email": "kevin.choi@csk.kr",
            "department_id": "DEPT_CONTROL",
            "sub_team_id": "ST_CTRL_ELEC_ABT",
        },
        {
            "name": "Haksoo Lee",
            "korean_name": "이학수",
            "email": "haksoo.lee@csk.kr",
            "department_id": "DEPT_CONTROL",
            "sub_team_id": "ST_CTRL_ELEC_ABT",
        },
        {
            "name": "Bob Lee",
            "korean_name": "이종현B",
            "email": "bob.lee@csk.kr",
            "department_id": "DEPT_CONTROL",
            "sub_team_id": "ST_CTRL_ELEC_ABT",
        },
        {
            "name": "Dahee Eom",
            "korean_name": "엄다희",
            "email": "dahee.eom@csk.kr",
            "department_id": "DEPT_CONTROL",
            "sub_team_id": "ST_CTRL_ELEC_ABT",
        },
        {
            "name": "Jamie Cho",
            "korean_name": "조윤정",
            "email": "jamie.a.cho@csk.kr",
            "department_id": "DEPT_CONTROL",
            "sub_team_id": "ST_CTRL_ELEC_ABT",
        },
        # ETO - IntegratedSystem
        {
            "name": "Hanbin Suh",
            "korean_name": "서한빈",
            "email": "hanbin.suh@edwardsvacuum.com",
            "department_id": "DEPT_ETO",
            "sub_team_id": None,
        },
        {
            "name": "Ian Noh",
            "korean_name": "노철",
            "email": "ian.noh@edwardsvacuum.com",
            "department_id": "DEPT_ETO",
            "sub_team_id": None,
        },
        {
            "name": "Landon Kim",
            "korean_name": "김진호B",
            "email": "landon.kim@edwardsvacuum.com",
            "department_id": "DEPT_ETO",
            "sub_team_id": None,
        },
        {
            "name": "Gael Jung",
            "korean_name": "정영화",
            "email": "gael.jung@edwardsvacuum.com",
            "department_id": "DEPT_ETO",
            "sub_team_id": None,
        },
        # ETO - Abatement
        {
            "name": "Sua Kim",
            "korean_name": "김수아",
            "email": "sua.kim@csk.kr",
            "department_id": "DEPT_ETO",
            "sub_team_id": None,
        },
        {
            "name": "Hyodong Hwang",
            "korean_name": "황효동",
            "email": "hyodong.hwang@csk.kr",
            "department_id": "DEPT_ETO",
            "sub_team_id": None,
        },
        {
            "name": "Edwin Lee",
            "korean_name": "이태훈A",
            "email": "edwin.lee@csk.kr",
            "department_id": "DEPT_ETO",
            "sub_team_id": None,
        },
        {
            "name": "Morris Ban",
            "korean_name": "반문현",
            "email": "morris.ban@csk.kr",
            "department_id": "DEPT_ETO",
            "sub_team_id": None,
        },
        # ETO - Shared
        {
            "name": "Dylan Kim",
            "korean_name": "김병수",
            "email": "dylan.kim@edwardsvacuum.com",
            "department_id": "DEPT_ETO",
            "sub_team_id": "ST_ETO_ELEC",
        },
        {
            "name": "Joon Park",
            "korean_name": "박준선",
            "email": "joon.park@csk.kr",
            "department_id": "DEPT_ETO",
            "sub_team_id": None,
        },
        {
            "name": "Alon Lee",
            "korean_name": "이석준",
            "email": "alon.lee@edwardsvacuum.com",
            "department_id": "DEPT_ETO",
            "sub_team_id": None,
        },
        {
            "name": "Jenni Kim",
            "korean_name": "김지수",
            "email": "jenni.kim@edwardsvacuum.com",
            "department_id": "DEPT_ETO",
            "sub_team_id": None,
        },
        {
            "name": "Milo Choi",
            "korean_name": "최민혁",
            "email": "milo.choi@edwardsvacuum.com",
            "department_id": "DEPT_ETO",
            "sub_team_id": None,
        },
        # NPI, Abatement
        {
            "name": "James Lim",
            "korean_name": "임종배",
            "email": "james.lim@csk.kr",
            "department_id": "DEPT_NPI_ABT",
            "sub_team_id": None,
        },
        {
            "name": "Jason Lee",
            "korean_name": "이명훈",
            "email": "jason.a.lee@csk.kr",
            "department_id": "DEPT_NPI_ABT",
            "sub_team_id": None,
        },
        {
            "name": "Tom Kim",
            "korean_name": "김영근",
            "email": "tom.kim@csk.kr",
            "department_id": "DEPT_NPI_ABT",
            "sub_team_id": "ST_NPI1",
        },
        {
            "name": "Nathan Choi",
            "korean_name": "최재명",
            "email": "nathan.choi@csk.kr",
            "department_id": "DEPT_NPI_ABT",
            "sub_team_id": None,
        },
        {
            "name": "Aiden Yoo",
            "korean_name": "유태욱",
            "email": "aiden.yoo@csk.kr",
            "department_id": "DEPT_NPI_ABT",
            "sub_team_id": "ST_NPI1",
        },
        {
            "name": "Thompson Kim",
            "korean_name": "김우태",
            "email": "thompson.kim@csk.kr",
            "department_id": "DEPT_NPI_ABT",
            "sub_team_id": None,
        },
        {
            "name": "Neil Kim",
            "korean_name": "김정수B",
            "email": "neil.kim@csk.kr",
            "department_id": "DEPT_NPI_ABT",
            "sub_team_id": None,
        },
        {
            "name": "Sean Shin",
            "korean_name": "신종국",
            "email": "sean.shin@csk.kr",
            "department_id": "DEPT_NPI_ABT",
            "sub_team_id": None,
        },
        {
            "name": "Andrew Lee",
            "korean_name": "이영웅",
            "email": "andrew.lee@csk.kr",
            "department_id": "DEPT_NPI_ABT",
            "sub_team_id": None,
        },
        {
            "name": "Adrian Lee",
            "korean_name": "이헌승",
            "email": "adrian.lee@csk.kr",
            "department_id": "DEPT_NPI_ABT",
            "sub_team_id": None,
        },
        {
            "name": "Jacey Lee",
            "korean_name": "이정아",
            "email": "jacey.lee@csk.kr",
            "department_id": "DEPT_NPI_ABT",
            "sub_team_id": None,
        },
        {
            "name": "Gyunam Oh",
            "korean_name": "오규남",
            "email": "gyunam.oh@csk.kr",
            "department_id": "DEPT_NPI_ABT",
            "sub_team_id": None,
        },
        {
            "name": "Ian Kim",
            "korean_name": "김준영",
            "email": "ian.a.kim@csk.kr",
            "department_id": "DEPT_NPI_ABT",
            "sub_team_id": None,
        },
        {
            "name": "Brad Cho",
            "korean_name": "조철희",
            "email": "brad.cho@csk.kr",
            "department_id": "DEPT_NPI_ABT",
            "sub_team_id": None,
        },
        {
            "name": "James Kim",
            "korean_name": "김재연",
            "email": "james.b.kim@csk.kr",
            "department_id": "DEPT_NPI_ABT",
            "sub_team_id": None,
        },
        {
            "name": "Harrison Lee",
            "korean_name": "이한수",
            "email": "harrison.lee@csk.kr",
            "department_id": "DEPT_NPI_ABT",
            "sub_team_id": None,
        },
        {
            "name": "Yousuf Seo",
            "korean_name": "서영주",
            "email": "yousuf.seo@csk.kr",
            "department_id": "DEPT_NPI_ABT",
            "sub_team_id": None,
        },
        {
            "name": "Paula Kim",
            "korean_name": "김진옥",
            "email": "paula.kim@csk.kr",
            "department_id": "DEPT_NPI_ABT",
            "sub_team_id": None,
        },
        {
            "name": "Sherwin Kim",
            "korean_name": "김락현",
            "email": "sherwin.kim@csk.kr",
            "department_id": "DEPT_NPI_ABT",
            "sub_team_id": None,
        },
        {
            "name": "Jackson Cheon",
            "korean_name": "천중원",
            "email": "jackson.cheon@edwardsvacuum.com",
            "department_id": "DEPT_NPI_ABT",
            "sub_team_id": None,
        },
        {
            "name": "Hubert Cho",
            "korean_name": "조영혁",
            "email": "hubert.cho@csk.kr",
            "department_id": "DEPT_NPI_ABT",
            "sub_team_id": None,
        },
        {
            "name": "Owen Yeom",
            "korean_name": "염길성",
            "email": "owen.yeom@csk.kr",
            "department_id": "DEPT_NPI_ABT",
            "sub_team_id": None,
        },
        {
            "name": "Jade Kim",
            "korean_name": "김지운A",
            "email": "jade.a.kim@csk.kr",
            "department_id": "DEPT_NPI_ABT",
            "sub_team_id": None,
        },
        {
            "name": "Samuel Kim",
            "korean_name": "김영봉",
            "email": "samuel.kim@csk.kr",
            "department_id": "DEPT_NPI_ABT",
            "sub_team_id": None,
        },
        # NPI, IntegratedSystem - Systems Engineering
        {
            "name": "Chad Seo",
            "korean_name": "서상원",
            "email": "chad.seo@edwardsvacuum.com",
            "department_id": "DEPT_NPI_IS",
            "sub_team_id": "ST_SYS_ENG",
        },
        {
            "name": "Michael Kim",
            "korean_name": "김용현",
            "email": "michael.kim@edwardsvacuum.com",
            "department_id": "DEPT_NPI_IS",
            "sub_team_id": "ST_SYS_ENG",
        },
        {
            "name": "Jacob Lee",
            "korean_name": "이재풍",
            "email": "jaepoong.lee@edwardsvacuum.com",
            "department_id": "DEPT_NPI_IS",
            "sub_team_id": "ST_SYS_ENG",
        },
        {
            "name": "Emma Kim",
            "korean_name": "김지은",
            "email": "emma.kim@edwardsvacuum.com",
            "department_id": "DEPT_NPI_IS",
            "sub_team_id": "ST_SYS_ENG",
        },
        {
            "name": "William Lee",
            "korean_name": "이정혁",
            "email": "william.lee@edwardsvacuum.com",
            "department_id": "DEPT_NPI_IS",
            "sub_team_id": "ST_SYS_ENG",
        },
        {
            "name": "Robin Park",
            "korean_name": "박승현",
            "email": "robin.park@edwardsvacuum.com",
            "department_id": "DEPT_NPI_IS",
            "sub_team_id": "ST_SYS_ENG",
        },
        {
            "name": "Geonwoo Jang",
            "korean_name": "장건우",
            "email": "geonwoo.jang@edwardsvacuum.com",
            "department_id": "DEPT_NPI_IS",
            "sub_team_id": "ST_SYS_ENG",
        },
        {
            "name": "Grace Ji",
            "korean_name": "지성미",
            "email": "grace.ji@edwardsvacuum.com",
            "department_id": "DEPT_NPI_IS",
            "sub_team_id": "ST_SYS_ENG",
        },
        {
            "name": "Harry Kwak",
            "korean_name": "곽영웅",
            "email": "harry.kwak@edwardsvacuum.com",
            "department_id": "DEPT_NPI_IS",
            "sub_team_id": "ST_SYS_ENG",
        },
        {
            "name": "Tred Park",
            "korean_name": "박지훈",
            "email": "tred.park@edwardsvacuum.com",
            "department_id": "DEPT_NPI_IS",
            "sub_team_id": "ST_SYS_ENG",
        },
        {
            "name": "Kevin Ko",
            "korean_name": "고현준",
            "email": "kevin.ko@edwardsvacuum.com",
            "department_id": "DEPT_NPI_IS",
            "sub_team_id": "ST_SYS_ENG",
        },
        {
            "name": "Jess Kim",
            "korean_name": "김희재",
            "email": "jess.kim@edwardsvacuum.com",
            "department_id": "DEPT_NPI_IS",
            "sub_team_id": "ST_SYS_ENG",
        },
        {
            "name": "Ricky Kim",
            "korean_name": "김현섭",
            "email": "ricky.kim@edwardsvacuum.com",
            "department_id": "DEPT_NPI_IS",
            "sub_team_id": "ST_SYS_ENG",
        },
        {
            "name": "Noah Yeom",
            "korean_name": "염세훈",
            "email": "noah.yeom@edwardsvacuum.com",
            "department_id": "DEPT_NPI_IS",
            "sub_team_id": "ST_SYS_ENG",
        },
        {
            "name": "Allie Park",
            "korean_name": "박유진",
            "email": "allie.park@edwardsvacuum.com",
            "department_id": "DEPT_NPI_IS",
            "sub_team_id": "ST_SYS_ENG",
        },
        {
            "name": "Anders You",
            "korean_name": "유승훈",
            "email": "anders.you@edwardsvacuum.com",
            "department_id": "DEPT_NPI_IS",
            "sub_team_id": "ST_SYS_ENG",
        },
        {
            "name": "Stella Lim",
            "korean_name": "임선영",
            "email": "stella.lim@edwardsvacuum.com",
            "department_id": "DEPT_NPI_IS",
            "sub_team_id": "ST_SYS_ENG",
        },
        # NPI, IntegratedSystem - Mechanical Engineering
        {
            "name": "Wayne Jo",
            "korean_name": "조원일",
            "email": "wayne.jo@edwardsvacuum.com",
            "department_id": "DEPT_NPI_IS",
            "sub_team_id": "ST_MECH_ENG",
        },
        {
            "name": "Jayden Lee",
            "korean_name": "이민제",
            "email": "jayden.lee@edwardsvacuum.com",
            "department_id": "DEPT_NPI_IS",
            "sub_team_id": "ST_MECH_ENG",
        },
        {
            "name": "Mack Heo",
            "korean_name": "허만수",
            "email": "mack.heo@edwardsvacuum.com",
            "department_id": "DEPT_NPI_IS",
            "sub_team_id": "ST_MECH_ENG",
        },
        {
            "name": "Evan Yu",
            "korean_name": "유석하",
            "email": "evan.yu@edwardsvacuum.com",
            "department_id": "DEPT_NPI_IS",
            "sub_team_id": "ST_MECH_ENG",
        },
        {
            "name": "Jayce Park",
            "korean_name": "박장수",
            "email": "jayce.park@edwardsvacuum.com",
            "department_id": "DEPT_NPI_IS",
            "sub_team_id": "ST_MECH_ENG",
        },
        {
            "name": "Jeremy Park",
            "korean_name": "박진호A",
            "email": "jeremy.park@edwardsvacuum.com",
            "department_id": "DEPT_NPI_IS",
            "sub_team_id": "ST_MECH_ENG",
        },
        {
            "name": "Sooyoung Song",
            "korean_name": "송수영",
            "email": "sooyoung.song@edwardsvacuum.com",
            "department_id": "DEPT_NPI_IS",
            "sub_team_id": "ST_MECH_ENG",
        },
        {
            "name": "Jiny Park",
            "korean_name": "박지선",
            "email": "jiny.park@edwardsvacuum.com",
            "department_id": "DEPT_NPI_IS",
            "sub_team_id": "ST_MECH_ENG",
        },
        {
            "name": "Esther Jeong",
            "korean_name": "정예은",
            "email": "esther.jeong@edwardsvacuum.com",
            "department_id": "DEPT_NPI_IS",
            "sub_team_id": "ST_MECH_ENG",
        },
        {
            "name": "Derek Cho",
            "korean_name": "조현호",
            "email": "derek.cho@edwardsvacuum.com",
            "department_id": "DEPT_NPI_IS",
            "sub_team_id": "ST_MECH_ENG",
        },
    ]

    created_count = 0
    for m in members_data:
        user_data = UserCreate(
            email=m["email"].strip().lower(),
            name=m["name"],
            korean_name=m.get("korean_name"),
            password="password",
            is_active=True,
            role="USER",
            position_id=default_position_id,
            department_id=m["department_id"],
            sub_team_id=m.get("sub_team_id"),
        )
        try:
            user_service.create_user(user_data)
            created_count += 1
        except Exception as e:
            print(f"Warning: Could not create user {m['email']}: {e}")

    print(f"Members created: {created_count} users")

    # ============================================================
    # 7. Project Types
    # ============================================================
    pt_npi = ProjectType(id="NPI", name="New Product Introduction")
    pt_eto = ProjectType(id="ETO", name="Engineering To Order")
    pt_cip = ProjectType(id="CIP", name="Continuous Improvement")
    pt_support = ProjectType(id="SUP", name="Support / General")
    db.add_all([pt_npi, pt_eto, pt_cip, pt_support])
    db.commit()
    print("Project Types created.")

    # ============================================================
    # 7.5 Product Lines (제품군)
    # ============================================================
    product_lines_data = [
        {
            "id": "PL_GEN3",
            "name": "Gen3",
            "code": "GEN3",
            "description": "Generation 3 EUV Platform",
        },
        {
            "id": "PL_GEN3P",
            "name": "Gen3+",
            "code": "GEN3+",
            "description": "Generation 3+ EUV Platform",
        },
        {
            "id": "PL_GEN4",
            "name": "Gen4",
            "code": "GEN4",
            "description": "Generation 4 EUV Platform",
        },
        {
            "id": "PL_RUBY",
            "name": "Ruby",
            "code": "RUBY",
            "description": "Ruby IS Platform",
        },
        {
            "id": "PL_PROTRON",
            "name": "Protron",
            "code": "PROTRON",
            "description": "Protron Abatement Platform",
        },
        {
            "id": "PL_HAVASU",
            "name": "Havasu",
            "code": "HAVASU",
            "description": "Havasu IS Platform",
        },
        {
            "id": "PL_TUMALO",
            "name": "Tumalo",
            "code": "TUMALO",
            "description": "Tumalo EUV Platform",
        },
        {
            "id": "PL_ALTO",
            "name": "Alto",
            "code": "ALTO",
            "description": "Alto Abatement Platform",
        },
        {
            "id": "PL_ATLAS",
            "name": "Atlas",
            "code": "ATLAS",
            "description": "Atlas Cryopump Platform",
        },
    ]
    for pl_data in product_lines_data:
        pl = ProductLine(**pl_data)
        db.add(pl)
    db.commit()
    print(f"Product Lines created: {len(product_lines_data)} lines")

    # ============================================================
    # 8. Programs
    # ============================================================
    prog_euv_npi = Program(id="EUV_NPI", name="EUV NPI", business_unit_id="BU_IS")
    prog_is_npi = Program(id="IS_NPI", name="IS NPI", business_unit_id="BU_IS")
    prog_abt_npi = Program(
        id="ABT_NPI", name="Abatement NPI", business_unit_id="BU_ABT"
    )
    prog_abt_eto = Program(
        id="ABT_ETO", name="Abatement ETO", business_unit_id="BU_ABT"
    )
    prog_euv_eto = Program(id="EUV_ETO", name="EUV ETO", business_unit_id="BU_IS")
    prog_acm_npi = Program(id="ACM_NPI", name="ACM NPI", business_unit_id="BU_ACM")
    prog_acm_eto = Program(id="ACM_ETO", name="ACM ETO", business_unit_id="BU_ACM")
    prog_general = Program(
        id="GEN_FUNC", name="General/Functional", business_unit_id="BU_SHARED"
    )
    db.add_all(
        [
            prog_euv_npi,
            prog_is_npi,
            prog_abt_npi,
            prog_abt_eto,
            prog_euv_eto,
            prog_acm_npi,
            prog_acm_eto,
            prog_general,
        ]
    )
    db.commit()
    print("Programs created.")

    # ============================================================
    # 9. Sample Projects
    # ============================================================
    admin_user = db.query(User).filter(User.email == "admin@edwards.com").first()
    pm_id = admin_user.id if admin_user else None

    projects_data = [
        {
            "code": "406372",
            "name": "Gen3+, HRSD, H2D-HP x 2, HVM",
            "program_id": "EUV_NPI",
            "project_type_id": "NPI",
            "status": "InProgress",
            "customer": "TSMC HVM",
        },
        {
            "code": "406422",
            "name": "Gen3+ SMM2",
            "program_id": "EUV_NPI",
            "project_type_id": "NPI",
            "status": "Completed",
            "customer": "ASML",
        },
        {
            "code": "406376",
            "name": "Gen4, Kanarra",
            "program_id": "EUV_NPI",
            "project_type_id": "NPI",
            "status": "OnHold",
            "customer": None,
        },
        {
            "code": "406397",
            "name": "2025 Ruby - SIC integration",
            "program_id": "IS_NPI",
            "project_type_id": "NPI",
            "status": "InProgress",
            "customer": None,
        },
        {
            "code": "406399",
            "name": "2025 Havasu",
            "program_id": "IS_NPI",
            "project_type_id": "NPI",
            "status": "InProgress",
            "customer": "TEL",
        },
        {
            "code": "406437",
            "name": "2025 EUV Gen4 Phase 1 Tumalo",
            "program_id": "IS_NPI",
            "project_type_id": "NPI",
            "status": "InProgress",
            "customer": None,
        },
        {
            "code": "406420",
            "name": "2025 Protron | Single ROW",
            "program_id": "ABT_NPI",
            "project_type_id": "NPI",
            "status": "InProgress",
            "customer": None,
        },
        {
            "code": "404721",
            "name": "EUV TSMC Gen3 H2D-R(TS marked)",
            "program_id": "EUV_ETO",
            "project_type_id": "ETO",
            "status": "InProgress",
            "customer": "TSMC",
        },
        {
            "code": "406362",
            "name": "2025 NRTL (DTLR / ARS)",
            "program_id": "ACM_NPI",
            "project_type_id": "NPI",
            "status": "InProgress",
            "customer": "SEC",
        },
    ]

    for p in projects_data:
        proj = Project(
            id=str(uuid.uuid4()),
            code=p["code"],
            name=p["name"],
            program_id=p["program_id"],
            project_type_id=p["project_type_id"],
            status=p["status"],
            customer=p.get("customer"),
            pm_id=pm_id,
        )
        db.add(proj)
    db.commit()
    print(f"Created {len(projects_data)} sample projects.")

    print("Data initialization complete!")
