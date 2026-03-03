# JMA Seismic Intensity Color Scale

일본 기상청(JMA) 진도 계급 공식 색상 정의.
등진도선 렌더링, 범례, UI 표시에 사용.

---

## Color Table

| JMA Scale | Display | Instrumental Range | HEX | RGB | Approximate PGV (cm/s) |
|---|---|---|---|---|---|
| 0 | 震度0 | I < 0.5 | `#9bbfd4` | 155, 191, 212 | < 0.1 |
| 1 | 震度1 | 0.5 <= I < 1.5 | `#6699cc` | 102, 153, 204 | 0.1 - 0.5 |
| 2 | 震度2 | 1.5 <= I < 2.5 | `#3399cc` | 51, 153, 204 | 0.5 - 1.9 |
| 3 | 震度3 | 2.5 <= I < 3.5 | `#33cc66` | 51, 204, 102 | 1.9 - 6.3 |
| 4 | 震度4 | 3.5 <= I < 4.5 | `#ffff00` | 255, 255, 0 | 6.3 - 25 |
| 5- | 震度5弱 | 4.5 <= I < 5.0 | `#ff9900` | 255, 153, 0 | 25 - 40 |
| 5+ | 震度5強 | 5.0 <= I < 5.5 | `#ff6600` | 255, 102, 0 | 40 - 60 |
| 6- | 震度6弱 | 5.5 <= I < 6.0 | `#ff3300` | 255, 51, 0 | 60 - 100 |
| 6+ | 震度6強 | 6.0 <= I < 6.5 | `#cc0000` | 204, 0, 0 | 100 - 200 |
| 7 | 震度7 | I >= 6.5 | `#990099` | 153, 0, 153 | > 200 |

---

## PGV to JMA Conversion Reference

PGV(cm/s) → JMA 계기 진도 변환: `I_JMA = 2.43 + 1.82 * log10(PGV)`

| PGV (cm/s) | I_JMA | JMA Scale |
|------------|-------|-----------|
| 0.1 | 0.61 | 1 |
| 0.5 | 1.88 | 2 |
| 1.0 | 2.43 | 2 |
| 2.0 | 2.98 | 3 |
| 5.0 | 3.70 | 4 |
| 10.0 | 4.25 | 4 |
| 20.0 | 4.80 | 5- |
| 30.0 | 5.12 | 5+ |
| 50.0 | 5.52 | 6- |
| 80.0 | 5.89 | 6- |
| 100.0 | 6.07 | 6+ |
| 150.0 | 6.39 | 6+ |
| 200.0 | 6.62 | 7 |

---

## 체감 설명 (Sensation Description)

| JMA Scale | 체감 (일본어) | 체감 (한국어) | 영어 |
|---|---|---|---|
| 0 | 人は揺れを感じない | 사람이 흔들림을 느끼지 못함 | Not felt |
| 1 | 屋内で静かにしている人の一部が揺れを感じる | 실내에서 조용히 있는 일부가 느낌 | Felt by some indoors |
| 2 | 屋内で静かにしている人の大半が揺れを感じる | 실내에서 조용히 있는 대부분이 느낌 | Felt by most indoors |
| 3 | 屋内にいる人のほとんどが揺れを感じる | 실내 대부분이 느끼고 그릇이 흔들림 | Felt by all, dishes rattle |
| 4 | つり下がっている物が大きく揺れる | 매달린 물건이 크게 흔들림, 불안감 | Hanging objects swing wildly |
| 5- | 大半の人が恐怖を覚え、物につかまりたいと感じる | 대부분 공포, 고정 안 된 물건 이동 | Unsecured items fall |
| 5+ | 大半の人が物につかまらないと歩くことが難しい | 잡지 않으면 걷기 어려움 | Difficulty walking |
| 6- | 立っていることが困難になる | 서 있기 어려움, 고정 안 된 가구 전도 | Difficult to stand |
| 6+ | 立っていることができず、はわないと動けない | 서 있을 수 없음, 기어야 이동 가능 | Impossible to stand |
| 7 | 揺れにほんろうされ、自分の意志で行動できない | 흔들림에 휘둘려 자발적 행동 불가 | Thrown by shaking |

---

## CSS Variable Definitions

Dark tactical 테마에서 사용할 CSS custom properties:

