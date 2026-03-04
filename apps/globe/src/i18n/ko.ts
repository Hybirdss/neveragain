/**
 * Namazue — Korean locale strings
 */

const ko: Record<string, string> = {
  // Sidebar
  'sidebar.title': '\uc9c0\uc9c4 \ubaa8\ub2c8\ud130',
  'sidebar.totalQuakes': '\ucd1d \uc9c0\uc9c4 \uc218',
  'sidebar.maxMag': '\ucd5c\ub300 \uaddc\ubaa8',
  'sidebar.avgMag': '\ud3c9\uade0 \uaddc\ubaa8',
  'sidebar.latest': '\ucd5c\uadfc',
  'sidebar.magDistribution': '\uaddc\ubaa8 \ubd84\ud3ec',

  // Detail panel / Tooltip shared labels
  'detail.time': '\uc2dc\uac04',
  'detail.location': '\uc704\uce58',
  'detail.depth': '\uae4a\uc774',
  'detail.faultType': '\ub2e8\uce35 \uc720\ud615',
  'detail.jmaIntensity': 'JMA \uc9c4\ub3c4',
  'detail.tsunami': '\uc4f0\ub098\ubbf8',

  // Timeline
  'timeline.play': '\uc7ac\uc0dd',
  'timeline.pause': '\uc77c\uc2dc\uc815\uc9c0',
  'timeline.prev': '\uc774\uc804 \uc9c0\uc9c4',
  'timeline.next': '\ub2e4\uc74c \uc9c0\uc9c4',

  // Intensity legend
  'legend.title': 'JMA \uc9c4\ub3c4',
  'legend.violent': '\uaca9\ub834',
  'legend.severe': '\ub9f9\ub834',
  'legend.strongPlus': '\ub9e4\uc6b0 \uac15\ud568',
  'legend.veryStrong': '\uac15\ud568+',
  'legend.ratherStrong': '\uac15\ud568-',
  'legend.strong': '\uc911\uac04+',
  'legend.moderate': '\uc911\uac04',
  'legend.weak': '\uc57d\ud568',
  'legend.slight': '\ubbf8\uc57d',
  'legend.notFelt': '\ubb34\uac10',

  // Scenario picker
  'scenario.title': '훈련 시나리오',

  // HUD overlay
  'hud.cam': '\uce74\uba54\ub77c',
  'hud.time': '\uc2dc\uac04',
  'hud.zoom': '\uc90c',

  // Mode switcher
  'mode.realtime': '\uc2e4\uc2dc\uac04',
  'mode.timeline': '기록',
  'mode.scenario': '훈련',
  'mode.load': '\ubd88\ub7ec\uc624\uae30',
  'mode.from': '\uc2dc\uc791',
  'mode.to': '\uc885\ub8cc',
  'mode.start': '\uc2dc\uc791\uc77c',
  'mode.end': '\uc885\ub8cc\uc77c',

  // Layer toggles
  'layer.title': '\ub808\uc774\uc5b4',
  'layer.plates': '\ud310 \uacbd\uacc4',
  'layer.quakes': '\uc9c0\uc9c4',
  'layer.waves': '\ud30c\ub3d9',
  'layer.contours': '\ub4f1\uc9c4\ub3c4\uc120',
  'layer.shakeMap': 'ShakeMap',
  'layer.slab2': 'Slab2',
  'layer.labels': '\ub77c\ubca8',

  // GSI overlay layers
  'layer.gsiFaults': '활성단층',
  'layer.gsiRelief': '색별표고',
  'layer.gsiSlope': '경사도',
  'layer.gsiPale': '담색지도',
  'layer.adminBoundary': '행정구역',
  'layer.jshisHazard': '지진동예측',
  'layer.gsiBaseGroup': '배경지도',
  'layer.gsiOverlayGroup': '오버레이',

  // Data integration layers
  'layer.activeFaults': '활성단층선',
  'layer.hazardComparison': 'J-SHIS 비교',
  'layer.landslideRisk': '산사태 위험',

  // Impact panel
  'impact.title': '영향 지역',
  'impact.totalExposed': '총 영향 인구',

  // Alert bar
  'alert.prefix': '지진 경보',

  // Tsunami
  'tsunami.warning': '\uacbd\uace0',

  // Fault types
  'faultType.crustal': '\uc9c0\uac01',
  'faultType.interface': '\ud574\uad6c\ud615',
  'faultType.intraslab': '\uc2ac\ub798\ube0c \ub0b4',

  // Sidebar extras
  'sidebar.eventCount': '건 / 24시간',
  'sidebar.cinematic': '\uc9c4\uc6d0 \ud3ec\ucee4\uc2a4',
  'sidebar.scenarios': '\uc2dc\ub098\ub9ac\uc624',
  'sidebar.training': '훈련',

  // Detail panel — intensity source
  'detail.intensitySource': '\uc9c4\ub3c4 \uc18c\uc2a4',
  'detail.source.shakemap': 'USGS ShakeMap',
  'detail.source.gmpe': '\ucd94\uc815 (GMPE)',
  'detail.crossSection': '\ub2e8\uba74\ud45c\uc2dc',

  // PLATEAU 3D Buildings
  'layer.plateau': '3D 건물',
  'plateau.none': '없음',
  'plateau.chiyoda': '치요다구',
  'plateau.chuo': '주오구',
  'plateau.minato': '미나토구',
  'plateau.shinjuku': '신주쿠구',
  'plateau.shibuya': '시부야구',
  'plateau.yokohama': '요코하마',
  'plateau.kawasaki': '가와사키',
  'plateau.saitama': '사이타마',
  'plateau.chiba': '치바',
  'plateau.utsunomiya': '우쓰노미야',
  'plateau.maebashi': '마에바시',
  'plateau.kofu': '고후',
  'plateau.osaka': '오사카',
  'plateau.kyoto': '교토',
  'plateau.kobe': '고베',
  'plateau.wakayama': '와카야마',
  'plateau.nagoya': '나고야',
  'plateau.shizuoka': '시즈오카',
  'plateau.hamamatsu': '하마마쓰',
  'plateau.niigata': '니가타',
  'plateau.kanazawa': '가나자와',
  'plateau.gifu': '기후',
  'plateau.sapporo': '삿포로',
  'plateau.sendai': '센다이',
  'plateau.fukushima': '후쿠시마',
  'plateau.hiroshima': '히로시마',
  'plateau.okayama': '오카야마',
  'plateau.takamatsu': '다카마쓰',
  'plateau.tottori': '돗토리',
  'plateau.tokushima': '도쿠시마',
  'plateau.matsuyama': '마쓰야마',
  'plateau.kochi': '고치',
  'plateau.fukuoka': '후쿠오카',
  'plateau.kitakyushu': '기타큐슈',
  'plateau.kumamoto': '구마모토',
  'plateau.naha': '나하',
  'plateau.loading': '건물 로딩 중...',

  // Detail panel — MMI descriptions
  'mmi.destructive': '파괴적',
  'mmi.strong': '강진',
  'mmi.moderate': '중진',
  'mmi.weak': '약진',

  // AI Panel
  'ai.tab.easy': '브리핑',
  'ai.tab.expert': '분석',
  'ai.tab.data': '근거',
  'ai.why': '왜 흔들렸나요?',
  'ai.aftershock': '여진 확률',
  'ai.intensity': '진도',
  'ai.intensityGuide': '진도별 가이드',
  'ai.actions': '지금 뭘 해야 하나',
  'ai.tsunami': '쓰나미 위험',
  'ai.eli5': '간단한 설명',
  'ai.expert.tectonic': '판구조 맥락',
  'ai.expert.mechanism': '단층 메커니즘',
  'ai.expert.sequence': '시퀀스 분류',
  'ai.expert.historical': '역사적 비교',
  'ai.expert.aftershock': '여진 평가',
  'ai.expert.gap': '지진 공백역',
  'ai.expert.notable': '주요 특징',
  'ai.data.download': 'JSON 다운로드',
  'ai.data.intensity': '진도',
  'ai.data.cities': '도시',
  'ai.data.population': '인구',
  'ai.data.tags': '검색 태그',
  'ai.button': 'AI 브리핑',
  'ai.loading': '분석 중...',

  // Search
  'search.placeholder': 'M6 미야기 / 규모 5 이상 도쿄 / 깊은 지진...',
  'search.noResults': '결과 없음',

  // Locale switcher
  'locale.en': 'EN',
  'locale.ko': '한',
  'locale.ja': '日',
};

export default ko;
