# Consumer-First, Evidence-Layer UX Design

**Date:** 2026-03-06
**Status:** Approved in session
**Primary Persona:** 방금 흔들림을 느낀 일반인
**Supporting Persona:** 전문가/방재/보도 사용자

## Goal

첫 3초 안에 일반 사용자가 `지금 어떤 의미인지`를 이해하게 만들고, 같은 사건 화면 안에서 전문가가 `근거`, `비교`, `공유 가능한 출력`까지 바로 확인할 수 있게 만든다.

## Problem Definition

현재 제품은 사건의 `의미`보다 `수치`를 먼저 보여준다. 그 결과 일반인은 `그래서 나는 괜찮은가?`에 답을 받기 전에 좌표, 깊이, 규모, 탭 구조를 먼저 해석해야 한다.

핵심 문제는 네 가지다.

1. 첫 화면이 여전히 분석 도구처럼 보인다.
2. 쓰나미/행동 같은 안전 정보가 충분히 돌출되지 않는다.
3. AI 해설이 제품 차별점인데 첫 인상에서 약하다.
4. 전문가가 신뢰를 쌓는 데 필요한 근거와 비교, 요약 출력이 한 흐름으로 연결되지 않는다.

## Product Decision

`일반 모드`와 `전문가 모드`를 분리하지 않는다.

대신 `한 사건, 여러 깊이` 구조로 간다.

- Layer 1: 즉시 판단
- Layer 2: 이해
- Layer 3: 검증

첫 화면은 일반인용으로 단순해야 한다. 다만 단순화는 `정보 삭제`가 아니라 `우선순위 재배열`이어야 한다. 전문가 정보는 같은 사건 패널 안에서 한두 단계 아래에 배치한다.

## UX Principles

### 1. Meaning First

가장 먼저 보여줄 것은 `M4.2`, `34.5N`, `12km`가 아니다.  
가장 먼저 보여줄 것은 `오사카에서 진도 4 수준의 흔들림. 실내 낙하물 주의. 쓰나미 걱정 없음.` 같은 해석이다.

### 2. Safety Breaks Through

쓰나미와 행동 가이드는 어떤 탭이나 접힘 구조 아래에 숨어 있으면 안 된다. 항상 사건 카드와 상세 패널 상단에서 보이게 한다.

### 3. Evidence On Demand

전문가에게 필요한 것은 별도 앱이 아니라 빠른 검증 경로다.  
같은 패널에서 근거 카드, 유사 사건 비교, 데이터 섹션, 복사 가능한 요약까지 바로 내려갈 수 있어야 한다.

### 4. Same Event, Multiple Depths

같은 지진을 두 개의 별도 경험으로 쪼개지 않는다. 일반인은 결론으로 시작하고, 전문가는 같은 결론의 근거를 더 깊게 본다.

## Recommended Scope

이번 1차 범위는 `UI 우선순위 재구성`이다. 백엔드 파이프라인 교체나 새로운 AI 생성 플로우 추가는 범위에서 제외한다.

포함:

- Hero 사건 카드 추가
- 최근 지진 리스트 단순화
- 상세 패널을 의미 중심으로 재구성
- 전문가용 Evidence 섹션과 빠른 출력 액션 추가
- 모바일 peek/half/full 경험을 같은 원칙으로 정렬

제외:

- 새 AI 모델/프롬프트 설계
- JMA 신규 소스 연동
- 전체 상태 머신 재설계
- 별도 전문가 전용 모드

## Current Code Constraints

현재 구조를 기준으로 보면 초기 리팩터링은 `재사용 가능한 뷰모델 계층`이 먼저다.

- `apps/globe/src/ui/analysisPanel.ts`는 레거시 필드 이름(`dashboard.one_liner`, `public.why` 등)에 의존한다.
- `packages/db/types.ts`의 `EarthquakeAnalysis` 계약은 현재 UI가 읽는 구조와 다르다.
- 따라서 1차 구현에서 `db 타입을 그대로 UI에 주입`하면 범위가 커지고 리스크가 높다.

결론:

1. `store.ai.currentAnalysis`는 당장 전역 계약을 대수술하지 않는다.
2. UI 앞단에 `analysis adapter + presentation view-model`을 세운다.
3. Hero 카드, 리스트, 상세 패널은 이 뷰모델만 읽는다.

## Information Architecture

### Layer 1: Immediate Judgment

첫 화면에서 보여줄 핵심 정보:

- AI headline 또는 fallback plain-language summary
- 쓰나미 상태
- 체감 진도 의미
- 발생 시각/위치

여기서 일반 사용자의 질문 세 개에 답해야 한다.

1. 어디서?
2. 얼마나?
3. 지금 뭘 신경 써야 하나?

### Layer 2: Explanation

상세 패널 기본 열린 섹션:

