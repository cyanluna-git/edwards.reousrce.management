# LLM Abstraction Layer & Prompt Optimization

## Goal
Replace direct Groq/Gemini client usage with an abstracted LLM layer supporting the new internal PCAS AI Brains Bot (GPT-5), and upgrade all AI prompts from Korean to English for token efficiency and language-adaptive responses.

## Background
- The project previously hardcoded `GeminiClient` or `GroqClient` based on `AI_PROVIDER` setting
- System prompts for summary generation were in Korean, wasting ~40% more tokens
- AI worklog parser included Completed projects in prompts and forced project assignment on team tasks

## Changes

### 1. LLM Abstraction Layer (New)

Created `backend/app/services/llm/` package with Protocol-based abstraction:

```
backend/app/services/llm/
├── __init__.py       # Re-exports LLMClient, get_llm_client
├── base.py           # LLMClient Protocol definition
├── factory.py        # get_llm_client() factory function
└── pcas_client.py    # PCAS AI Brains Bot client (NEW provider)
```

**Key design decisions:**
- `LLMClient` is a `Protocol` (structural typing), not ABC — existing clients comply without inheritance
- `generate_json()` accepts optional `user_email` parameter for PCAS API's UPN requirement
- Factory pattern via `get_llm_client()` reads `AI_PROVIDER` from settings
- All three providers (groq, gemini, pcas) have the same interface

**PCAS-specific:**
- PCAS API requires `user` (UPN email) in every chat request payload
- System prompt is merged into user prompt (PCAS doesn't have separate system message)
- Health check uses two-step: `GET /bot-info` + minimal `POST /chat`
- SSL verification configurable via `PCAS_LLM_VERIFY_SSL` (VPN environments)

### 2. Summary Prompt English Conversion

**File:** `backend/app/services/summary_service.py`

Replaced inline Korean system prompts with English class constants:

| Before | After |
|--------|-------|
| `"""당신은 업무 분석 전문가입니다..."""` (inline, Korean) | `USER_SUMMARY_SYSTEM_PROMPT` (class constant, English) |
| `"""당신은 팀 업무 분석 전문가입니다..."""` (inline, Korean) | `TEAM_SUMMARY_SYSTEM_PROMPT` (class constant, English) |

**New analytical framework in prompts:**
- User summary: Focus areas → Work pattern → Key activities → Observations
- Team summary: Project progress → Member contributions → Risks and observations
- Language-adaptive: "Respond in the SAME LANGUAGE as the worklog descriptions"

**Data labels converted:**
| Korean | English |
|--------|---------|
| `기간:` | `Period:` |
| `총 업무시간:` | `Total hours:` |
| `[프로젝트별 시간]` | `[Hours by Project]` |
| `[업무 카테고리 분포]` | `[Category Distribution]` |
| `[주요 description 샘플]` | `[Description Samples]` |
| `[멤버별 기여]` | `[Member Contributions]` |
| `(주력: ...)` | `(primary: ...)` |

**Added utilization rate metric:**
```python
def _build_utilization_line(self, total_hours, start_date, end_date):
    # Calculates business days (excludes weekends)
    # Output: "Utilization: 36.0h / 40.0h (90%)"
```

**Error messages converted:**
- `"이 기간에 입력된 worklog가 없습니다."` → `"No worklogs found for this period."`
- `"요약 생성 중 오류 발생: ..."` → `"Summary generation failed: ..."`

### 3. Worklog Parser Prompt Improvements

**File:** `backend/app/prompts/worklog_parser.py`

Added Rule 7 for team task handling:
```
7. **Team/organizational tasks** that are NOT tied to a specific project
   MUST have project_id: null and project_name: null
   - Examples: 1:1 meetings, team meetings, training, self-study, admin tasks
   - Only assign a project when clearly related to a specific project
```

**File:** `backend/app/services/ai_worklog_service.py`

Project filtering logic:
- `_load_projects()`: Filters `["Planned", "InProgress"]` — excludes Completed/Cancelled/OnHold
- `_load_user_recent_projects()`: Added same status filter so recently-used but now-Completed projects are excluded

**DB investigation result:**
- `General/Non-Project` → Status: `Completed` → correctly excluded from prompt
- `EUV General` → Status: `Completed` → correctly excluded from prompt
- These were appearing in AI results because fuzzy matching searched the full DB; the new Rule 7 prevents this by instructing the AI to output null for team tasks

### 4. Config & Environment Updates

**File:** `backend/app/core/config.py` — new settings:
```python
PCAS_LLM_KEY: str = ""
PCAS_LLM_BASE_URL: str = "https://groupapp.atlascopco.com/ai-brains/api"
PCAS_LLM_VERIFY_SSL: bool = True
PCAS_LLM_MODEL: str = "gpt-5"
PCAS_LLM_TIMEOUT: int = 30
PCAS_LLM_DEFAULT_UPN: str = ""
```

**File:** `.env.example` — added PCAS section with documentation

## Files Changed

| File | Changes |
|------|---------|
| `backend/app/services/llm/__init__.py` | NEW — Package init, re-exports |
| `backend/app/services/llm/base.py` | NEW — `LLMClient` Protocol |
| `backend/app/services/llm/factory.py` | NEW — `get_llm_client()` factory |
| `backend/app/services/llm/pcas_client.py` | NEW — PCAS AI Brains Bot client |
| `backend/app/services/ai_worklog_service.py` | Refactored to use LLMClient, status filter |
| `backend/app/services/summary_service.py` | English prompts, utilization, error messages |
| `backend/app/services/gemini_client.py` | Added `user_email` param for protocol compliance |
| `backend/app/services/groq_client.py` | Added `user_email` param for protocol compliance |
| `backend/app/prompts/worklog_parser.py` | Rule 7 (team tasks → null project) |
| `backend/app/core/config.py` | PCAS settings |
| `.env.example` | PCAS environment variables |
| `backend/tests/test_ai_worklog.py` | Refactored to provider-agnostic mock |
| `backend/tests/test_pcas_client.py` | NEW — PCAS client unit tests |

## Lessons Learned

1. **PCAS API quirks**: Requires `user` (UPN) in every request — unlike standard OpenAI-compatible APIs. The abstraction layer needed an optional `user_email` parameter to handle this without breaking other providers.

2. **Korean prompts waste tokens**: English system prompts are ~40% smaller. The language-adaptive instruction ("respond in the same language as descriptions") achieves the same Korean output when users write in Korean, without hardcoding the response language.

3. **Fuzzy matching can bypass prompt filters**: Even when `_load_projects()` excludes Completed projects from the prompt list, the `_validate_and_map_entry()` fuzzy matcher searches the full DB. Adding explicit AI instructions (Rule 7) to output null for team tasks is the proper fix at the prompt level.

4. **Utilization rate context helps AI**: Adding `Utilization: 36.0h / 40.0h (90%)` to the prompt data enables the AI to make observations about overtime, underutilization, or workload balance — insights that weren't possible before.

## Next Steps

- [ ] Monitor AI response quality with English prompts vs previous Korean prompts
- [ ] Consider adding project status labels to prompt (e.g., `[InProgress]`, `[Planned]`) for AI awareness
- [ ] Evaluate whether fuzzy matching in `_validate_and_map_entry` should also respect status filters
- [ ] Add PCAS-specific error handling for VPN disconnection scenarios
