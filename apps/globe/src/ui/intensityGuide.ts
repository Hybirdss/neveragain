/**
 * JMA Seismic Intensity Guide — Modal overlay explaining each intensity level.
 *
 * Based on the official JMA Seismic Intensity Scale (気象庁震度階級).
 * This is life-safety information — all descriptions are sourced from
 * JMA official publications and must remain accurate.
 *
 * Reference: https://www.jma.go.jp/jma/en/Activities/inttable.html
 */

import type { JmaClass } from '../types';
import { getJmaColor } from '../types';
import { store } from '../store/appState';
import { getLocale } from '../i18n/index';

interface IntensityLevel {
  class: JmaClass;
  gal: string;  // approx PGA range
  name: { ja: string; ko: string; en: string };
  feel: { ja: string; ko: string; en: string };
  action: { ja: string; ko: string; en: string };
  severity: 'safe' | 'caution' | 'danger';
}

// Official JMA Seismic Intensity Scale descriptions
// Source: 気象庁震度階級関連解説表 (JMA Seismic Intensity Scale Explanation Table)
const LEVELS: IntensityLevel[] = [
  {
    class: '0',
    gal: '<0.8 gal',
    name: { ja: '震度0', ko: '진도 0', en: 'Shindo 0' },
    feel: {
      ja: '人は揺れを感じません。地震計のみが検知します。',
      ko: '사람은 흔들림을 느끼지 못합니다. 지진계만 감지합니다.',
      en: 'Imperceptible to people. Detected only by seismometers.',
    },
    action: {
      ja: '特に行動の必要はありません。',
      ko: '특별한 행동이 필요 없습니다.',
      en: 'No action needed.',
    },
    severity: 'safe',
  },
  {
    class: '1',
    gal: '0.8–2.5',
    name: { ja: '震度1', ko: '진도 1', en: 'Shindo 1' },
    feel: {
      ja: '屋内にいる一部の人が、わずかな揺れを感じます。',
      ko: '실내에 있는 일부 사람이 미약한 흔들림을 느낍니다.',
      en: 'Felt by some people indoors. A slight swaying may be noticed.',
    },
    action: {
      ja: '特に行動の必要はありません。',
      ko: '특별한 행동이 필요 없습니다.',
      en: 'No action needed.',
    },
    severity: 'safe',
  },
  {
    class: '2',
    gal: '2.5–8',
    name: { ja: '震度2', ko: '진도 2', en: 'Shindo 2' },
    feel: {
      ja: '屋内にいるほとんどの人が揺れを感じます。電灯などのつり下げ物がわずかに揺れます。',
      ko: '실내에 있는 대부분의 사람이 흔들림을 느낍니다. 매달린 조명이 약간 흔들립니다.',
      en: 'Felt by most people indoors. Hanging lights and objects swing slightly.',
    },
    action: {
      ja: '特に行動の必要はありません。',
      ko: '특별한 행동이 필요 없습니다.',
      en: 'No action needed.',
    },
    severity: 'safe',
  },
  {
    class: '3',
    gal: '8–25',
    name: { ja: '震度3', ko: '진도 3', en: 'Shindo 3' },
    feel: {
      ja: '屋内にいるほぼ全員が揺れを感じます。棚の食器が音を立てることがあります。電線が少し揺れます。',
      ko: '실내에 있는 거의 모든 사람이 흔들림을 느낍니다. 선반의 그릇이 소리를 낼 수 있습니다.',
      en: 'Felt by almost everyone indoors. Dishes on shelves may rattle. Power lines sway.',
    },
    action: {
      ja: '揺れが収まるまで安全な場所で身を守りましょう。',
      ko: '흔들림이 멈출 때까지 안전한 곳에서 몸을 보호하세요.',
      en: 'Stay calm and protect yourself until the shaking stops.',
    },
    severity: 'safe',
  },
  {
    class: '4',
    gal: '25–80',
    name: { ja: '震度4', ko: '진도 4', en: 'Shindo 4' },
    feel: {
      ja: 'かなりの恐怖感があり、歩いている人もほとんどが揺れを感じます。つり下げ物は大きく揺れ、棚の食器が落ちることがあります。不安定な置物が倒れることがあります。',
      ko: '상당한 공포감을 느끼며, 걷고 있는 사람도 대부분 흔들림을 느낍니다. 매달린 물체가 크게 흔들리고, 불안정한 물건이 넘어질 수 있습니다.',
      en: 'Most people are frightened. Hanging objects swing considerably. Unstable objects may topple. Dishes may fall from shelves.',
    },
    action: {
      ja: 'テーブルの下などに隠れ、頭を守ってください。揺れが収まるまで動かないでください。',
      ko: '테이블 아래로 숨어 머리를 보호하세요. 흔들림이 멈출 때까지 움직이지 마세요.',
      en: 'Drop, Cover, and Hold On. Get under a sturdy table and protect your head. Do not move until the shaking stops.',
    },
    severity: 'caution',
  },
  {
    class: '5-',
    gal: '80–140',
    name: { ja: '震度5弱', ko: '진도 5약', en: 'Shindo 5 Lower' },
    feel: {
      ja: '多くの人が身の危険を感じ、つかまらないと歩けません。棚の食器や本が落ち、家具が移動することがあります。ブロック塀が崩れることがあります。',
      ko: '많은 사람이 위험을 느끼며, 무언가를 잡지 않으면 걸을 수 없습니다. 가구가 움직이고, 블록 담이 무너질 수 있습니다.',
      en: 'Many people feel endangered. Walking is difficult without holding onto something. Furniture shifts. Unreinforced block walls may collapse.',
    },
    action: {
      ja: '身の安全を確保し、揺れが収まったら火の始末をしてください。屋外では落下物に注意してください。崖や川の近くから離れてください。',
      ko: '몸의 안전을 확보하고, 흔들림이 멈추면 불을 끄세요. 야외에서는 낙하물에 주의하세요. 절벽이나 강 근처에서 떨어지세요.',
      en: 'Secure your safety. After shaking stops, turn off gas/fire. Outdoors, beware of falling objects. Move away from cliffs and rivers.',
    },
    severity: 'caution',
  },
  {
    class: '5+',
    gal: '140–250',
    name: { ja: '震度5強', ko: '진도 5강', en: 'Shindo 5 Upper' },
    feel: {
      ja: 'つかまらないと立っていられません。固定していない家具の多くが倒れ、ガラスが割れることがあります。壁のタイルや窓ガラスが破損・落下することがあります。',
      ko: '무언가를 잡지 않으면 서 있을 수 없습니다. 고정되지 않은 가구가 쓰러지고, 유리가 깨질 수 있습니다. 벽 타일이나 창문이 파손될 수 있습니다.',
      en: 'Impossible to stand without support. Unsecured furniture topples. Windows may shatter. Wall tiles may crack and fall.',
    },
    action: {
      ja: '身の安全を最優先に。倒れやすい家具や窓から離れてください。落ち着いたら避難経路を確認し、必要に応じて避難してください。',
      ko: '몸의 안전을 최우선으로. 쓰러질 수 있는 가구와 창문에서 떨어지세요. 진정되면 대피 경로를 확인하고 필요시 대피하세요.',
      en: 'Prioritize personal safety. Move away from furniture and windows. Once calm, check evacuation routes and evacuate if needed.',
    },
    severity: 'danger',
  },
  {
    class: '6-',
    gal: '250–315',
    name: { ja: '震度6弱', ko: '진도 6약', en: 'Shindo 6 Lower' },
    feel: {
      ja: '立っていることができません。固定していない家具のほとんどが移動・転倒します。壁のタイルや窓ガラスが破損・落下し、ドアが開かなくなることがあります。耐震性の低い建物では、壁や柱が破損するおそれがあります。',
      ko: '서 있을 수 없습니다. 고정되지 않은 가구 대부분이 넘어집니다. 문이 열리지 않을 수 있습니다. 내진 설계가 안 된 건물은 벽이나 기둥이 파손될 수 있습니다.',
      en: 'Impossible to remain standing. Most unfixed furniture moves or topples. Doors may jam. Poorly earthquake-resistant buildings may suffer wall/pillar damage.',
    },
    action: {
      ja: '身の安全を確保後、速やかに避難してください。崩壊のおそれがある建物には近づかないでください。津波警報に注意し、沿岸部からすぐに高台へ避難してください。',
      ko: '안전 확보 후 신속히 대피하세요. 붕괴 위험이 있는 건물에 접근하지 마세요. 쓰나미 경보에 주의하고, 해안에서 즉시 고지대로 대피하세요.',
      en: 'After securing safety, evacuate promptly. Stay away from buildings at risk of collapse. Heed tsunami warnings — move to high ground immediately if in coastal areas.',
    },
    severity: 'danger',
  },
  {
    class: '6+',
    gal: '315–400',
    name: { ja: '震度6強', ko: '진도 6강', en: 'Shindo 6 Upper' },
    feel: {
      ja: '這わないと動けません。飛ばされることもあります。固定していない家具のほとんどが移動し、倒れるものが多くなります。耐震性の低い建物では、倒壊するものがあります。大きな地割れ、地すべり、山崩れが発生することがあります。',
      ko: '기어가지 않으면 움직일 수 없습니다. 내진 설계가 안 된 건물 중 무너지는 것이 있습니다. 대규모 지반 균열, 산사태가 발생할 수 있습니다.',
      en: 'Movement only possible by crawling. People may be thrown. Poorly resistant buildings may collapse. Large ground cracks, landslides, and slope failures may occur.',
    },
    action: {
      ja: '命を守る行動を取ってください。揺れが収まったらすぐに安全な場所へ避難してください。余震に備え、損傷した建物には絶対に戻らないでください。',
      ko: '생명을 지키는 행동을 취하세요. 흔들림이 멈추면 즉시 안전한 곳으로 대피하세요. 여진에 대비하고, 손상된 건물에는 절대 돌아가지 마세요.',
      en: 'Take life-saving action. Evacuate to safety immediately after shaking stops. Prepare for aftershocks — NEVER return to damaged buildings.',
    },
    severity: 'danger',
  },
  {
    class: '7',
    gal: '>400',
    name: { ja: '震度7', ko: '진도 7', en: 'Shindo 7' },
    feel: {
      ja: '揺れに翻弄され、自分の意思で行動できません。耐震性の高い建物でも傾いたり、大きく破壊されることがあります。鉄筋コンクリートの建物でも倒壊するものがあります。広範囲で地割れ、大規模な地すべりが発生します。',
      ko: '흔들림에 휘둘려 자신의 의지로 행동할 수 없습니다. 내진 건물도 크게 파손될 수 있으며, 철근콘크리트 건물도 무너질 수 있습니다. 광범위한 지반 균열과 대규모 산사태가 발생합니다.',
      en: 'People are tossed about and unable to act at will. Even earthquake-resistant buildings may tilt or sustain major damage. Reinforced concrete buildings may collapse. Widespread ground rupture and massive landslides occur.',
    },
    action: {
      ja: '生き延びることに集中してください。頭を守り、倒壊物から身を離してください。揺れが収まったら直ちに避難し、津波の危険がある地域では最大限の高台へ移動してください。ラジオ等で正確な情報を入手してください。',
      ko: '생존에 집중하세요. 머리를 보호하고 붕괴물에서 떨어지세요. 흔들림이 멈추면 즉시 대피하고, 쓰나미 위험 지역에서는 최대한 높은 곳으로 이동하세요. 라디오 등으로 정확한 정보를 확인하세요.',
      en: 'Focus on survival. Protect your head and stay clear of collapsing structures. Evacuate immediately after shaking. In tsunami-risk areas, move to the highest ground possible. Get accurate information from radio/official sources.',
    },
    severity: 'danger',
  },
];

