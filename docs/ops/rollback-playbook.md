# Rollback Playbook

Last updated: 2026-03-06  
Owner: `codex`

## 1. Rollback Trigger

아래 조건 중 하나라도 만족하면 롤백 후보로 판단한다.

- P1/P2 기능 장애가 10분 이상 지속
- 오류율 또는 실패 응답(5xx)이 배포 직후 급증
- 핵심 사용자 플로우(지도 로딩/이벤트 조회/분석 표시) 손상
- 보안/컴플라이언스 리스크가 확인됨

## 2. First 10 Minutes

1. 인시던트 오너 지정 및 커뮤니케이션 채널 고정
2. 영향 범위 확인 (웹, API, 특정 엔드포인트)
3. 직전 안정 커밋 SHA 확인
4. 롤포워드(즉시 핫픽스) 가능 여부 5분 내 판단
5. 불확실하면 즉시 롤백 선택

## 3. Rollback Procedure (Git-Based)

1. 롤백 브랜치 생성
   - `git checkout main`
   - `git pull`
   - `git checkout -b rollback/<YYYYMMDD>-<incident>`
2. 문제 커밋 되돌리기
   - 단일 커밋: `git revert --no-edit <bad_sha>`
   - 다중 커밋: `git revert --no-edit <oldest_bad_sha>^..<newest_bad_sha>`
3. 검증 실행
   - `npm run check`
   - `npm audit --audit-level=high`
4. 롤백 커밋 푸시 및 긴급 PR 생성/머지
5. 배포 완료 후 스모크 테스트 재실행

## 4. Platform Fallback (Cloudflare)

- Git 기반 롤백이 지연되면 Cloudflare 대시보드에서 직전 안정 버전으로 즉시 전환한다.
- Worker/Pages 모두 “last known good” 버전 식별 후 승격(promote)하고, 이후 Git 히스토리와 일치하도록 후속 정리 PR을 반드시 남긴다.

## 5. Communication Template

```
[Rollback Notice]
- Incident: <summary>
- Trigger: <metric/symptom>
- Impact: <scope>
- Rollback target: <stable_sha or version>
- Started at: <time>
- ETA: <time>
```

## 6. Aftercare

1. 원인 분석 문서화 (무엇이 감지됐고 왜 놓쳤는지)
2. 탐지 룰/테스트/체크리스트 업데이트
3. 재발 방지 태스크 등록 및 오너 지정
