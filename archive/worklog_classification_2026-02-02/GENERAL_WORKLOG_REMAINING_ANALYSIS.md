# 남은 General Worklog 분석 (3차)

**총 개수: 16,174개** (처음 35,565개에서 54.5% 감소)

---

## 📊 Work Type 분포

| Work Type | 개수 | 비율 | 분석 |
|-----------|------|------|------|
| **Meeting & Collaboration** | 5,710 | 35.3% | 프로젝트 관련 미팅 (일반 미팅은 제거됨) |
| **Documentation** | 2,520 | 15.6% | 프로젝트 문서 작업 |
| **Review & Approval** | 1,577 | 9.8% | 설계/문서 리뷰 |
| **Lab & Test Setup** | 1,392 | 8.6% | 실험실 테스트 |
| **Design & Development** | 1,147 | 7.1% | 설계 개발 |
| (NULL) | 1,068 | 6.6% | work_type 없음 |
| **General Admin** | 863 | 5.3% | 일반 관리 (일부 남음) |

---

## 🔍 남은 Description 패턴 분석

### 1️⃣ **프로젝트 관련으로 보이는 항목들**

**특정 프로젝트명 언급:**
- "Catox Concept Design" → Catox 프로젝트
- "PSCL 내부 Review", "PSCL 작업" → PSCL 프로젝트
- "FSSOP" → FSSOP 프로젝트
- "GDAS PDF export" → GDAS 프로젝트

**고객사/파트너사 관련:**
- "Cope with CLK Eng" → CLK
- "Taylor SAR0195D" → Taylor 프로젝트
- "LS PLC 제품" → LS 프로젝트

**특정 시스템/제품:**
- "HMI 개선", "HMI Backup Sequence"
- "DCS 유량 확인"
- "LP pump config"
- "POWER BOX 관련"

### 2️⃣ **NULL로 이동해야 할 항목들** (추가 발견)

**미팅 관련:**
- "cost saving meeting" (비용 절감 미팅)
- "Monthly Meeting 자료 작성"
- "Torch Meeting"
- "resource 미팅"

**행정/이벤트:**
- "입원" (병원)
- "연차" (휴가 - 남아있음)
- "PCAS Opening Ceremony 주차 통제" (행사)

**일반 업무:**
- "OGSM 작성" (목표 관리)
- "감리 대응" (감사 대응)
- "E-req Creation" (일반 요청서)
- "BOM 검토" (일반 BOM)

### 3️⃣ **애매한 케이스들** (수동 검토 필요)

이런 것들은 **프로젝트가 명시되지 않아** 자동 분류가 어려움:

- "Test for NKB963000 system" - NKB963000이 무엇인지?
- "ETO 문의 대응" - 어떤 프로젝트 관련?
- "방폭 인증 준비" - 어떤 제품?
- "3D Modeling 작업" - 어떤 프로젝트?
- "Detail design_pipelines" - 어느 프로젝트 파이프라인?

---

## �� 3차 분류 전략 제안

### Option A: 추가 키워드 확장 (보수적)
```python
# 추가 NULL 키워드
"입원", "주차 통제", "opening ceremony",
"ogsm", "감리", "monthly meeting", "cost saving meeting",
"resource 미팅",

# 추가 프로젝트 키워드
"catox", "pscl", "fssop", "gdas", "taylor", "hmi",
"dcs", "clk",
```
**예상 효과: 1,000-2,000개 추가 분류**

### Option B: Work Type + Description 조합 (중간)
- "Meeting & Collaboration" + "meeting" → NULL
- "General Admin" → NULL (전부)
- **예상 효과: 2,000-3,000개 추가 분류**

### Option C: 공격적 분류 (최대)
- "Meeting & Collaboration" → 전부 NULL
- "General Admin" → 전부 NULL
- "Email & Communication" → 전부 NULL
- **예상 효과: 6,000-7,000개 NULL 이동**
- **리스크: 프로젝트 관련 미팅도 NULL로 이동될 수 있음**

---

## 🎯 추천 액션

**단계별 접근:**

1. **Option A 실행** (안전) → 1-2K개 정리
2. **결과 확인 후 Option B** (중간) → 2-3K개 추가 정리
3. **최종적으로 10,000-12,000개 남김** (수동 검토 대상)

**또는:**

- **Option B 바로 실행** (추천) → 한 번에 3-4K개 정리
- **남은 12,000개는 실제 사용자들이 입력 시 프로젝트를 명시하도록 유도**

---

**어떤 방식으로 진행할까요?**