let overlayEl: HTMLElement | null = null;

function el(tag: string, className?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function loc<T extends Record<string, string>>(obj: T): string {
  const locale = getLocale() as keyof T;
  return (obj[locale] ?? obj['en' as keyof T] ?? '') as string;
}

function buildOverlay(): HTMLElement {
  const overlay = el('div', 'intensity-guide-overlay');
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) hideIntensityGuide();
  });

  const guide = el('div', 'intensity-guide');
  guide.setAttribute('role', 'dialog');
  guide.setAttribute('aria-modal', 'true');

  // Header
  const header = el('div', 'intensity-guide__header');
  const headerText = el('div');
  const title = el('div', 'intensity-guide__title');
  const subtitle = el('div', 'intensity-guide__subtitle');
  headerText.appendChild(title);
  headerText.appendChild(subtitle);
  header.appendChild(headerText);

  const closeBtn = el('button', 'intensity-guide__close', '\u00D7');
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.addEventListener('click', hideIntensityGuide);
  header.appendChild(closeBtn);
  guide.appendChild(header);

  // Levels
  const levels = el('div', 'intensity-guide__levels');
  const isColorblind = store.get('colorblind');

  // Reverse: show strongest first (people check their current level first)
  for (const level of [...LEVELS].reverse()) {
    const card = el('div', 'intensity-guide__card');

    // Badge
    const badge = el('div', 'intensity-guide__badge', level.class);
    const bgColor = getJmaColor(level.class, isColorblind);
    badge.style.backgroundColor = bgColor;
    const brightClasses: JmaClass[] = ['3', '4', '5-', '5+'];
    badge.style.color = brightClasses.includes(level.class) ? '#000' : '#fff';
    card.appendChild(badge);

    // Card header
    const cardHeader = el('div', 'intensity-guide__card-header');
    cardHeader.appendChild(el('span', 'intensity-guide__level-name', loc(level.name)));
    cardHeader.appendChild(el('span', 'intensity-guide__gal', level.gal + ' gal'));
    card.appendChild(cardHeader);

    // Card body
    const body = el('div', 'intensity-guide__card-body');
    body.appendChild(el('div', 'intensity-guide__feel', loc(level.feel)));

    const actionDiv = el('div', `intensity-guide__action intensity-guide__action--${level.severity}`);
    const icon = level.severity === 'danger' ? '\u26A0' : level.severity === 'caution' ? '\u26A1' : '\u2713';
    actionDiv.appendChild(el('span', 'intensity-guide__action-icon', icon));
    actionDiv.appendChild(el('span', undefined, loc(level.action)));
    body.appendChild(actionDiv);

    card.appendChild(body);
    levels.appendChild(card);
  }

  guide.appendChild(levels);

  // Footer
  const footer = el('div', 'intensity-guide__footer');
  guide.appendChild(footer);

  // Set locale-specific text
  updateLocaleText(title, subtitle, footer);

  overlay.appendChild(guide);
  return overlay;
}

