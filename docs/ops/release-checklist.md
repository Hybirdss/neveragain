# Release Checklist

Last updated: 2026-03-06  
Owner: `codex`

이 체크리스트는 배포 전 품질 증거를 표준화하고, 릴리즈 누락 리스크를 줄이기 위한 운영 기준이다.

## 1. Scope And Ownership

- [ ] 릴리즈 범위(기능/버그/영향 경로)를 PR 본문에 명시
- [ ] 릴리즈 오너 지정
- [ ] 롤백 오너 지정
- [ ] 커뮤니케이션 채널(이슈/채팅방/공지) 지정

## 2. Evidence Before Merge (필수)

- [ ] PR에 아래 명령의 실행 결과 요약 첨부
  - [ ] `npm run check`
  - [ ] `npm audit --audit-level=high`
- [ ] 변경 표면별 검증 근거 첨부 (예: worker route 테스트, UI 회귀 테스트)
- [ ] 알려진 리스크/미해결 항목을 PR에 명시
- [ ] 롤백 기준 커밋(직전 안정 커밋 SHA) 기록

## 3. Pre-Release Verification

- [ ] CI 필수 잡 모두 통과 (`Typecheck`, `Test`, `Build`, `Dependency Audit`)
- [ ] 수동 스모크 확인
  - [ ] `https://namazue.dev` 진입/핵심 화면 로딩 확인
  - [ ] `https://api.namazue.dev/api/events?limit=1` 응답 확인
- [ ] 문서 동기화 확인 (`docs/ops`, `README.md`, 운영 지침)

## 4. Release Execution

- [ ] 최종 배포 커밋 SHA 기록
- [ ] 배포 시작/완료 시각 기록
- [ ] 배포 후 15분 모니터링
  - [ ] API 오류율
  - [ ] 클라이언트 치명 오류
  - [ ] 응답 지연 급증 여부

## 5. Post-Release Signoff

- [ ] 릴리즈 결과 요약 작성 (성공/이슈/조치)
- [ ] 이슈 발생 시 `docs/ops/rollback-playbook.md` 링크 포함
- [ ] 다음 개선 액션을 태스크로 등록
