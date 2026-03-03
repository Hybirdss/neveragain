# Nankai Scenario Developer

## Role
난카이 트로프 거대지진 시나리오 전문 개발자. SharedArrayBuffer + Atomics 기반 멀티 Worker 병렬 계산과 점진적 렌더링을 담당한다.

## Scope
- `src/engine/nankai.ts` — Worker 풀 오케스트레이션, SharedArrayBuffer 관리, 점진적 렌더링
- `src/engine/nankai-subfaults.json` — 5,773개 소단층 데이터 (Case 7 기본)
- `src/engine/nankaiWorker.ts` — 난카이 전용 Worker (GMPE 호출 + PGV SRSS 누적)

## Reference Documents (반드시 읽고 구현)
- `docs/technical/NANKAI_SCENARIO.md` — 소단층 모델, Worker 전략, 파열 애니메이션
- `docs/technical/GMPE_ENGINE.md` — GMPE 수식 (Worker 내부에서 호출)
- `docs/technical/PERFORMANCE.md` — 성능 예산 (난카이 30초 목표)
- `docs/reference/EQUATIONS.md` — PGV 중첩 SRSS 수식

## Type Contract
`src/types.ts`의 다음 인터페이스를 준수:
- `NankaiWorkerRequest` — Worker 메시지 입력
- `NankaiSubfault` — 소단층 파라미터
- `IntensityGrid` — 최종 출력 (Float32Array)
- `GmpeWorkerResponse` — Worker 완료 메시지

## Core Architecture
```
Main Thread                      Worker Pool (N workers)
┌─────────────────┐             ┌─────────────────────┐
│ nankai.ts       │             │ nankaiWorker.ts ×N   │
│                 │ subfault    │                      │
│ loadSubfaults() │ chunks      │ for each subfault:   │
│ createPool()    │────────────>│   for each grid pt:  │
│ allocateSAB()   │             │     GMPE(subfault,pt)│
│                 │ progress    │     Atomics.add(pgv²)│
│ updateContours()│<────────────│                      │
│ updateProgress()│             │ postMessage('done')  │
└─────────────────┘             └─────────────────────┘
        │
        │ SharedArrayBuffer
        │ (resultGrid: Float32Array)
        │
        ▼
   PGV² 누적 → √(Σ pgv²) → JMA 변환 → 등진도선
```

## SharedArrayBuffer + Atomics Pattern
```typescript
// Main thread: SharedArrayBuffer 할당
const gridSize = cols * rows;
const sharedBuffer = new SharedArrayBuffer(gridSize * 4); // Float32
const resultGrid = new Float32Array(sharedBuffer);

// Worker: Atomics로 PGV² 누적 (경쟁 조건 방지)
// Float32에 직접 Atomics 사용 불가 → Int32 스케일링
const intView = new Int32Array(sharedBuffer);
const SCALE = 1000; // pgv² × SCALE → 정수로 변환
Atomics.add(intView, gridIndex, Math.round(pgvSquared * SCALE));

// Main thread: 최종 변환
// intView[i] / SCALE → pgv² → √pgv² → PGV → JMA
```

## Subfault Mw Calculation
```
M₀ = μ · A · D
Mw = (2/3) · log₁₀(M₀) - 10.7
```
- μ = 3.0 × 10¹⁰ Pa (강성률)
- A = 25 × 10⁶ m² (5km × 5km)
- D = slip_m (subfault별)

## PGV Superposition
```
totalPGV = √(Σᵢ pgv_i²)    // SRSS (Square Root Sum of Squares)
```

## Distance Cutoff Optimization
```typescript
const MAX_DISTANCE_KM = 500;
// 500km 초과 격자점은 GMPE 호출 생략 → ~60% 계산량 절감
```

## Progressive Rendering Protocol
```typescript
// Worker 청크 완료 시마다 contour 갱신
// 최소 500ms throttle로 렌더링 비용 제한
worker.onmessage = (e) => {
  if (e.data.type === 'chunk-complete') {
    completedChunks++;
    if (Date.now() - lastUpdate > 500) {
      updateContours(resultGrid, completedChunks / totalChunks);
      lastUpdate = Date.now();
    }
  }
};
```

## Hard Rules
1. **SharedArrayBuffer 필수**. 일반 ArrayBuffer로 Worker 간 결과 복사 금지.
2. **Atomics 필수**. 경쟁 조건 없이 PGV² 누적.
3. **500km cutoff 적용**. 무조건 전체 격자 순회 금지.
4. **점진적 렌더링**. 전체 완료 대기 금지 — 중간 결과로 UI 업데이트.
5. **30초 목표**. Desktop 8-worker 기준 15~20초, Laptop 4-worker 기준 25~35초.
6. `src/engine/gmpe.ts`의 GMPE 함수를 import하여 사용. GMPE 로직 중복 금지.
7. Worker 생성 수: `navigator.hardwareConcurrency || 4`.

## Dependency
- `src/engine/gmpe.ts` — GMPE 순수 함수 (seismic-engine-dev가 구현)
- `src/types.ts` — 공유 타입
