# Validation Plan

GMPE 정확도 검증 매트릭스 및 성능 벤치마크.
모든 테스트는 각 마일스톤 완료 전에 통과해야 함.

---

## 1. GMPE Accuracy Validation

Si & Midorikawa (1999) GMPE 출력을 역사적 관측 데이터와 비교.
JMA 계기 진도 기준 허용 범위 내에 있어야 함.

### Validation Matrix

| Event | Station | Distance (km) | Observed JMA | Instrumental I_JMA | Acceptable Range |
|---|---|---|---|---|---|
| Tohoku 2011 (Mw 9.0, cap 8.3) | Sendai (仙台) | 170 | 6+ | 6.5 | 5.5 - 7.0 |
| Tohoku 2011 (Mw 9.0, cap 8.3) | Tokyo (東京) | 374 | 5- | 4.5 | 3.5 - 5.5 |
| Kumamoto 2016 (Mw 7.0) | Kumamoto city (熊本市) | 8 | 7 | 6.7 | 5.7 - 7.0 |
| Kumamoto 2016 (Mw 7.0) | Fukuoka (福岡) | 90 | 3 | 3.0 | 2.0 - 4.0 |
| Noto 2024 (Mw 7.5) | Wajima (輪島) | 8 | 7 | 6.8 | 5.8 - 7.0 |
| Noto 2024 (Mw 7.5) | Kanazawa (金沢) | 80 | 5+ | 5.3 | 4.3 - 6.3 |

### Validation Procedure

```
for each preset in [tohoku-2011, kumamoto-2016-main, noto-2024]:
  load parameters from presets.ts
  for each station in preset.validationStations:
    1. R_epi = haversine(epicenter, station)               // km
    2. R_hypo = sqrt(R_epi^2 + depth_km^2)                // km
    3. PGV_600 = gmpe(Mw, depth_km, R_hypo, faultType)    // cm/s
    4. PGV_surface = PGV_600 * 1.41                        // Vs30 보정
    5. I_JMA = 2.43 + 1.82 * log10(PGV_surface)           // 계기 진도
    6. assert: station.acceptableRange[0] <= I_JMA <= station.acceptableRange[1]
    7. log: event, station, R_hypo, expected, computed, delta, PASS/FAIL
```

**Pass Criteria**: 6/6 관측소 모두 허용 범위 내

---

## 2. Known Biases & Limitations

GMPE 모델의 알려진 편향. 문서화하여 사용자/개발자에게 한계를 알림.

### Mw 8.3 Cap
- **원인**: Si & Midorikawa (1999)는 Mw 8.3까지만 검증됨
- **영향**: Tohoku (Mw 9.0) 근거리에서 진도 과소 예측
- **대응**: `min(Mw, 8.3)` 적용. 근거리 정확도는 다중 서브폴트 모델로 보완
- **Nankai (Mw 9.1)**: 반드시 다중 서브폴트 사용