```css
:root {
  /* JMA Seismic Intensity Colors */
  --jma-0:  #9bbfd4;   /* 震度0 — Imperceptible */
  --jma-1:  #6699cc;   /* 震度1 — Slight */
  --jma-2:  #3399cc;   /* 震度2 — Weak */
  --jma-3:  #33cc66;   /* 震度3 — Rather Strong */
  --jma-4:  #ffff00;   /* 震度4 — Strong */
  --jma-5l: #ff9900;   /* 震度5弱 — Very Strong (Lower) */
  --jma-5u: #ff6600;   /* 震度5強 — Very Strong (Upper) */
  --jma-6l: #ff3300;   /* 震度6弱 — Severe (Lower) */
  --jma-6u: #cc0000;   /* 震度6強 — Severe (Upper) */
  --jma-7:  #990099;   /* 震度7 — Violent */

  /* Contour opacity */
  --jma-contour-fill-opacity: 0.35;
  --jma-contour-stroke-opacity: 0.70;
}
```

---

## TypeScript Constants

### HEX Color Map
```typescript
export const JMA_COLORS: Record<string, string> = {
  '0': '#9bbfd4',
  '1': '#6699cc',
  '2': '#3399cc',
  '3': '#33cc66',
  '4': '#ffff00',
  '5-': '#ff9900',
  '5+': '#ff6600',
  '6-': '#ff3300',
  '6+': '#cc0000',
  '7': '#990099',
};
```

### RGB Color Map
```typescript
export const JMA_COLORS_RGB: Record<string, [number, number, number]> = {
  '0':  [155, 191, 212],
  '1':  [102, 153, 204],
  '2':  [51,  153, 204],
  '3':  [51,  204, 102],
  '4':  [255, 255,   0],
  '5-': [255, 153,   0],
  '5+': [255, 102,   0],
  '6-': [255,  51,   0],
  '6+': [204,   0,   0],
  '7':  [153,   0, 153],
};
```

### RGBA for Contour Fill (35% opacity)
```typescript
export const JMA_COLORS_CONTOUR: Record<string, string> = {
  '0':  'rgba(155, 191, 212, 0.35)',
  '1':  'rgba(102, 153, 204, 0.35)',
  '2':  'rgba(51, 153, 204, 0.35)',
  '3':  'rgba(51, 204, 102, 0.35)',
  '4':  'rgba(255, 255, 0, 0.35)',
  '5-': 'rgba(255, 153, 0, 0.35)',
  '5+': 'rgba(255, 102, 0, 0.35)',
  '6-': 'rgba(255, 51, 0, 0.35)',
  '6+': 'rgba(204, 0, 0, 0.35)',
  '7':  'rgba(153, 0, 153, 0.35)',
};
```

### JMA Scale Display Names
```typescript
export const JMA_DISPLAY: Record<string, string> = {
  '0':  '震度0',
  '1':  '震度1',
  '2':  '震度2',
  '3':  '震度3',
  '4':  '震度4',
  '5-': '震度5弱',
  '5+': '震度5強',
  '6-': '震度6弱',
  '6+': '震度6強',
  '7':  '震度7',
};
```

### Intensity to Scale Classifier
```typescript
export function classifyJmaIntensity(intensity: number): string {
  if (intensity < 0.5) return '0';
  if (intensity < 1.5) return '1';
  if (intensity < 2.5) return '2';
  if (intensity < 3.5) return '3';
  if (intensity < 4.5) return '4';
  if (intensity < 5.0) return '5-';
  if (intensity < 5.5) return '5+';
  if (intensity < 6.0) return '6-';
  if (intensity < 6.5) return '6+';
  return '7';
}
```

### Contour Threshold Values
d3-contour에서 사용할 JMA 계급 경계값:
```typescript
export const JMA_THRESHOLDS: number[] = [0.5, 1.5, 2.5, 3.5, 4.5, 5.0, 5.5, 6.0, 6.5];
```

---

## Dark Theme Rendering Notes

### Low-Intensity Visibility
JMA 0과 1 (파란 계열)은 dark 배경에서 대비가 낮음.
등진도선 렌더링 시 glow 효과 추가 권장:

```css
.contour-low-intensity {
  filter: drop-shadow(0 0 2px rgba(155, 191, 212, 0.5));
}
```

### Globe Surface Material
Three.js material 설정 시 depthWrite 비활성화로 z-fighting 방지:
```typescript
const material = new THREE.MeshBasicMaterial({
  color: new THREE.Color(jmaHexColor),
  transparent: true,
  opacity: 0.35,
  side: THREE.DoubleSide,
  depthWrite: false,
});
```
