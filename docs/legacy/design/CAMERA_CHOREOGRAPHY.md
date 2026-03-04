# Camera Choreography

Globe 카메라 자동 애니메이션 규칙 및 시나리오별 카메라 경로 명세.
globe.gl + Three.js 기반 3D Globe 시각화의 카메라 동작을 정의.

---

## Globe.gl API

모든 카메라 전환은 `pointOfView` 메서드 사용:

```typescript
globe.pointOfView({ lat: number, lng: number, altitude: number }, durationMs: number);
```

Altitude는 지구 반지름 단위 (1.0 = 지표면 레벨).

---

## Constants

모든 카메라 관련 상수. 튜닝 시 이 값들만 수정.

```typescript
const CAMERA = {
  // Initial View (일본 중심)
  INITIAL_LAT: 36,
  INITIAL_LNG: 138,
  INITIAL_ALTITUDE: 2.5,

  // Idle Auto-Rotate
  IDLE_RPM: 0.3,                    // 분당 0.3회전
  IDLE_RESUME_DELAY_MS: 10000,      // 사용자 인터랙션 후 10초 뒤 재개

  // Earthquake Response (규모별 줌 레벨)
  ZOOM_M5: 2.0,
  ZOOM_M6: 1.5,
  ZOOM_M7_PLUS: 1.0,

  // Earthquake Response (전환 시간)
  PAN_DURATION_GENTLE_MS: 1500,     // M5~5.9
  PAN_DURATION_FAST_MS: 1000,       // M6~6.9
  PAN_DURATION_DRAMATIC_MS: 2000,   // M7+
  HOLD_DURATION_M7_MS: 5000,        // M7+ 줌인 유지 시간
  PULLBACK_DURATION_MS: 3000,       // 줌아웃 전환 시간
  PULLBACK_ALTITUDE: 2.5,           // 줌아웃 후 고도

  // User Override
  OVERRIDE_BUTTON_TIMEOUT_MS: 15000,  // "Go" 버튼 자동 해제 시간
} as const;
```

---

## Initial View

앱 시작 시 카메라 위치. 일본 열도 전체가 보이는 앵글.

```typescript
globe.pointOfView({
  lat: CAMERA.INITIAL_LAT,    // 36 N (혼슈 중앙)
  lng: CAMERA.INITIAL_LNG,    // 138 E
  altitude: CAMERA.INITIAL_ALTITUDE,  // 2.5 (지구 반지름의 2.5배)
}, 0);  // 즉시 설정 (애니메이션 없음)
```

altitude 2.5에서 대략 일본 열도 전체 + 한국, 중국 동해안 일부가 시야에 포함됨.

---

## Idle Auto-Rotate

사용자 인터랙션이 없을 때 Globe가 천천히 자전.

1. 앱 시작 시 auto-rotate 활성화
2. 사용자가 Globe를 드래그/줌하면 즉시 비활성화
3. 마지막 인터랙션 후 10초 경과 시 재활성화

```typescript
let idleTimer: ReturnType<typeof setTimeout> | null = null;

function setAutoRotate(enabled: boolean): void {
  const controls = globe.controls();
  controls.autoRotate = enabled;
  controls.autoRotateSpeed = enabled ? CAMERA.IDLE_RPM * 6 : 0;
  // Three.js autoRotateSpeed 1.0 = 30s per rotation
}

function onUserInteraction(): void {
  setAutoRotate(false);
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => setAutoRotate(true), CAMERA.IDLE_RESUME_DELAY_MS);
}

globe.controls().addEventListener('start', onUserInteraction);
```

---

## Earthquake Response

지진 이벤트 발생 시 규모에 따른 카메라 동작.

### Magnitude Response Table

| Magnitude | Camera Action | Target Altitude | Duration | Hold |
|-----------|--------------|-----------------|----------|------|
| < 5.0 | 이동 없음, pulse만 | - | - | - |
| 5.0 - 5.9 | Gentle pan | 2.0 | 1500ms | - |
| 6.0 - 6.9 | Fast pan + tilt | 1.5 | 1000ms | - |
| 7.0+ | Dramatic zoom -> hold -> pullback | 1.0 -> 2.5 | 2000ms + 5s hold + 3000ms | 5s |

### M < 5.0 -- No Camera Movement
```typescript
function handleSmallQuake(eq: EarthquakePoint): void {
  // 카메라 이동 없음, 진앙 포인트에 pulse 애니메이션만 추가
  addPulseEffect(eq.lat, eq.lng, eq.magnitude);
}
```

### M 5.0-5.9 -- Gentle Pan
```typescript
function handleModerateQuake(eq: EarthquakePoint): void {
  globe.pointOfView({
    lat: eq.lat, lng: eq.lng,
    altitude: CAMERA.ZOOM_M5,  // 2.0
  }, CAMERA.PAN_DURATION_GENTLE_MS);  // 1500ms
}
```

### M 6.0-6.9 -- Fast Pan + Tilt
```typescript
function handleStrongQuake(eq: EarthquakePoint): void {
  globe.pointOfView({
    lat: eq.lat, lng: eq.lng,
    altitude: CAMERA.ZOOM_M6,  // 1.5
  }, CAMERA.PAN_DURATION_FAST_MS);  // 1000ms
}
```

