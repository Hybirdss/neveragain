/**
 * Namazue — English locale strings
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
  'timeline.scrub': 'Timeline scrubber',

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
  'scenario.title': 'Training Scenarios',

  // HUD overlay
  'hud.cam': 'CAM',
  'hud.time': 'TIME',
  'hud.zoom': 'ZOOM',

  // Mode switcher
  'mode.realtime': 'REALTIME',
  'mode.timeline': 'ARCHIVE',
  'mode.scenario': 'TRAINING',
  'mode.load': 'Load',
  'mode.from': 'From',
  'mode.to': 'To',
  'mode.start': 'Start Date',
  'mode.end': 'End Date',
  'mode.error.required': 'Select both start and end dates.',
  'mode.error.invalidDate': 'Invalid date format.',
  'mode.error.order': 'Start date must be before end date.',
  'mode.error.rangeTooLong': 'Range must be 366 days or less.',

  // Layer toggles
  'layer.title': 'Layers',
  'layer.plates': 'Plates',
  'layer.quakes': 'Quakes',
  'layer.waves': 'Waves',
  'layer.contours': 'Contours',
  'layer.shakeMap': 'ShakeMap',
  'layer.slab2': 'Slab2',
  'layer.labels': 'Labels',

  // GSI overlay layers
  'layer.gsiFaults': 'Active Faults',
  'layer.gsiRelief': 'Elevation',
  'layer.gsiSlope': 'Slope',
  'layer.gsiPale': 'Pale Map',
  'layer.adminBoundary': 'Boundaries',
  'layer.jshisHazard': 'Seismic Hazard',
  'layer.gsiBaseGroup': 'Base Map',
  'layer.gsiOverlayGroup': 'Overlay',

  // Data integration layers
  'layer.activeFaults': 'Fault Lines',
  'layer.hazardComparison': 'J-SHIS Compare',
  'layer.landslideRisk': 'Landslide Risk',

  // Impact panel
  'impact.title': 'AFFECTED AREAS',
  'impact.totalExposed': 'Total exposed',

  // Alert bar
  'alert.prefix': 'EARTHQUAKE ALERT',

  // Tsunami
  'tsunami.warning': 'WARNING',

  // Fault types
  'faultType.crustal': 'Crustal',
  'faultType.interface': 'Interface',
  'faultType.intraslab': 'Intraslab',

  // Sidebar extras
  'sidebar.eventCount': 'events / 7d',
  'sidebar.eventCount.one': 'event / 7d',
  'sidebar.cinematic': 'Epicenter Focus',
  'sidebar.scenarios': 'Scenarios',
  'sidebar.training': 'Training',
  'sidebar.alert': 'M5+ ALERT',
  'sidebar.empty': 'No M2.5+ earthquakes in the past 7 days',
  'sidebar.loading': 'Fetching earthquake data…',
  'sidebar.lastUpdated': 'Updated',
  'sidebar.justNow': 'just now',
  'sidebar.agoMin': 'min ago',
  'sidebar.offline': 'Connection lost — retrying',
  'sidebar.mmiTitle': 'MODIFIED MERCALLI INTENSITY',
  'sidebar.source.shakemap': 'ShakeMap',
  'sidebar.source.gmpe': 'GMPE',

  // Detail panel — intensity source
  'detail.intensitySource': 'Intensity Source',
  'detail.source.shakemap': 'USGS ShakeMap',
  'detail.source.gmpe': 'Estimated (GMPE)',
  'detail.crossSection': 'Cross-Section',

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

  // Detail panel — MMI descriptions
  'mmi.destructive': 'Destructive',
  'mmi.strong': 'Strong',
  'mmi.moderate': 'Moderate',
  'mmi.weak': 'Weak',

  // AI Panel
  'ai.tab.easy': 'Briefing',
  'ai.tab.expert': 'Analysis',
  'ai.tab.data': 'Evidence',
  'ai.why': 'Why did it happen?',
  'ai.aftershock': 'Aftershock probability',
  'ai.intensity': 'Intensity',
  'ai.intensityGuide': 'Intensity guide',
  'ai.actions': 'What to do now',
  'ai.tsunami': 'Tsunami risk',
  'ai.eli5': 'Simple explanation',
  'ai.expert.tectonic': 'Tectonic context',
  'ai.expert.mechanism': 'Fault mechanism',
  'ai.expert.sequence': 'Sequence classification',
  'ai.expert.historical': 'Historical comparison',
  'ai.expert.aftershock': 'Aftershock assessment',
  'ai.expert.gap': 'Seismic gap',
  'ai.expert.notable': 'Notable features',
  'ai.expert.depth': 'Depth analysis',
  'ai.expert.coulomb': 'Coulomb stress',
  'ai.expert.modelNotes': 'Model notes',
  'ai.expert.interpretations': 'Key interpretations',
  'ai.data.download': 'Download JSON',
  'ai.data.intensity': 'Intensity',
  'ai.data.cities': 'Cities',
  'ai.data.population': 'Population',
  'ai.data.tags': 'Search tags',
  'ai.button': 'AI Brief',
  'ai.badge.loading': 'AI analyzing...',
  'ai.badge.ready': 'AI brief ready',
  'ai.loading': 'Analyzing...',
  'ai.panelLabel': 'AI analysis panel',
  'ai.close': 'Close AI panel',
  'ai.noPublic': 'No public analysis available',
  'ai.noExpert': 'No expert analysis available',

  // Search
  'search.placeholder': 'M6 Tokyo / deep M7+ / last 30 days...',
  'search.hint': 'Enter to search · ESC to close',
  'search.loading': 'Searching...',
  'search.noResults': 'No results found',
  'search.dialogLabel': 'Earthquake search',
  'search.inputLabel': 'Search earthquakes',
  'search.resultsLabel': 'Search results',
  'search.stats.countSuffix': ' events',
  'search.stats.avgPrefix': 'Avg',
  'search.stats.offshoreSuffix': ' offshore',
  'search.stats.inlandSuffix': ' inland',
  'search.quickFilters': 'Quick filters',
  'search.examples': 'Search examples',
  'search.chip.recent': 'Last 24h',
  'search.chip.tsunami': 'Tsunami',
  'search.chip.tohoku': 'Tohoku',
  'search.chip.nankai': 'Nankai',
  'search.chip.kanto': 'Kanto',
  'search.chip.deep': 'Deep quakes',
  'ai.ask.placeholder': 'Ask about this earthquake...',
  'ai.ask.submit': 'Ask',
  'ai.ask.thinking': 'Generating answer...',
  'ai.ask.error': 'Failed to generate answer',
  'ai.ask.examples': 'Example questions',
  'ai.ask.ex1': 'Is this related to the Nankai Trough?',
  'ai.ask.ex2': 'How long will aftershocks continue?',
  'ai.ask.ex3': 'Is there a tsunami risk?',

  // Locale switcher
  'locale.en': 'EN',
  'locale.ko': '\ud55c',
  'locale.ja': '\u65e5',

  // Left Panel Tabs
  'panel.tab.live': 'Live',
  'panel.tab.ask': 'Ask',

  // Ask Panel
  'ask.welcome.title': 'Namazue AI',
  'ask.welcome.desc': 'Ask about earthquakes, search the database, or request analysis. AI will search and visualize results on the globe.',
  'ask.suggest.recent': 'Recent M6+ earthquakes?',
  'ask.suggest.compare': 'Compare Tohoku and Kanto quakes',
  'ask.suggest.region': 'Japan Sea seismicity trend',
  'ask.suggest.analysis': 'Analyze the latest major event',
  'ask.input.placeholder': 'Ask about earthquakes...',
  'ask.input.label': 'Ask input',
  'ask.input.send': 'Send',

  // Navigation
  'nav.returnToJapan': 'Return to Japan',

  // Mobile shell
  'mobile.tab.map': 'Map',
  'mobile.tab.live': 'Live',
  'mobile.tab.ask': 'Ask',
  'mobile.nav.label': 'Mobile navigation',
};

export default en;
