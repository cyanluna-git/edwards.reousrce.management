"""
Keyword Mappings for AI Worklog Parsing

Consolidated keyword mappings extracted from:
- backend/scripts/update_worklog_by_keywords.py (Project mappings)
- backend/scripts/update_worklog_worktypes.py (Work type mappings)
"""

from typing import List, Tuple

# Project keyword mappings
# Format: (keyword_pattern, project_code, priority)
# Higher priority = checked first (for overlapping keywords)
PROJECT_KEYWORD_MAPPINGS: List[Tuple[str, str, int]] = [
    # Specific project keywords (high priority)
    ("OQC", "888888-160", 100),  # 2510 OQC Digitalization Infrastructure
    ("TUMALO", "406437", 90),  # 2025 EUV Gen4 Phase 1 Tumalo
    ("HAVASU", "406399", 90),  # 2025 Havasu
    ("RUBY", "406397", 90),  # 2025 Ruby - SIC integration
    ("PFAS", "406704", 90),  # 2025 PFAS TF
    ("SAP INTEGRATION", "406546", 85),  # SAP Integration
    ("SAP ", "406546", 80),  # SAP related

    # TFT (medium-high priority)
    ("TFT", "PRJ-40", 75),  # TFT
    ("COST REDUCTION TFT", "PRJ-102", 76),  # EUV Cost Reduction TFT

    # TOP Projects
    ("TOP400", "407183", 70),  # 2510 TOP400 SLED
    ("TOP150", "406435-69", 70),  # 2510 LPLN TOP150 DUAL HVM

    # Unify/Plasma
    ("UNIFY PLASMA", "407053", 65),  # 2506 Unify Plasma Single
    ("UNIFY", "407053", 64),
    ("PLASMA SINGLE", "407053", 63),
    ("SDC PLASMA", "407052", 62),  # 2506 SDC Plasma Single Etch

    # Gen3/Gen4 EUV
    ("GEN4 PHASE 2", "407039", 60),  # 2025 EUV Gen4 Phase 2 Tumalo
    ("GEN4 PHASE 1", "406437", 59),  # 2025 EUV Gen4 Phase 1 Tumalo
    ("GEN4", "406437", 55),  # Default Gen4 to Phase 1
    ("GEN3 PLUS MICRON", "406886-120", 58),  # 2025 EUV Gen3 Plus Micron ID
    ("GEN3+ MICRON", "406886-120", 58),
    ("GEN3 RAPIDUS", "406886", 57),  # Gen3+ Rapidus
    ("GEN3+", "406886", 56),  # Default Gen3+ to Rapidus
    ("GEN3", "406886", 54),

    # H2D/HRS
    ("H2D-HP", "406365", 52),  # 2025 High Performance H2D (1000slm)
    ("H2D HP", "406365", 52),
    ("HIGH PERFORMANCE H2D", "406365", 53),
    ("HRS TRANSITION", "407057-166", 51),  # 2512 HRS Transition
    ("HRS", "406403", 50),  # 2025 Hydrogen Recycling System_KR
    ("H2D 500", "405742", 49),  # H2D 500
    ("H2D", "406365", 48),  # Default H2D

    # Proteus/Protron (Abatement)
    ("PROTRON FIELD CIP", "407266", 47),  # 2512 Protron Field CIP
    ("PROTRON SINGLE ETCH", "406371", 46),  # 2025 PROTRON Single Etch
    ("PROTRON SINGLE ROW", "406420", 45),  # 2025 Protron | Single ROW
    ("PROTRON DUAL ROW", "406363-59", 44),  # 2025 Protron | Dual CVD | PROTRON _ Dual ROW
    ("PROTRON DUAL", "406363", 43),  # Protron | Dual CVD | Abingdon PLC
    ("PROTRON", "406420", 42),  # Default Protron to Single ROW
    ("PROTEUS PYTHON", "PRJ-76", 41),  # Proteus Python Simulator
    ("PROTEUS LEGACY", "406428-18", 40),  # Proteus Legacy Support
    ("PROTEUS", "406428", 39),  # Default Proteus to Proteus HV

    # ACM
    ("ACM NPI", "PRJ-112", 38),  # ACM NPI
    ("ACM ETO", "PRJ-113", 37),  # ACM ETO
    ("ACM CR", "PRJ-119", 36),  # ACM CR (Cost Reduction)
    ("ACM COST REDUCTION", "PRJ-119", 36),
    ("ACM AUDIT", "PRJ-117", 35),  # ACM Audit
    ("ACM ENGINEERING", "PRJ-116", 34),  # ACM Engineering Support
    ("ACM PRE-GATE", "407056", 33),  # ACM Pre-Gate1 Support
    ("DTLR", "PRJ-112", 32),  # ACM related
    ("ARS", "PRJ-112", 31),  # ACM related
    ("ACM", "PRJ-112", 30),  # Default ACM to ACM NPI

    # Abatement
    ("ABATEMENT ETO", "406428-37", 29),  # Abatement ETO Support
    ("ABATEMENT TSG", "PRJ-38", 28),  # Abatement TSG Support
    ("ARECA", "406428", 27),  # Abatement/Proteus related
    ("FOREST", "406428", 26),  # Abatement related
    ("ABATEMENT", "406428-37", 25),  # Default Abatement

    # EUV General
    ("EUV TSG", "PRJ-36", 24),  # EUV TSG Support
    ("EUV ETO", "404721", 23),  # EUV ETO Support
    ("EUV GENERAL", "406442", 22),  # EUV General
    ("EUV COST REDUCTION", "PRJ-102", 21),  # EUV Cost Reduction TFT

    # Sustaining categories (lower priority - catch-all)
    ("FIELD FAILURE", "888888", 15),  # Sustaining _ Field failure corrective action
    ("FACTORY SUPPORT", "888888-152", 14),  # Sustaining _ Ops/Factory support
    ("PRODUCT IMPROVEMENT", "888888-153", 13),  # Sustaining _ Product improvement
    ("PK COST REDUCTION", "888888-154", 12),  # Sustaining _ PK cost reduction
    ("REGULATORY", "888888-155", 11),  # Sustaining _ Product regulatory & compliance
    ("COMPLIANCE", "888888-155", 11),
    ("SERVICE SUPPORT", "888888-156", 10),  # Sustaining _ Service/sales support
    ("SALES SUPPORT", "888888-156", 10),
    ("SUSTAINING", "888888", 9),  # Default Sustaining
]

