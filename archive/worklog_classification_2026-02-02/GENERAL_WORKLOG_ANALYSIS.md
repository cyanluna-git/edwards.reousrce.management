# General/Non-Project Worklog 분석 리포트

**총 개수: 22,369개**
**분석일시: 2026-02-02**

---

## 📊 1. Work Type 분포 (Top 10)

| Work Type | 개수 | 비율 | 분류 제안 |
|-----------|------|------|-----------|
| **Meeting & Collaboration** | 7,586 | 33.9% | ⚠️ **NULL로 이동** (내부 미팅) |
| **Documentation** | 2,753 | 12.3% | ⚠️ **분석 필요** (프로젝트별 문서 vs 일반 문서) |
| **General Admin** | 1,894 | 8.5% | ⚠️ **NULL로 이동** (일반 관리 업무) |
| **Review & Approval** | 1,711 | 7.7% | ⚠️ **분석 필요** (프로젝트 리뷰 vs 일반 리뷰) |
| **Lab & Test Setup** | 1,688 | 7.6% | ⚠️ **분석 필요** (실험실 일반 업무 vs 프로젝트 테스트) |
| **Team Management** | 1,236 | 5.5% | ⚠️ **NULL로 이동** (팀 관리 업무) |
| **Design & Development** | 1,230 | 5.5% | ⚠️ **분석 필요** (설계 업무) |
| **Training** | 996 | 4.5% | ⚠️ **NULL로 이동** (교육) |
| **Simulation & Analysis** | 572 | 2.6% | ⚠️ **분석 필요** (시뮬레이션 업무) |
| **Ticket/Issue Resolution** | 451 | 2.0% | ⚠️ **분석 필요** (이슈 해결) |

---

## �� 2. 반복되는 Description 패턴 (10회 이상)

### 🚨 **NULL로 이동해야 할 항목들** (내부 업무)

| Description | 횟수 | 분류 |
|-------------|------|------|
| **연차** | 641 | NULL (휴가) |
| **1 to 1** | 325 | NULL (1:1 미팅) |
| **팀미팅** | 224 | NULL (팀 미팅) |
| **team leader meeting** | 141 | NULL (리더 미팅) |
| **Townhall Meeting** | 141 | NULL (전사 미팅) |
| **휴가** | 96 | NULL (휴가) |
| **건강검진** | 87 | NULL (건강검진) |
| **반차** | 59 | NULL (반차) |
| **1to1** | 52 | NULL (1:1) |
| **meeting** | 43 | NULL (일반 미팅) |
| **Clean up day** | 40 | NULL (정리의 날) |
| **Stand up meeting** | 40 | NULL (스탠드업) |
| **Daily inspection** | 37 | NULL (일일 점검) |
| **concur 작성** | 35 | NULL (비용 처리) |

**→ 총 약 2,100개 추가로 NULL 이동 가능**

---

### 🏢 **프로젝트로 매핑 가능한 항목들**

| Description 패턴 | 횟수 | 프로젝트 제안 |
|-----------------|------|--------------|
| **Catox Concept Design** | 90 | Catox 프로젝트 |
| **Update EUV templates** | 37 | EUV General |
| **EUV Halo OPL Review** | - | EUV 관련 프로젝트 |
| **Gen2 TSG Support** | - | Gen2 프로젝트 |
| **TT nrtl support** | - | TT/NRTL 프로젝트 |
| **BMM4 Elec Support** | - | BMM4 프로젝트 |
| **Dual Degasser CFD** | - | Degasser 프로젝트 |
| **PFA업체미팅** | - | PFA 프로젝트 |
| **TOP Project PTM** | - | TOP 프로젝트 |
| **Design review for IBM** | - | IBM 프로젝트 |
| **Yokogawa** 관련 | - | Yokogawa 프로젝트 |

**→ 프로젝트명/제품명이 명시된 것들**

---

### 📋 **General Admin 유형** (NULL 이동 추천)

| 패턴 | 샘플 |
|------|------|
| **업무 정리/보고** | "일정 정리", "주간업무 보고", "Weekly report update" |
| **문서 작성** | "PDD 작성", "concur 작성", "자료 업데이트" |
| **자원 관리** | "resource review", "자재 정리", "물품 정리" |
| **회사 행사** | "체육대회", "Townhall", "Health & Safety Day" |
| **시스템 관리** | "time attendant 작성", "JAVA Program 문제 해결" |

---

## 💡 3. 키워드 기반 분류 제안

### ✅ **추가 NULL 키워드** (내부 업무)

```python
# 미팅 관련
"1 to 1", "1to1", "팀미팅", "team leader meeting", "townhall",
"stand up", "standup", "coe weekly", "coe innovation", 
"elec abt weekly", "v&v meeting",

# 휴가/건강
"건강검진", "health check", "반휴", "오후 반휴",

# 행사
"clean up day", "체육대회", "learning link",

# 일반 업무
"일정 정리", "업무 정리", "주간업무 보고", "주간 보고",
"daily inspection", "연구동 점검", "자재 정리", "물품 정리",
"concur", "time attendant", "resource review",
```

### 🎯 **추가 프로젝트 키워드**

```python
# 프로젝트/제품명이 명시된 경우
"catox": "Catox Project",
"halo": "EUV Halo",
"gen2": "Gen2",
"bmm": "BMM",
"degasser": "Degasser",
"pfa": "PFA",
"yokogawa": "Yokogawa",
"ibm": "IBM",
"intel": "Intel",
"micron": "Micron",
```

---

## 📈 4. 예상 정리 효과

| 항목 | 현재 | 추가 정리 후 예상 |
|------|------|------------------|
| **General/Non-Project** | 22,369 | ~15,000 (-33%) |
| **NULL (Internal)** | 21,571 | ~29,000 (+34%) |
| **Project 매핑** | 64,517 | ~65,500 (+1.5%) |

---

## 🎯 5. 다음 단계 액션 플랜

### Phase 1: NULL 키워드 확장 (즉시 실행 가능)
- [ ] 1to1, 팀미팅 등 미팅 키워드 추가
- [ ] 건강검진, 반휴 등 휴가 키워드 추가
- [ ] 정리의 날, 체육대회 등 행사 키워드 추가
- [ ] 업무 정리, 자재 정리 등 일반 업무 키워드 추가
- **예상 효과: 2,000-3,000개 추가 NULL 이동**

### Phase 2: 프로젝트 키워드 확장
- [ ] Catox, Halo, Gen2 등 프로젝트명 키워드 추가
- [ ] IBM, Intel, Micron 등 고객사명 키워드 추가
- **예상 효과: 500-1,000개 프로젝트 매핑**

### Phase 3: Work Type 기반 분류
- [ ] "Training" work_type → NULL
- [ ] "Team Management" work_type → NULL
- [ ] "General Admin" work_type → NULL
- **예상 효과: 3,000-4,000개 추가 NULL 이동**

### Phase 4: 수동 검토 필요
- [ ] Documentation (12.3%, 2,753개) - 프로젝트 문서 vs 일반 문서
- [ ] Review & Approval (7.7%, 1,711개) - 프로젝트 리뷰 vs 일반 리뷰
- [ ] Design & Development (5.5%, 1,230개) - 설계 업무 분류

---

**총 예상 정리 가능: 약 7,000개 (31%)**
**남는 General: 약 15,000개 (수동 검토 필요)**