function updateLocaleText(title: HTMLElement, subtitle: HTMLElement, footer: HTMLElement): void {
  const locale = getLocale();
  if (locale === 'ja') {
    title.textContent = '気象庁震度階級';
    subtitle.textContent = 'Japan Meteorological Agency Seismic Intensity Scale';
    footer.textContent = '出典: 気象庁震度階級関連解説表 \u00B7 この情報は参考用です。実際の地震時は気象庁の公式発表に従ってください。';
  } else if (locale === 'ko') {
    title.textContent = 'JMA 진도 계급';
    subtitle.textContent = '일본 기상청 진도 계급 해설';
    footer.textContent = '출처: 기상청 진도계급 관련 해설표 \u00B7 이 정보는 참고용입니다. 실제 지진 시 기상청 공식 발표를 따르세요.';
  } else {
    title.textContent = 'JMA Seismic Intensity Scale';
    subtitle.textContent = 'Japan Meteorological Agency \u2014 Official Scale';
    footer.textContent = 'Source: JMA Seismic Intensity Scale Explanation Table \u00B7 This is for reference only. Follow official JMA announcements during actual earthquakes.';
  }
}

export function showIntensityGuide(): void {
  if (!overlayEl) {
    overlayEl = buildOverlay();
    document.body.appendChild(overlayEl);
  }
  // Force reflow before adding class for transition
  void overlayEl.offsetWidth;
  overlayEl.classList.add('intensity-guide-overlay--visible');

  // ESC to close
  document.addEventListener('keydown', handleEsc);
}

export function hideIntensityGuide(): void {
  if (overlayEl) {
    overlayEl.classList.remove('intensity-guide-overlay--visible');
  }
  document.removeEventListener('keydown', handleEsc);
}

function handleEsc(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault();
    hideIntensityGuide();
  }
}

/**
 * Create a small "?" button that opens the intensity guide.
 * Attach this next to JMA intensity displays.
 */
export function createHelpButton(): HTMLElement {
  const btn = el('button', 'jma-help-btn', '?');
  btn.setAttribute('aria-label', 'Intensity scale guide');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    showIntensityGuide();
  });
  return btn;
}
