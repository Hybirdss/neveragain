/**
 * NeverAgain — English locale strings
 */

const en: Record<string, string> = {
  // Sidebar
  'sidebar.title': 'Seismic Monitor',
  'sidebar.totalQuakes': 'Total Quakes',
  'sidebar.maxMag': 'Max Mag',
  'sidebar.avgMag': 'Avg Mag',
  'sidebar.latest': 'Latest',
  'sidebar.magDistribution': 'Magnitude Distribution',

  // Detail panel / Tooltip shared labels
  'detail.time': 'Time',
  'detail.location': 'Location',
  'detail.depth': 'Depth',
  'detail.faultType': 'Fault Type',
  'detail.jmaIntensity': 'JMA Intensity',
  'detail.tsunami': 'Tsunami',

  // Timeline
  'timeline.play': 'Play',
  'timeline.pause': 'Pause',
  'timeline.prev': 'Previous event',
  'timeline.next': 'Next event',

  // Intensity legend
  'legend.title': 'JMA Intensity',
  'legend.violent': 'Violent',
  'legend.severe': 'Severe',
  'legend.strongPlus': 'Very Strong',
  'legend.veryStrong': 'Strong+',
  'legend.ratherStrong': 'Strong-',
  'legend.strong': 'Moderate+',
  'legend.moderate': 'Moderate',
  'legend.weak': 'Weak',
  'legend.slight': 'Slight',
  'legend.notFelt': 'Not Felt',

  // Scenario picker
  'scenario.title': 'Select Scenario',

  // HUD overlay
  'hud.cam': 'CAM',
  'hud.time': 'TIME',
  'hud.zoom': 'ZOOM',

  // Mode switcher
  'mode.realtime': 'REALTIME',
  'mode.timeline': 'TIMELINE',
  'mode.scenario': 'SCENARIO',
  'mode.load': 'Load',
  'mode.from': 'From',
  'mode.to': 'To',
  'mode.start': 'Start Date',
  'mode.end': 'End Date',

  // Layer toggles
  'layer.title': 'Layers',
  'layer.plates': 'Plates',
  'layer.quakes': 'Quakes',
  'layer.waves': 'Waves',
  'layer.contours': 'Contours',
  'layer.shakeMap': 'ShakeMap',
  'layer.slab2': 'Slab2',
  'layer.labels': 'Labels',

  // Alert bar
  'alert.prefix': 'EARTHQUAKE ALERT',

  // Tsunami
  'tsunami.warning': 'WARNING',

  // Fault types
  'faultType.crustal': 'Crustal',
  'faultType.interface': 'Interface',
  'faultType.intraslab': 'Intraslab',

  // Sidebar extras
  'sidebar.cinematic': 'Cinematic',
  'sidebar.scenarios': 'Scenarios',

  // Detail panel — intensity source
  'detail.intensitySource': 'Intensity Source',
  'detail.source.shakemap': 'USGS ShakeMap',
  'detail.source.gmpe': 'Estimated (GMPE)',

  // PLATEAU 3D Buildings
  'layer.plateau': '3D Buildings',
  'plateau.none': 'None',
  'plateau.chiyoda': 'Chiyoda',
  'plateau.chuo': 'Chuo',
  'plateau.minato': 'Minato',
  'plateau.shinjuku': 'Shinjuku',
  'plateau.shibuya': 'Shibuya',
  'plateau.yokohama': 'Yokohama',
  'plateau.kawasaki': 'Kawasaki',
  'plateau.saitama': 'Saitama',
  'plateau.chiba': 'Chiba',
  'plateau.utsunomiya': 'Utsunomiya',
  'plateau.maebashi': 'Maebashi',
  'plateau.kofu': 'Kofu',
  'plateau.osaka': 'Osaka',
  'plateau.kyoto': 'Kyoto',
  'plateau.kobe': 'Kobe',
  'plateau.wakayama': 'Wakayama',
  'plateau.nagoya': 'Nagoya',
  'plateau.shizuoka': 'Shizuoka',
  'plateau.hamamatsu': 'Hamamatsu',
  'plateau.niigata': 'Niigata',
  'plateau.kanazawa': 'Kanazawa',
  'plateau.gifu': 'Gifu',
  'plateau.sapporo': 'Sapporo',
  'plateau.sendai': 'Sendai',
  'plateau.fukushima': 'Fukushima',
  'plateau.hiroshima': 'Hiroshima',
  'plateau.okayama': 'Okayama',
  'plateau.takamatsu': 'Takamatsu',
  'plateau.tottori': 'Tottori',
  'plateau.tokushima': 'Tokushima',
  'plateau.matsuyama': 'Matsuyama',
  'plateau.kochi': 'Kochi',
  'plateau.fukuoka': 'Fukuoka',
  'plateau.kitakyushu': 'Kitakyushu',
  'plateau.kumamoto': 'Kumamoto',
  'plateau.naha': 'Naha',
  'plateau.loading': 'Loading buildings...',

  // Locale switcher
  'locale.en': 'EN',
  'locale.ko': '\ud55c',
  'locale.ja': '\u65e5',
};

export default en;