### Point Source Approximation
- **원인**: 단일 점원(point source)으로 모델링
- **영향**: M7+ 대규모 지진에서 단층 파열 영역(수백 km) 내 진도 과소 예측
- **대응**: 큰 지진은 서브폴트 분할 + PGV SRSS (Equation #9)로 합산
- **영향 범위**: 단층 길이의 약 2배 이내 거리에서 유의미한 오차

### No Vs30 Site Correction
- **원인**: 균일 토양 가정 (Vs30 증폭 계수 1.41 고정)
- **영향**: 연약 지반 지역(충적층 등) 과소 예측, 암반 지역 과대 예측
- **대응**: 시뮬레이션 목적으로는 허용 가능. 정밀 분석 시 JSHIS Vs30 맵 필요
- **오차 범위**: +-0.5 JMA 정도

### Distance Attenuation at Long Range
- **원인**: 거리 감쇠 모델이 원거리에서 과소/과대 예측 가능
- **영향**: > 500km에서 불확실성 증가
- **대응**: 시각화 범위를 합리적 진도(JMA >= 1)까지로 제한

---

## 3. Performance Benchmarks

### Target Metrics

| Metric | Target | How to Measure |
|---|---|---|
| Globe FPS | >= 60 fps | `requestAnimationFrame` 기반 카운터, 5초 평균 |
| Single GMPE → contour | < 200ms | `performance.now()` in Worker postMessage → onMessage |
| Nankai scenario (full) | < 30s (8 workers) | `performance.now()` orchestrator start → last contour render |
| Initial page load | < 3s | Lighthouse Performance audit (simulated 4G) |
| USGS fetch latency | < 2s | `fetch` timing (request → response parsed) |
| Memory usage | < 200MB | Chrome DevTools Heap Snapshot (10분 연속 시뮬레이션 후) |

### Performance Test Procedure

```
1. Chrome DevTools Performance 탭 열기
2. 각 프리셋 시나리오로 앱 로드
3. 파동 애니메이션 중 10초 trace 기록
4. 검증:
   - 16.7ms 초과 프레임 없음 (60fps)
   - 100ms 초과 main thread block 없음
   - Worker 메시지 round-trip < 200ms
5. Lighthouse audit 실행 (로드 시간)
6. 실시간 피드 활성 상태에서 10분간 메모리 모니터링
```

### Benchmark Breakdown: Nankai Scenario

난카이 시나리오의 30초 목표 분해:

| Step | Workers | Grid Size | Subfaults | Target Time |
|------|---------|-----------|-----------|-------------|
| Subfault GMPE 계산 | 8 parallel | 200 x 200 | 20+ | < 20s |
| PGV SRSS 합산 | 1 (main) | 200 x 200 | - | < 1s |
| d3-contour 생성 | 1 (main) | 200 x 200 | - | < 2s |
| Globe polygon 렌더링 | - | - | - | < 2s |
| 카메라 + 파동 애니메이션 | - | - | - | < 5s |
| **Total** | | | | **< 30s** |

### Optimization Strategies (성능 미달 시)

| Issue | Strategy |
|-------|----------|
| Globe FPS < 60 | Contour polygon 단순화 (tolerance 증가), 포인트 수 제한, LOD |
| GMPE > 200ms | 그리드 해상도 감소 (200→150→100), WASM 고려 |
| Nankai > 30s | Worker 수 증가 (8→12), SharedArrayBuffer 사용, 그리드 해상도 동적 조정 |
| Page load > 3s | Code splitting (globe.gl lazy load), 텍스처 압축, 프리셋 데이터 lazy load |
| Memory > 200MB | 이전 레이어 dispose, 이벤트 히스토리 버퍼 제한, Worker 메모리 해제 |

---

## 4. Visual Validation Checklist

수동 검사 항목. 각 마일스톤 완료 시 확인.

### Isoseismal Contours
- [ ] 진앙 중심 동심원/타원 형태
- [ ] JMA 공식 색상 테이블과 일치 (JMA_INTENSITY_COLORS.md)
- [ ] 35% opacity fill, 70% opacity stroke
- [ ] Globe 지형이 contour를 통해 보임
- [ ] Tohoku: 홋카이도~간토 범위, Kobe: 간사이 주변 소규모

### Wave Ring Animations
- [ ] P파 시안, 얇은 링, 선행
- [ ] S파 빨강, 두꺼운 링, P파 후행
- [ ] P파 3.09 deg/s, S파 1.80 deg/s 속도 일치
- [ ] maxRadius 도달 후 링 제거 (메모리 누수 없음)

### Depth Visualization
- [ ] 얕은 지진 (< 30km): 빨강/오렌지, 지표면 근처
- [ ] 중간 깊이 (30-300km): 노랑/녹색, 지표면 아래 표시
- [ ] 깊은 지진 (> 300km): 시안/청색, 깊이 표현 확연
- [ ] Globe opacity 0.72로 깊이 포인트 투과 가능

### Camera Choreography
- [ ] 초기 뷰: 일본 중심 (lat 36, lng 138, alt 2.5)
- [ ] Idle: 0.3 RPM 자전, 인터랙션 시 중단, 10초 후 재개
- [ ] M7+: 줌인 → 5초 홀드 → 풀백 시퀀스
- [ ] 사용자 override 시 "Go" 버튼 표시

### UI Theme
- [ ] Background #0a0e17 적용
- [ ] Scanline overlay 0.03 opacity
- [ ] Monospace 수치, Sans-serif 라벨
- [ ] M7+ alert bar 빨간 pulse 애니메이션
- [ ] HUD: 좌표, 시뮬레이션 시간, 줌 레벨

---

## 5. Integration Test Scenarios

### 5.1 Full Simulation Pipeline
```
Input: Kumamoto 2016 프리셋 클릭
Pipeline: EarthquakePreset → GMPE Worker → IntensityGrid → d3-contour → GeoJSON → globe.polygonsData
Verify:
  - IntensityGrid 차원 = 200 x 200
  - Contour polygon이 유효한 GeoJSON
  - Globe 렌더링 에러 없음
  - 쿠마모토 주변 동심원 진도 영역 표시
```

### 5.2 Timeline Playback
```
Input: 2024년 일본 M5+ 지진 USGS 쿼리
Actions: 재생 시작 → 일시정지 → 속도 변경 (10x) → 스크럽
Verify:
  - 이벤트가 시간순으로 표시
  - 미래 이벤트가 해당 시간 전에 나타나지 않음
  - 재생/일시정지가 시뮬레이션 시계를 정확히 제어
  - 속도 변경이 비례적으로 적용 (10x = 10배 속도)
  - 스크럽 위치가 현재 시뮬레이션 시간과 일치
```

### 5.3 Real-Time Feed
```
Input: 실시간 피드 활성화
Duration: 3+ 폴링 사이클 (180+ 초)
Verify:
  - 새 이벤트가 Globe에 포인트로 표시
  - 동일 event ID로 중복 포인트 없음
  - M7+ 이벤트 시 alert bar 트리거
  - 피드 에러 시 비차단 알림 (crash 아님)
```

### 5.4 Nankai Scenario End-to-End
```
Input: 난카이 시나리오 선택
Verify:
  - 카메라 scripted path 실행
  - 서브폴트별 progressive contour 표시
  - PGV SRSS 합산 후 최종 등진도선
  - 전체 실행 < 30초
  - 메모리 < 200MB
```

---

## 6. Acceptance Criteria Summary

| Category | Pass Criteria |
|----------|--------------|
| GMPE Accuracy | 6/6 관측소 허용 범위 내 |
| Performance | 6개 벤치마크 모두 충족 |
| Visual | 4개 시각 검증 카테고리 확인 |
| Integration | 4개 통합 테스트 시나리오 통과 |
| Responsive | 768px 너비에서 sidebar → drawer 전환 |
| Error Handling | 정상 운영 중 미처리 예외 없음 |

---

## 7. Test Execution Schedule

| Phase Complete | Tests Run |
|---------------|-----------|
| Phase 2 (Foundation) | GMPE 정확도 매트릭스 (Section 1), 단일 그리드 성능 벤치마크 |
| Phase 3 (Globe) | 시각 검증 (Section 4), Globe FPS 벤치마크 |
| Phase 4 (Dashboard UI) | 통합 테스트 5.2, 5.3 (타임라인, 실시간 피드) |
| Phase 5 (Integration) | 전체 파이프라인 5.1, 난카이 5.4, 모든 성능 벤치마크, Lighthouse, 반응형, 전체 회귀 |
