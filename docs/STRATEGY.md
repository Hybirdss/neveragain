# Namazue Strategic Plan

## Vision
AI 지진 해설자 — 숫자를 보여주는 대시보드가 아니라, "그래서 뭐가 중요한데"를 말해주는 서비스.

## Personas

### Primary
| ID | Name | Who | Device | Depth |
|----|------|-----|--------|-------|
| P1 | 유레타(揺れた) | 방금 흔들린 일반인 (20-40대) | Mobile | 얕음 |
| P2 | 지진통(地震通) | 매일 보는 코어 유저, 지진 오타쿠 | Both | 중간 |
| P3 | 보사이(防災) | 기업/학교 방재 담당, 부동산 조사 | Desktop | 깊음 |

### Sub
| ID | Name | Who | Device | Depth |
|----|------|-----|--------|-------|
| S1 | 전문가/연구자 | 데이터 분석, 논문 참고 | Desktop | 깊음+ |
| S2 | 뉴스 앵커/보도 | 방송용 시각자료, 원클릭 요약 | Desktop | 중간(시각적) |

## Information Hierarchy (AI-driven)

### Layer 1: 한눈에 — AI가 판단
- AI 한 줄 해석: "震度4 — 棚の物が落ちるかもしれません。津波の心配はありません。"
- 규모/깊이/위치는 서브텍스트
- 색상으로 즉각 판단 (green/yellow/red)
- 쓰나미 경보 시 AI 대피 안내

### Layer 2: 이해하기 — AI가 이야기
- AI 내러티브: 과거 유사 지진과의 맥락 연결
- 유사 지진을 AI가 찾아서 "왜 비슷한지" 설명
- 등진도선 위 AI 코멘트 (지반 약한 지역 등)
- 여진 전망 자연어 해설

### Layer 3: 분석하기 — AI가 도구
- AI + 데이터 결합 분석 (활단층, Vs30, 이력)
- 지역 리스크 AI 요약
- 앵커용 "방송 요약" 원클릭 복사
- 전문가용 팩트 레이어 (AI 근거 데이터 펼치기)

## AI Pipeline

```
새 지진 감지 (WebSocket/USGS)
  → Worker: 유사 과거 지진 검색 (Neon DB, tool call)
  → 사전생성된 과거 분석을 컨텍스트로 활용
  → AI 분석 1회 생성 (서버) → 전체 사용자에게 동일 제공
  → M5.5+: 정보 업데이트마다 AI 분석 갱신
     (기존 컨텍스트 + 새 정보 반영, 변화 이력 보존)
```

## UI Structure

### Design Principles
- 글로브 = 항상 풀스크린 배경. 나머지는 위에 떠있는 레이어
- 다크 톤 유지 + 세련/시크/깔끔
- 정보는 친절하고 시각적 (단층 그림 등, 선만으로 띡 아님)
- 일반인도 이해할 수 있는 시각 언어

### Desktop Layout
- 글로브 100% 배경, 항상 풀스크린
- 좌측: 플로팅 카드 (반투명, 접을 수 있음) — 최근 지진 리스트 + AI 한줄
- 우측: 지진 선택 시 AI 패널 슬라이드인 (접으면 글로브만)
- 하단: 타임라인 바 (24h/7d/30d)
- 프레젠테이션 모드: 패널 전부 숨김 → 방송용

### Mobile Layout
- 글로브 100% 배경
- 바텀시트 기본 상태: 가장 큰 최근 지진의 AI 요약
- 스와이프 업: 지진 리스트
- 탭: 바텀시트 확장 → AI 내러티브 (Layer 2)
- 탭 네비게이션 없음 — 글로브 + 바텀시트로 끝

## UX Flows

### Flow 1: 첫 방문 (모든 페르소나)
```
URL 접속
  → 글로브 로딩 (스켈레톤 + 鯰 로고 스플래시, ~2초)
  → 글로브 등장: 일본 중심 카메라
  → 최근 24h 지진 마커 (큰 것부터 애니메이션)
  → 바텀시트/좌측카드: 가장 큰 최근 지진의 AI 요약
  → 0 클릭으로 가치 전달
```

### Flow 2: 유레타씨 — "방금 흔들렸어"
```
지진 발생 (실시간)
  → [서버] WebSocket 새 지진 감지
  → [서버] 유사 과거 지진 검색 → AI 분석 생성 (5-10초)
  → [클라이언트] 새 마커 펄스 애니메이션
  → [클라이언트] 최상단에 새 지진 슬라이드인 + AI 한줄
  → 탭 → 바텀시트 확장 → Layer 2 AI 내러티브
  → M5.5+: 카메라 자동 이동, AI "생성 중..." → 스트리밍
  → 업데이트 시 "🔄 更新あり" 배지 → 변경점 하이라이트
```

### Flow 3: 지진통씨 — "오늘 뭐 있었지?"
```
매일 접속
  → 24h 마커 + 리스트 (AI 한줄 포함)
  → 관심 지진 탭 → 카메라 이동 + AI 패널 (Layer 2)
  → 등진도선 글로브 오버레이
  → 유사 지진 카드 → 탭하면 해당 지진으로 전환
  → 타임라인 드래그로 범위 변경
  → 글로브 돌리며 탐색
```

### Flow 4: 보사이씨 — "이 지역 안전한가?"
```
검색 (Cmd+K): "渋谷区"
  → 카메라 시부야로 이동
  → 반경 내 과거 지진 이력 표시
  → AI 지역 리포트 자동 생성
  → 오버레이 토글: 활단층 / Vs30 / 히트맵
  → 데이터 내보내기/공유 링크
```

### Flow 5: 앵커씨 — "방송 화면 필요"
```
지진 선택 → "📺 프레젠테이션 모드"
  → 모든 패널 숨김
  → 글로브 + 마커 + 등진도선 + 미니 자막만
  → AI 요약 "📋 복사" → 앵커 원고용
  → ESC → 일반 모드 복귀
```

## State Machine
```
[Idle]                    ← 글로브 + 최근 지진 리스트
  ├─ 지진 탭 ──→ [Detail]  ← AI 패널 + 카메라 이동
  │                ├─ 더보기 ──→ [Analysis]  ← Layer 3 확장
  │                │                └─ 닫기 ──→ [Detail]
  │                └─ 닫기 ──→ [Idle]
  ├─ 검색 ──→ [Search]   ← 검색 모달
  │              └─ 지역선택 ──→ [RegionReport]  ← AI 지역 리포트
  ├─ 새 지진 ──→ [NewQuake]  ← 자동 알림 (M5.5+ 카메라 이동)
  │                └─ 자동 ──→ [Detail]
  └─ 프레젠테이션 ──→ [Presentation]  ← 패널 숨김
                       └─ ESC ──→ [Idle]
```

## Technical Decisions
- Renderer: CesiumJS (keep current)
- Framework: vanilla TypeScript + DOM (no React/Vue)
- UI: full redesign (current code is interim snapshot)
- AI: xAI Grok (realtime) + Gemini (batch pipeline)
- Mobile: 일반인 대상, 직관적
- Desktop: 분석 툴에 가깝게

## Phases
- Phase 1: Core + AI (realtime globe + GMPE + AI analysis) ← NOW
- Phase 2: Realtime chat (tool-calling AI Q&A)
- Phase 3: Nankai scenario simulation
