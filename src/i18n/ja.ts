/**
 * NeverAgain — Japanese locale strings
 */

const ja: Record<string, string> = {
  // Sidebar
  'sidebar.title': '\u5730\u9707\u30e2\u30cb\u30bf\u30fc',
  'sidebar.totalQuakes': '\u5730\u9707\u7dcf\u6570',
  'sidebar.maxMag': '\u6700\u5927M',
  'sidebar.avgMag': '\u5e73\u5747M',
  'sidebar.latest': '\u6700\u65b0',
  'sidebar.magDistribution': '\u30de\u30b0\u30cb\u30c1\u30e5\u30fc\u30c9\u5206\u5e03',

  // Detail panel / Tooltip shared labels
  'detail.time': '\u6642\u523b',
  'detail.location': '\u4f4d\u7f6e',
  'detail.depth': '\u6df1\u3055',
  'detail.faultType': '\u65ad\u5c64\u30bf\u30a4\u30d7',
  'detail.jmaIntensity': 'JMA\u9707\u5ea6',
  'detail.tsunami': '\u6d25\u6ce2',

  // Timeline
  'timeline.play': '\u518d\u751f',
  'timeline.pause': '\u4e00\u6642\u505c\u6b62',
  'timeline.prev': '\u524d\u3078',
  'timeline.next': '\u6b21\u3078',

  // Intensity legend
  'legend.title': 'JMA\u9707\u5ea6',
  'legend.violent': '\u6fc0\u70c8',
  'legend.severe': '\u731b\u70c8',
  'legend.strongPlus': '\u975e\u5e38\u306b\u5f37\u3044',
  'legend.veryStrong': '\u5f37\u3044+',
  'legend.ratherStrong': '\u5f37\u3044-',
  'legend.strong': '\u4e2d+',
  'legend.moderate': '\u4e2d',
  'legend.weak': '\u5f31\u3044',
  'legend.slight': '\u8efd\u5fae',
  'legend.notFelt': '\u7121\u611f',

  // Scenario picker
  'scenario.title': '\u30b7\u30ca\u30ea\u30aa\u9078\u629e',

  // HUD overlay
  'hud.cam': '\u30ab\u30e1\u30e9',
  'hud.time': '\u6642\u9593',
  'hud.zoom': '\u30ba\u30fc\u30e0',

  // Mode switcher
  'mode.realtime': '\u30ea\u30a2\u30eb\u30bf\u30a4\u30e0',
  'mode.timeline': '\u30bf\u30a4\u30e0\u30e9\u30a4\u30f3',
  'mode.scenario': '\u30b7\u30ca\u30ea\u30aa',
  'mode.load': '\u8aad\u8fbc',
  'mode.from': '\u958b\u59cb',
  'mode.to': '\u7d42\u4e86',
  'mode.start': '\u958b\u59cb\u65e5',
  'mode.end': '\u7d42\u4e86\u65e5',

  // Layer toggles
  'layer.title': '\u30ec\u30a4\u30e4\u30fc',
  'layer.plates': '\u30d7\u30ec\u30fc\u30c8',
  'layer.quakes': '\u5730\u9707',
  'layer.waves': '\u6ce2\u52d5',
  'layer.contours': '\u7b49\u9707\u5ea6\u7dda',
  'layer.shakeMap': 'ShakeMap',
  'layer.slab2': 'Slab2',
  'layer.labels': '\u30e9\u30d9\u30eb',

  // GSI overlay layers
  'layer.gsiFaults': '活断層図',
  'layer.gsiRelief': '色別標高図',
  'layer.gsiSlope': '傾斜量図',
  'layer.gsiPale': '淡色地図',
  'layer.adminBoundary': '行政区域',
  'layer.jshisHazard': '地震動予測',
  'layer.gsiGroup': 'GSI地図',

  // Alert bar
  'alert.prefix': '地震速報',

  // Tsunami
  'tsunami.warning': '\u8b66\u5831',

  // Fault types
  'faultType.crustal': '\u5730\u6bbb\u5185',
  'faultType.interface': '\u30d7\u30ec\u30fc\u30c8\u9593',
  'faultType.intraslab': '\u30b9\u30e9\u30d6\u5185',

  // Sidebar extras
  'sidebar.cinematic': '\u30b7\u30cd\u30de\u30c6\u30a3\u30c3\u30af',
  'sidebar.scenarios': '\u30b7\u30ca\u30ea\u30aa',

  // Detail panel — intensity source
  'detail.intensitySource': '\u9707\u5ea6\u30bd\u30fc\u30b9',
  'detail.source.shakemap': 'USGS ShakeMap',
  'detail.source.gmpe': '\u63a8\u5b9a (GMPE)',
  'detail.crossSection': '\u65ad\u9762\u8868\u793a',

  // PLATEAU 3D Buildings
  'layer.plateau': '3Dビル',
  'plateau.none': 'なし',
  'plateau.chiyoda': '千代田区',
  'plateau.chuo': '中央区',
  'plateau.minato': '港区',
  'plateau.shinjuku': '新宿区',
  'plateau.shibuya': '渋谷区',
  'plateau.yokohama': '横浜市',
  'plateau.kawasaki': '川崎市',
  'plateau.saitama': 'さいたま市',
  'plateau.chiba': '千葉市',
  'plateau.utsunomiya': '宇都宮市',
  'plateau.maebashi': '前橋市',
  'plateau.kofu': '甲府市',
  'plateau.osaka': '大阪市',
  'plateau.kyoto': '京都市',
  'plateau.kobe': '神戸市',
  'plateau.wakayama': '和歌山市',
  'plateau.nagoya': '名古屋市',
  'plateau.shizuoka': '静岡市',
  'plateau.hamamatsu': '浜松市',
  'plateau.niigata': '新潟市',
  'plateau.kanazawa': '金沢市',
  'plateau.gifu': '岐阜市',
  'plateau.sapporo': '札幌市',
  'plateau.sendai': '仙台市',
  'plateau.fukushima': '福島市',
  'plateau.hiroshima': '広島市',
  'plateau.okayama': '岡山市',
  'plateau.takamatsu': '高松市',
  'plateau.tottori': '鳥取市',
  'plateau.tokushima': '徳島市',
  'plateau.matsuyama': '松山市',
  'plateau.kochi': '高知市',
  'plateau.fukuoka': '福岡市',
  'plateau.kitakyushu': '北九州市',
  'plateau.kumamoto': '熊本市',
  'plateau.naha': '那覇市',
  'plateau.loading': 'ビル読み込み中...',

  // Locale switcher
  'locale.en': 'EN',
  'locale.ko': '한',
  'locale.ja': '日',
};

export default ja;