### M 7.0+ -- Dramatic Zoom Sequence
```typescript
async function handleMajorQuake(eq: EarthquakePoint): Promise<void> {
  // Phase 1: 드라마틱 줌인 (2초)
  globe.pointOfView({
    lat: eq.lat, lng: eq.lng,
    altitude: CAMERA.ZOOM_M7_PLUS,  // 1.0
  }, CAMERA.PAN_DURATION_DRAMATIC_MS);  // 2000ms

  // Phase 2: 홀드 (5초) -- 등진도선 확산 관찰
  await delay(CAMERA.PAN_DURATION_DRAMATIC_MS + CAMERA.HOLD_DURATION_M7_MS);

  // Phase 3: 느린 풀백 (3초)
  if (!userHasOverridden) {
    globe.pointOfView({
      lat: eq.lat, lng: eq.lng,
      altitude: CAMERA.PULLBACK_ALTITUDE,  // 2.5
    }, CAMERA.PULLBACK_DURATION_MS);  // 3000ms
  }
}
```

---

## User Override

### 취소 조건
- Globe 드래그 (회전)
- Globe 줌 (마우스 휠 / 핀치)
- Globe 클릭 (포인트 선택)

### "Go" Button (M7+ Override)

사용자가 auto-camera를 취소했을 때 진앙으로 이동할 수 있는 버튼:

```
  M7.3 detected -> [Go]
```

```css
.override-btn {
  position: absolute;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg-panel);
  border: 1px solid var(--color-red);
  border-radius: 8px;
  padding: 8px 20px;
  font-family: var(--font-mono);
  color: var(--color-text);
  cursor: pointer;
  z-index: var(--z-hud);
}
```

- 클릭 시 해당 진앙으로 카메라 이동
- `OVERRIDE_BUTTON_TIMEOUT_MS` (15초) 후 자동 해제
- 10초 인터랙션 없으면 idle 회전으로 복귀

---

## Scenario Mode -- Scripted Camera Paths

시나리오 모드에서는 사전 정의된 카메라 경로를 따라 이동.

### Camera Keyframe Interface
```typescript
interface CameraKeyframe {
  lat: number;
  lng: number;
  altitude: number;
  durationMs: number;    // 이 키프레임까지의 전환 시간
  holdMs?: number;       // 도착 후 대기 시간
  label?: string;        // 디버그용 라벨
}

type ScenarioCameraPath = CameraKeyframe[];
```

### Nankai Trough Scenario Path
```typescript
const NANKAI_CAMERA_PATH: ScenarioCameraPath = [
  { lat: 33.0, lng: 137.0, altitude: 2.5, durationMs: 0,    label: 'Initial: 일본 전체 뷰' },
  { lat: 33.0, lng: 137.0, altitude: 1.5, durationMs: 2000, holdMs: 1000, label: '줌인: 난카이 해곡' },
  { lat: 33.5, lng: 135.5, altitude: 1.0, durationMs: 1500, holdMs: 3000, label: '단층 파열 시작' },
  { lat: 34.0, lng: 137.0, altitude: 1.2, durationMs: 5000, label: '파열 전파 추적' },
  { lat: 35.0, lng: 137.0, altitude: 2.0, durationMs: 3000, holdMs: 5000, label: '광역 피해 조망' },
  { lat: 36.0, lng: 138.0, altitude: 2.5, durationMs: 3000, label: '풀백' },
];
```

### Tohoku 2011 Scenario Path
```typescript
const TOHOKU_CAMERA_PATH: ScenarioCameraPath = [
  { lat: 38.3, lng: 142.4, altitude: 2.5, durationMs: 0,    label: 'Initial: 도호쿠 해역' },
  { lat: 38.3, lng: 142.4, altitude: 1.0, durationMs: 2000, holdMs: 2000, label: '진앙 줌인' },
  { lat: 38.0, lng: 141.0, altitude: 1.5, durationMs: 3000, holdMs: 3000, label: '센다이 추적' },
  { lat: 36.0, lng: 140.0, altitude: 2.0, durationMs: 4000, holdMs: 3000, label: '도쿄 도달' },
  { lat: 37.0, lng: 140.0, altitude: 2.5, durationMs: 3000, label: '풀백' },
];
```

### Camera Path Executor
```typescript
async function executeCameraPath(path: ScenarioCameraPath): Promise<void> {
  for (const keyframe of path) {
    globe.pointOfView(
      { lat: keyframe.lat, lng: keyframe.lng, altitude: keyframe.altitude },
      keyframe.durationMs
    );
    await delay(keyframe.durationMs);
    if (keyframe.holdMs) await delay(keyframe.holdMs);
    if (userHasOverridden) break;
  }
}
```

---

## Timeline Mode

타임라인 시퀀스 재생 중 카메라 동작:

- 연속 진앙 사이를 동일한 규모 기반 altitude/tilt 규칙으로 부드럽게 보간
- 재생 시간 기준 3초 이내 두 이벤트: 중간 고도 유지 (두 번의 fly-to 대신)
- 이벤트 간 보간은 구면 선형 보간(slerp) 사용 (globe 내부를 통과하는 직선 경로 방지)

### State Machine
```
IDLE --[select event]--> FLY_TO --[arrival]--> ORBIT --[5s]--> RETURN_TO_IDLE --> IDLE
                                     ^                              |
                                     |                              |
                              [user override]---> USER_CONTROL -----+
                                                     (10s idle)
```

---

## Transition Function Reference

```typescript
// 카메라 이동 (애니메이션)
globe.pointOfView(
  { lat: number, lng: number, altitude: number },
  transitionDurationMs: number
);

// 현재 카메라 위치 가져오기
const pov = globe.pointOfView();

// Three.js controls 직접 접근
const controls = globe.controls();
controls.autoRotate = true;
controls.autoRotateSpeed = 0.9;
controls.enableDamping = true;
controls.dampingFactor = 0.1;
```
