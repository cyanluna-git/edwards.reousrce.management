# 보고서형 PPT 생성 — 시나리오 → HTML → 이미지 → 편집 가능 PPT

## 개요
`report-scenario.md` 기반 8페이지 영문 보고서 PPT를 4개 버전으로 발전시켰다. HTML 슬라이드 디자인 → Playwright 스크린샷 → python-pptx 조립 파이프라인과, 최종적으로 모든 요소가 편집 가능한 PPT를 생성했다. 추가로 카드뉴스 7장도 제작.

## 주요 변경사항
- **v1**: python-pptx로 한국어 편집 가능 PPT 직접 생성 (304KB)
- **v2**: HTML 슬라이드 → Playwright 2x 스크린샷 → AC 템플릿 PPT 조립 (11.2MB, 이미지 기반)
- **v3**: 폰트 20-30% 확대, 콘텐츠 밀도 개선 (12MB, 이미지 기반)
- **v4 (최종)**: AC 디자인 시스템 적용 + 모든 요소 편집 가능 (8.6MB, 텍스트/테이블/도형 편집 가능)
- **카드뉴스**: 600x600 인스타그램 카드 7장 (스카이블루 배경, 한국어)
- **카드뉴스 스킬 수정**: macOS 한국어 폰트 경로(`AppleSDGothicNeo.ttc`) 추가

## 핵심 파일
| 파일 | 설명 |
|------|------|
| `docs/introduction/slides.html` | HTML 슬라이드 디자인 소스 (v3 폰트 확대 반영) |
| `docs/introduction/capture-slides.js` | Playwright 스크린샷 캡처 |
| `docs/introduction/build-ppt.py` | 템플릿 + 스크린샷 → PPT 조립 (v2/v3) |
| `docs/introduction/generate-ppt.py` | v1 한국어 편집 가능 PPT 생성기 |
| `docs/introduction/generate-ppt-editable.py` | v4 영문 편집 가능 PPT 생성기 |
| `docs/introduction/card-news/pob_01~07.png` | 카드뉴스 이미지 7장 |
| `docs/introduction/ac.templete.pptx` | Atlas Copco 회사 PPT 템플릿 |

## PPT 버전 비교
| 버전 | 언어 | 편집 | 크기 | 특징 |
|------|------|------|------|------|
| v1 | 한국어 | 가능 | 304KB | 기본 레이아웃 |
| v2 | 영문 | 불가(이미지) | 11.2MB | AC 디자인, Retina |
| v3 | 영문 | 불가(이미지) | 12MB | 폰트 확대, 밀도 개선 |
| v4 | 영문 | 가능 | 8.6MB | AC 디자인 + 편집 가능 |

## 결과
- v4 편집 가능 PPT 생성 완료 — PowerPoint에서 직접 리터칭 가능
- 카드뉴스 7장 생성 완료 — SNS/사내 공유용
- AC 디자인 시스템 일관 적용 (#054E5A, #E1B77E, Segoe UI)

## 다음 단계
- 슬라이드 8 로드맵 현실화 (SAP 연동, 글로벌 확장 등 과대한 내용 조정)
- 슬라이드 5 Key Message 문구 교체 (채용 중심 → 리소스 플래닝 정교화)
- 실제 발표 후 피드백 반영
- 한국어 버전 필요 시 v4 기반으로 번역
