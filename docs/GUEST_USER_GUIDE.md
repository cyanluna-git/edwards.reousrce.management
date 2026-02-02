# Guest User (Read-Only) 계정 가이드

## 개요

Guest 계정은 시스템을 모니터링하고 데이터를 조회할 수 있지만, 생성/수정/삭제 권한이 없는 읽기 전용(read-only) 계정입니다.

## Guest 계정 생성

### 스크립트 사용

```bash
cd backend
source venv/bin/activate
python scripts/create_guest_user.py
```

또는 비밀번호를 직접 지정:

```bash
python scripts/create_guest_user.py --password "your_secure_password"
```

### 생성되는 계정 정보

- **Email**: `guest@edwardsvacuum.com`
- **Role**: `GUEST` (Read-only)
- **Name**: Guest User
- **Korean Name**: 게스트 사용자
- **Department**: 기본 활성 부서 (자동 선택)
- **Position**: 기본 활성 직급 (자동 선택)

### 기존 계정 업데이트

이미 `guest@edwardsvacuum.com` 계정이 존재하는 경우:
- 기존 계정 정보를 표시합니다
- Role이 GUEST가 아니면 업데이트 여부를 묻습니다
- 비밀번호는 변경하지 않습니다 (별도로 변경 필요)

---

## 권한 시스템

### 역할 (Role)

현재 시스템에서 지원하는 역할:

- **ADMIN**: 모든 권한
- **PM**: Project Manager 권한
- **FM**: Finance Manager 권한
- **USER**: 일반 사용자 권한
- **GUEST**: 읽기 전용 권한 (새로 추가)
- **VIEWER**: 읽기 전용 권한 (새로 추가, GUEST와 동일)

### Read-Only 역할

다음 역할은 읽기 전용 권한을 가집니다:
- `GUEST`
- `VIEWER`

이 역할의 사용자는:
- ✅ GET 요청 (조회) 가능
- ❌ POST 요청 (생성) 불가
- ❌ PUT 요청 (수정) 불가
- ❌ DELETE 요청 (삭제) 불가

---

## API 엔드포인트 보호

### 현재 상태

현재 대부분의 엔드포인트는 인증만 필요하며, 역할 기반 권한 체크가 없습니다.

### Read-Only 보호 적용 방법

POST/PUT/DELETE 엔드포인트에 `require_write_permission()` 의존성을 추가:

```python
from app.core.security import require_write_permission

@router.post("", response_model=WorkLog)
async def create_worklog(
    worklog_in: WorkLogCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_write_permission()),  # 추가
):
    # ... 기존 코드
```

### 보호가 필요한 엔드포인트

다음 엔드포인트들에 read-only 보호를 적용하는 것을 권장합니다:

1. **WorkLogs**
   - `POST /api/worklogs` - 생성
   - `PUT /api/worklogs/{id}` - 수정
   - `DELETE /api/worklogs/{id}` - 삭제

2. **Users**
   - `POST /api/users` - 생성
   - `PUT /api/users/{id}` - 수정
   - `DELETE /api/users/{id}` - 삭제

3. **Projects**
   - `POST /api/projects` - 생성
   - `PUT /api/projects/{id}` - 수정
   - `DELETE /api/projects/{id}` - 삭제

4. **InternalIO / RechargeIO**
   - `POST /api/internal-ios` - 생성
   - `PUT /api/internal-ios/{id}` - 수정
   - `DELETE /api/internal-ios/{id}` - 삭제

---

## 사용 예시

### Guest 계정으로 로그인

```bash
curl -X POST "http://localhost:8004/api/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=guest@edwardsvacuum.com&password=your_password"
```

### 데이터 조회 (성공)

```bash
curl -X GET "http://localhost:8004/api/worklogs" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 데이터 생성 시도 (실패)

Guest 계정으로 POST 요청을 시도하면 (권한 보호가 적용된 경우):

```json
{
  "detail": "Read-only access. This account does not have permission to modify data."
}
```

---

## 보안 고려사항

1. **비밀번호 정책**
   - 최소 8자 이상
   - 복잡한 비밀번호 사용 권장

2. **계정 관리**
   - Guest 계정은 정기적으로 비밀번호 변경
   - 불필요한 계정은 `is_active = FALSE`로 비활성화

3. **권한 검토**
   - Guest 계정이 접근할 수 있는 데이터 범위 검토
   - 민감한 정보 노출 방지

---

## 문제 해결

### 에러: "No active department found"
- 데이터베이스에 활성 부서가 없습니다
- 먼저 부서를 생성하세요

### 에러: "No active job position found"
- 데이터베이스에 활성 직급이 없습니다
- 먼저 직급을 생성하세요

### 에러: "User already exists"
- 이미 `guest@edwardsvacuum.com` 계정이 존재합니다
- 스크립트가 기존 계정 정보를 표시하고 업데이트 여부를 묻습니다

---

## 관련 파일

- `backend/scripts/create_guest_user.py` - Guest 계정 생성 스크립트
- `backend/app/core/security.py` - 권한 체크 함수
- `backend/app/models/user.py` - User 모델 정의

---

## 향후 개선 사항

1. **세밀한 권한 제어**
   - 특정 엔드포인트만 허용/차단
   - 데이터 필터링 (부서별, 프로젝트별)

2. **감사 로그**
   - Guest 계정의 조회 이력 기록

3. **자동 비밀번호 만료**
   - 정기적인 비밀번호 변경 강제