# Work type keyword mappings
# Format: (keyword, category_code, priority)
WORKTYPE_KEYWORD_MAPPINGS: List[Tuple[str, str, int]] = [
    # Engineering - Design
    ("DESIGN REVIEW", "ENG-DES-REV", 100),
    ("DR MEETING", "ENG-DES-REV", 99),
    ("PDR", "ENG-DES-REV", 98),
    ("CDR", "ENG-DES-REV", 98),
    ("설계 리뷰", "ENG-DES-REV", 97),
    ("CONCEPT DESIGN", "ENG-DES-CON", 96),
    ("FEASIBILITY", "ENG-DES-CON", 95),
    ("선행", "ENG-DES-CON", 94),
    ("DETAILED DESIGN", "ENG-DES-DTL", 93),
    ("상세 설계", "ENG-DES-DTL", 92),
    ("SCHEMATIC", "ENG-DES", 85),
    ("CIRCUIT DESIGN", "ENG-DES", 84),
    ("회로 설계", "ENG-DES", 83),
    ("DRAWING", "ENG-DES", 82),
    ("도면", "ENG-DES", 81),
    ("P&ID", "ENG-DES", 80),
    ("CAD", "ENG-DES", 79),
    ("3D MODEL", "ENG-DES", 78),
    ("설계", "ENG-DES", 70),

    # Engineering - Software
    ("CODING", "ENG-SW-COD", 90),
    ("코딩", "ENG-SW-COD", 89),
    ("IMPLEMENTATION", "ENG-SW-COD", 88),
    ("구현", "ENG-SW-COD", 87),
    ("DEBUGGING", "ENG-SW-DBG", 86),
    ("디버깅", "ENG-SW-DBG", 85),
    ("UNIT TEST", "ENG-SW-TST", 84),
    ("단위 테스트", "ENG-SW-TST", 83),
    ("SOFTWARE DEVELOPMENT", "ENG-SW", 75),
    ("SW DEVELOPMENT", "ENG-SW", 74),
    ("PYTHON", "ENG-SW", 70),
    ("PLC PROGRAM", "ENG-SW", 69),
    ("HMI", "ENG-SW", 68),
    ("MODBUS", "ENG-SW", 67),
    ("개발", "ENG-SW", 65),

    # Engineering - Simulation
    ("SIMULATION", "ENG-SIM", 80),
    ("시뮬레이션", "ENG-SIM", 79),
    ("FEA", "ENG-SIM", 78),
    ("CFD", "ENG-SIM", 77),
    ("ANALYSIS", "ENG-SIM", 70),
    ("분석", "ENG-SIM", 69),
    ("FTIR", "ENG-SIM", 68),

    # Engineering - Verification
    ("VERIFICATION", "ENG-VV", 75),
    ("VALIDATION", "ENG-VV", 74),
    ("검증", "ENG-VV", 73),
    ("FAT", "ENG-VV", 72),
    ("SAT", "ENG-VV", 71),
    ("테스트", "ENG-VV", 60),

    # Engineering - Hardware
    ("WIRING", "ENG-HW", 70),
    ("배선", "ENG-HW", 69),
    ("HARNESS", "ENG-HW", 68),
    ("PCB", "ENG-HW", 67),
    ("ELECTRICAL", "ENG-HW", 65),

    # Project - Meetings (more specific)
    ("WEEKLY MEETING", "PRJ-MTG-UPD", 85),
    ("DAILY MEETING", "PRJ-MTG-UPD", 84),
    ("STATUS MEETING", "PRJ-MTG-UPD", 83),
    ("정기 미팅", "PRJ-MTG-UPD", 82),
    ("KICKOFF", "PRJ-MTG-DEC", 81),
    ("킥오프", "PRJ-MTG-DEC", 80),
    ("DECISION", "PRJ-MTG-DEC", 79),
    ("의사결정", "PRJ-MTG-DEC", 78),
    ("CUSTOMER MEETING", "PRJ-MTG-EXT", 77),
    ("고객 미팅", "PRJ-MTG-EXT", 76),
    ("VENDOR MEETING", "PRJ-MTG-EXT", 75),
    ("INTERNAL MEETING", "PRJ-MTG-INT", 74),
    ("내부 미팅", "PRJ-MTG-INT", 73),
    ("TEAM MEETING", "PRJ-MTG-INT", 72),
    ("팀 미팅", "PRJ-MTG-INT", 71),
    ("PROBLEM SOLVING", "PRJ-MTG-PRB", 70),
    ("TROUBLESHOOTING MEETING", "PRJ-MTG-PRB", 69),
    ("이슈 미팅", "PRJ-MTG-PRB", 68),
    ("INFORMATION SHARING", "PRJ-MTG-INF", 67),
    ("정보 공유", "PRJ-MTG-INF", 66),
    ("REPORTING", "PRJ-MTG-REP", 65),
    ("보고", "PRJ-MTG-REP", 64),
    ("FEEDBACK", "PRJ-MTG-FDB", 63),
    ("피드백", "PRJ-MTG-FDB", 62),
    ("[MEETING]", "PRJ-MTG", 50),
    ("미팅", "PRJ-MTG", 49),
    ("MEETING", "PRJ-MTG", 48),
    ("회의", "PRJ-MTG", 47),
    ("논의", "PRJ-MTG", 46),

    # Project - Review
    ("REVIEW", "PRJ-REV", 60),
    ("검토", "PRJ-REV", 59),
    ("APPROVAL", "PRJ-REV", 58),
    ("승인", "PRJ-REV", 57),
    ("리뷰", "PRJ-REV", 55),

    # Project - Planning
    ("PLANNING", "PRJ-PLN", 55),
    ("계획", "PRJ-PLN", 54),
    ("SCHEDULING", "PRJ-PLN", 53),
    ("일정", "PRJ-PLN", 52),

    # Project - Management
    ("MANAGEMENT", "PRJ-MGT", 50),
    ("관리", "PRJ-MGT", 49),

    # Operations - Lab
    ("LAB TEST", "OPS-LAB", 70),
    ("랩 테스트", "OPS-LAB", 69),
    ("TEST BENCH", "OPS-LAB", 68),
    ("EXPERIMENT", "OPS-LAB", 67),
    ("실험", "OPS-LAB", 66),
    ("LAB SETUP", "OPS-LAB", 65),
    ("FIELD/SHOPFLOOR", "OPS-LAB", 60),

    # Operations - Factory
    ("FACTORY SUPPORT", "OPS-FAC", 70),
    ("공장 지원", "OPS-FAC", 69),
    ("LINE SUPPORT", "OPS-FAC-SUP", 68),
    ("라인 지원", "OPS-FAC-SUP", 67),

    # Operations - Equipment
    ("CALIBRATION", "OPS-EQP-CAL", 75),
    ("캘리브레이션", "OPS-EQP-CAL", 74),
    ("MAINTENANCE", "OPS-EQP-PM", 70),
    ("정비", "OPS-EQP-PM", 69),
    ("PREVENTIVE", "OPS-EQP-PM", 68),
    ("예방정비", "OPS-EQP-PM", 67),
    ("CORRECTIVE", "OPS-EQP-CM", 66),
    ("수리", "OPS-EQP-CM", 65),
    ("TROUBLESHOOTING", "OPS-EQP-TRB", 64),
    ("트러블슈팅", "OPS-EQP-TRB", 63),

    # Operations - Installation
    ("INSTALLATION", "OPS-INS", 60),
    ("설치", "OPS-INS", 59),
    ("COMMISSIONING", "OPS-INS", 58),
    ("시운전", "OPS-INS", 57),

    # Quality
    ("QUALITY ASSURANCE", "QMS-QA", 70),
    ("QA", "QMS-QA", 65),
    ("QUALITY CONTROL", "QMS-QC", 70),
    ("QC", "QMS-QC", 65),
    ("INSPECTION", "QMS-QC", 60),
    ("검사", "QMS-QC", 59),
    ("AUDIT", "QMS-CMP", 70),
    ("감사", "QMS-CMP", 69),
    ("COMPLIANCE", "QMS-CMP", 68),
    ("규정", "QMS-CMP", 67),
    ("CERTIFICATION", "QMS-CMP", 66),
    ("인증", "QMS-CMP", 65),
    ("NRTL", "QMS-CMP", 64),
    ("SAFETY", "QMS-SAF", 60),
    ("안전", "QMS-SAF", 59),
    ("EHS", "QMS-SAF", 58),

    # Knowledge - Documentation
    ("DOCUMENTATION", "KNW-DOC", 65),
    ("문서 작성", "KNW-DOC", 64),
    ("DOCUMENT", "KNW-DOC", 60),
    ("MANUAL", "KNW-DOC", 59),
    ("매뉴얼", "KNW-DOC", 58),
    ("CONFLUENCE", "KNW-DOC", 57),
    ("SPEC 작성", "KNW-DOC", 56),
    ("사양서", "KNW-DOC", 55),
    ("문서", "KNW-DOC", 50),
    ("리포트", "KNW-DOC", 49),
    ("작성", "KNW-DOC", 45),

    # Knowledge - Training
    ("TRAINING", "KNW-TRN", 70),
    ("교육", "KNW-TRN", 69),
    ("[TRAINING]", "KNW-TRN", 68),
    ("SEMINAR", "KNW-TRN", 65),
    ("세미나", "KNW-TRN", 64),
    ("TOWNHALL", "KNW-TRN", 63),
    ("ENGINEERING SEMINAR", "KNW-TRN", 62),
    ("민방위", "KNW-TRN", 55),
    ("소방", "KNW-TRN", 54),

    # Knowledge - Self Study
    ("SELF STUDY", "KNW-STD", 70),
    ("자기학습", "KNW-STD", 69),
    ("SELF-STUDY", "KNW-STD", 68),
    ("전화 영어", "KNW-STD", 65),
    ("영어 공부", "KNW-STD", 64),
    ("LEARNING", "KNW-STD", 60),

    # Knowledge - Research
    ("RESEARCH", "KNW-RND", 65),
    ("연구", "KNW-RND", 64),
    ("INVESTIGATION", "KNW-RND", 63),
    ("조사", "KNW-RND", 62),

    # Support - Customer
    ("CUSTOMER SUPPORT", "SUP-CST", 70),
    ("고객 지원", "SUP-CST", 69),
    ("CUSTOMER REQUEST", "SUP-CST", 68),
    ("고객 요청", "SUP-CST", 67),

    # Support - Field
    ("FIELD SERVICE", "SUP-FLD", 70),
    ("필드 서비스", "SUP-FLD", 69),
    ("ON-SITE", "SUP-FLD", 65),
    ("현장", "SUP-FLD", 64),
    ("출장", "SUP-FLD", 60),

    # Support - Issue
    ("ISSUE", "SUP-TKT", 55),
    ("이슈", "SUP-TKT", 54),
    ("TICKET", "SUP-TKT", 53),
    ("지원", "SUP-TKT", 45),

    # Administration - Email
    ("MAIL CHECK", "ADM-EML", 70),
    ("메일 확인", "ADM-EML", 69),
    ("EMAIL", "ADM-EML", 65),
    ("이메일", "ADM-EML", 64),
    ("메일", "ADM-EML", 60),

    # Administration - General
    ("[ETC]", "ADM-GEN", 50),
    ("기타", "ADM-GEN", 45),

    # Administration - Procurement
    ("PROCUREMENT", "ADM-PRC", 65),
    ("구매", "ADM-PRC", 64),
    ("PURCHASING", "ADM-PRC", 63),
    ("발주", "ADM-PRC", 62),

    # Absence
    ("휴가", "ABS-LVE", 90),
    ("LEAVE", "ABS-LVE", 89),
    ("VACATION", "ABS-LVE", 88),
    ("연차", "ABS-LVE", 87),
    ("병가", "ABS-SIC", 85),
    ("SICK", "ABS-SIC", 84),
]