- 왜 이런 지진인지
- 여진 가능성
- 행동 가이드
- 체감 강도 설명

### Layer 3: Evidence

상세 패널의 접힌 섹션 또는 하위 카드:

- 근거/데이터
- 유사 과거 지진 비교
- 전문가용 텍스트 요약
- 복사/공유 액션

## Screen Structure

### Desktop

- 글로브는 풀스크린 배경 유지
- 좌측 패널 상단에 `Hero 사건 카드`
- 그 아래 `Recent 리스트`
- 사건 선택 시 `Detail + Evidence`가 같은 패널 안에서 확장

### Mobile

- 기존 `mobileSheet`를 유지하되 내용 우선순위를 재배열
- Peek 상태에서 숫자보다 `의미 있는 한 줄`이 먼저 보이게 함
- Half 상태는 리스트
- Full 상태는 상세 패널 + Evidence

## Component Strategy

### 1. Presentation Adapter Layer

새 순수 함수 계층을 추가해 이벤트, 쓰나미 평가, AI 분석을 다음 UI 단위로 변환한다.

- hero summary
- list row summary
- detail header model
- evidence model
- copy/share summary

이 계층이 있어야 UI 테스트 인프라 없이도 핵심 논리를 Vitest로 회귀 검증할 수 있다.

### 2. Hero Card

`leftPanel`과 `mobileSheet`에 공통 개념으로 도입한다.

필수 상태:

- 분석 있음
- 분석 로딩
- 분석 없음
- 최근 유의미한 지진 없음

### 3. Live Feed Simplification

최근 리스트는 `탐색` 역할만 맡는다.

- 깊이/좌표는 기본 리스트에서 제거
- 장소, 상대 시각, 규모, 짧은 해석만 유지
- 여진 군집은 요약 배지로 유지

### 4. Detail Panel Reframe

상세 패널 상단은 `규모 + 장소`가 아니라 `상황 의미`를 기준으로 재배치한다.

- 큰 진도 의미
- 쓰나미 카드
- AI 설명
- 행동 가이드
- 전문가 섹션

### 5. Evidence Actions

전문가/보도 사용자를 위해 최소한 아래는 1차에 포함한다.

- 근거 섹션
- 유사 사건 비교
- 복사 가능한 짧은 요약
- 프레젠테이션/공유 확장용 액션 슬롯

## State and Data Flow

1. `selectedEvent`, `tsunamiAssessment`, `ai.currentAnalysis`, `intensitySource`를 입력으로 사용한다.
2. 새 `presentation` helper가 이 입력들을 UI 친화적인 뷰모델로 바꾼다.
3. `leftPanel`, `liveFeed`, `detailPanel`, `mobileSheet`는 store raw state 대신 뷰모델을 읽는다.
4. 서버 API나 실시간 ingest 흐름은 1차에서 변경하지 않는다.

## Error Handling and Safety

### Missing AI analysis

AI가 없으면 빈 상태를 보여주지 말고 이벤트/진도/쓰나미 기반 fallback plain-language 문장을 만든다.

### Stale or missing network data

기존 상태 바를 유지하되, Hero 카드에 `마지막 업데이트`를 약하게 노출해 신뢰성을 보강한다.

### Tsunami uncertainty

위험이 불명확할 때는 안심 문구보다 `공식 정보 확인` 쪽으로 기울인다. 안전 관련 카피는 과도한 낙관을 피한다.

### Contract drift

AI payload 구조가 바뀌어도 adapter 한 곳에서 흡수하도록 만든다. UI 컴포넌트가 직접 raw analysis shape를 파싱하지 않게 한다.

## Success Metrics

### User-facing

- 첫 화면에서 3초 안에 현재 상황 의미를 이해할 수 있어야 한다.
- 모바일 peek 상태만으로도 핵심 사건의 의미가 전달되어야 한다.
- 전문가 사용자는 2번 이하의 상호작용으로 근거/비교/복사 가능한 요약에 도달해야 한다.

### Engineering

- 기존 realtime/store/orchestrator 구조를 유지한다.
- 핵심 표현 로직은 순수 함수 테스트로 회귀 보호한다.
- 새 UI는 기존 빌드와 Vitest를 깨지 않아야 한다.

## Rollout Order

1. Adapter/view-model 계층
2. Hero 카드
3. 리스트 단순화
4. 상세 패널 재구성
5. Evidence/summary actions
6. 반응형/i18n/visual polish

## Decision Summary

이 작업의 본질은 예쁜 리디자인이 아니다.  
`데이터 중심 지진 도구`를 `의미 중심 사건 해설 인터페이스`로 재정렬하는 일이다.

첫 화면은 일반인을 위한 결론을, 그 아래는 전문가를 위한 검증 경로를 제공해야 한다.