# Korean alias mappings for text preprocessing
PROJECT_ALIASES = {
    # Korean phonetic -> English
    "오큐씨": "OQC",
    "젠3": "GEN3",
    "젠4": "GEN4",
    "젠쓰리": "GEN3",
    "젠포": "GEN4",
    "투말로": "TUMALO",
    "하바수": "HAVASU",
    "루비": "RUBY",
    "프로트론": "PROTRON",
    "프로테우스": "PROTEUS",
    "에이씨엠": "ACM",
    "에이치알에스": "HRS",
    "피파스": "PFAS",
    "유니파이": "UNIFY",
    "플라즈마": "PLASMA",
    "탑400": "TOP400",
    "탑150": "TOP150",
    "이유브이": "EUV",
}

WORKTYPE_ALIASES = {
    # Korean variations -> standard form
    "디자인": "설계",
    "미팅": "회의",
    "트슈": "트러블슈팅",
    "트러블슛": "트러블슈팅",
    "코드": "코딩",
    "프로그래밍": "코딩",
    "SW": "소프트웨어",
    "HW": "하드웨어",
    "문서화": "문서 작성",
    "도큐먼트": "문서",
}


def get_project_code_by_keyword(keyword: str) -> str | None:
    """Get project code by matching keyword."""
    keyword_upper = keyword.upper()
    sorted_mappings = sorted(PROJECT_KEYWORD_MAPPINGS, key=lambda x: -x[2])

    for kw, code, _ in sorted_mappings:
        if kw in keyword_upper:
            return code
    return None


def get_worktype_code_by_keyword(keyword: str) -> str | None:
    """Get work type code by matching keyword."""
    keyword_upper = keyword.upper()
    sorted_mappings = sorted(WORKTYPE_KEYWORD_MAPPINGS, key=lambda x: -x[2])

    for kw, code, _ in sorted_mappings:
        if kw in keyword_upper:
            return code
    return None
