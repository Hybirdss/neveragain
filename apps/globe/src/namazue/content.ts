import type { LabTabId } from './routeModel';

export type ConsoleStateId = 'calm' | 'live' | 'focus' | 'scenario';

export interface ConsoleListItem {
  name: string;
  detail: string;
  severity: 'clear' | 'watch' | 'priority' | 'critical';
}

export interface ConsoleState {
  statusLabel: string;
  statusTone: 'calm' | 'live' | 'focus' | 'scenario';
  snapshotTitle: string;
  snapshotBody: string;
  snapshotMeta: string[];
  mapSummary: string;
  assets: ConsoleListItem[];
  checks: ConsoleListItem[];
  analystTitle: string;
  analystCopy: string;
  replayNodes: Array<{ label: string; detail: string }>;
}

export interface LabTab {
  id: LabTabId;
  label: string;
  kicker: string;
  title: string;
  body: string;
}

export interface StatePlate {
  name: string;
  tag: string;
  copy: string;
}

export interface ComponentSpec {
  name: string;
  role: string;
  contains: string;
  avoid: string;
}

export interface ArchitectureCard {
  title: string;
  body: string;
  items: string[];
}

export interface VoiceCard {
  title: string;
  tone: 'good' | 'bad';
  intro: string;
  lines: string[];
}

export const CONSOLE_STATES: Record<ConsoleStateId, ConsoleState> = {
  calm: {
    statusLabel: 'System calm',
    statusTone: 'calm',
    snapshotTitle: 'No critical operational earthquake event is active.',
    snapshotBody:
      'The console is ready for replay, scenario review, and asset inspection. Operators should read this as a waiting state, not an empty state.',
    snapshotMeta: ['Tokyo metro posture', 'Ports tracked', 'Rail hubs tracked', 'Hospitals tracked'],
    mapSummary: 'Metro-first view. Quiet shell. Assets visible.',
    assets: [
      { name: 'Port of Tokyo', detail: 'Harbor operations visible in calm watch posture.', severity: 'clear' },
      { name: 'Shinagawa Hub', detail: 'Passenger corridor capacity remains normal.', severity: 'clear' },
      { name: "St. Luke's Hospital", detail: 'Emergency access routes available for observation.', severity: 'clear' },
    ],
    checks: [
      { name: 'Review latest replay', detail: 'Use replay to inspect a representative coastal event.', severity: 'clear' },
      { name: 'Run scenario shift', detail: 'Stress-test a shallower or stronger quake without breaking calm mode.', severity: 'clear' },
      { name: 'Inspect launch assets', detail: 'Baseline Tokyo launch assets and review system geography.', severity: 'clear' },
    ],
    analystTitle: 'The shell should feel calm before it feels dramatic.',
    analystCopy:
      'This view proves that the service reads like an operator console even when nothing urgent is happening.',
    replayNodes: [
      { label: 'Calm', detail: 'Tokyo is ready.' },
      { label: 'Replay', detail: 'Open a historical event.' },
      { label: 'Inspect', detail: 'Read asset posture.' },
      { label: 'Scenario', detail: 'Shift the quake model.' },
      { label: 'Return', detail: 'Restore calm mode.' },
    ],
  },
  live: {
    statusLabel: 'Operational impact elevated',
    statusTone: 'live',
    snapshotTitle: 'Coastal Tokyo impact posture is rising after a live offshore event.',
    snapshotBody:
      'A newly locked quake pushes the service from readiness into active monitoring. The console should immediately translate the quake into exposed operations.',
    snapshotMeta: ['M7.1 Sagami corridor event', 'Estimated JMA 5+', 'Coastal posture raised', 'Next 60 min active'],
    mapSummary: 'Impact field forming across the metro coast.',
    assets: [
      { name: 'Port of Tokyo', detail: 'Berth access and shoreline handling posture require review.', severity: 'watch' },
      { name: 'Shinagawa Hub', detail: 'Passenger interchange inspection should start early.', severity: 'watch' },
      { name: "St. Luke's Hospital", detail: 'Hospital access risk remains manageable but monitored.', severity: 'priority' },
    ],
    checks: [
      { name: 'Verify port access condition', detail: 'Coastal access corridors may tighten first.', severity: 'priority' },
      { name: 'Inspect Shinagawa hub', detail: 'Platform and corridor checks should precede passenger routing changes.', severity: 'priority' },
      { name: 'Confirm hospital approach routes', detail: 'Surface access should stay open under strong shaking.', severity: 'watch' },
    ],
    analystTitle: 'The service should convert an event into operator language instantly.',
    analystCopy:
      'This is the core moment: not magnitude first, but operational consequences first.',
    replayNodes: [
      { label: 'Event lock', detail: 'The shell accepts the quake.' },
      { label: 'Impact', detail: 'Field expands over metro assets.' },
      { label: 'Exposure', detail: 'Assets reorder by consequence.' },
      { label: 'Priority', detail: 'Checks become operational.' },
      { label: 'Replay', detail: 'The timeline stays visible.' },
    ],
  },
  focus: {
    statusLabel: 'Focused asset view',
    statusTone: 'focus',
    snapshotTitle: 'Port of Tokyo has become the current operational focus.',
    snapshotBody:
      'The shell tightens around a single asset without leaving the main screen. Impact, reasoning, and actions should shift together.',
    snapshotMeta: ['Asset focus: Port of Tokyo', 'Coastal exposure high', 'Rail still monitored', 'Hospital secondary'],
    mapSummary: 'Port-focused context inside the same console shell.',
    assets: [
      { name: 'Port of Tokyo', detail: 'Port access and berth integrity are primary checks.', severity: 'critical' },
      { name: 'Shinagawa Hub', detail: 'Rail remains under watch due to corridor dependency.', severity: 'watch' },
      { name: "St. Luke's Hospital", detail: 'Hospital route monitoring stays active for downstream access impact.', severity: 'priority' },
    ],
    checks: [
      { name: 'Check berth access immediately', detail: 'Port recovery depends on first-mile access confirmation.', severity: 'critical' },
      { name: 'Validate shoreline handling posture', detail: 'Shoreline handling should not rely on stale assumptions.', severity: 'priority' },
      { name: 'Cross-check rail support routes', detail: 'Rail support paths still influence port recovery time.', severity: 'watch' },
    ],
    analystTitle: 'Focus should change context, not force page navigation.',
    analystCopy:
      'This state proves the navigation model. The shell gets narrower, not deeper in a maze.',
    replayNodes: [
      { label: 'Lock', detail: 'Port enters focus.' },
      { label: 'Explain', detail: 'Reasoning narrows to one asset.' },
      { label: 'Prioritize', detail: 'Checks become port-specific.' },
      { label: 'Compare', detail: 'Other assets remain visible.' },
      { label: 'Return', detail: 'User can climb back out.' },
    ],
  },
  scenario: {
    statusLabel: 'Scenario shift active',
    statusTone: 'scenario',
    snapshotTitle: 'A shallower, slightly stronger quake changes both impact and response order.',
    snapshotBody:
      'Scenario Shift is where the product stops being a map and becomes a simulation surface. The delta matters more than the raw event.',
    snapshotMeta: ['Magnitude +0.4', 'Depth -20 km', 'Epicenter east shift', 'Consequences recomputed'],
    mapSummary: 'Impact field moved east and widened under scenario shift.',
    assets: [
      { name: 'Port of Tokyo', detail: 'Port exposure escalates into critical posture.', severity: 'critical' },
      { name: 'Shinagawa Hub', detail: 'Rail hub moves into higher inspection urgency.', severity: 'critical' },
      { name: "St. Luke's Hospital", detail: 'Hospital exposure increases but remains below port and rail.', severity: 'priority' },
    ],
    checks: [
      { name: 'Re-run port access assumptions', detail: 'Coastal shift invalidates the earlier port baseline.', severity: 'critical' },
      { name: 'Advance rail inspection order', detail: 'Rail checks move forward after the scenario recompute.', severity: 'critical' },
      { name: 'Explain the delta', detail: 'Operator should see why the order changed, not just that it changed.', severity: 'priority' },
    ],
    analystTitle: 'Scenario Shift should feel consequential, not decorative.',
    analystCopy:
      'The service should show how consequences change when the quake changes. That is the flagship interaction.',
    replayNodes: [
      { label: 'Shift', detail: 'Magnitude, depth, location move.' },
      { label: 'Recompute', detail: 'Impact field updates instantly.' },
      { label: 'Reorder', detail: 'Asset exposure changes rank.' },
      { label: 'Explain', detail: 'Why this changed becomes explicit.' },
      { label: 'Decide', detail: 'Checks update with the model.' },
    ],
  },
};

export const LAB_TABS: LabTab[] = [
  {
    id: 'console',
    label: 'Console',
    kicker: 'Canonical Surface',
    title: 'One screen. Four blocks. Zero dashboard clutter.',
    body: 'This is the live surface we are designing toward. The route is product-first, not documentation-first.',
  },
  {
    id: 'design',
    label: 'Design System',
    kicker: 'Visual Foundation',
    title: 'Every pixel is a decision. Every token is a contract.',
    body: 'The complete visual language for an operator-grade spatial console. Colors, typography, surfaces, severity, spacing, and motion.',
  },
  {
    id: 'states',
    label: 'States',
    kicker: 'Operational Sequence',
    title: 'Calm, live, focused, and simulated states should read like one machine.',
    body: 'The sequence matters more than the individual panels. The shell should stay consistent while context tightens.',
  },
  {
    id: 'components',
    label: 'Components',
    kicker: 'System Grammar',
    title: 'Each panel has one job and one signal hierarchy.',
    body: 'The workbench documents the operational grammar so future edits do not dilute the console.',
  },
  {
    id: 'architecture',
    label: 'Architecture',
    kicker: 'Code Ownership',
    title: 'Service shell, lab surface, and legacy bootstrap are deliberately separated.',
    body: 'The point of the split is maintenance quality. New work should never be trapped in the legacy bootstrap again.',
  },
  {
    id: 'voice',
    label: 'Voice',
    kicker: 'Operator Language',
    title: 'The product speaks like a trusted analyst, not a chatbot or a news feed.',
    body: 'Tone is part of the interface. If the language gets soft, noisy, or theatrical, the product loses trust.',
  },
];

export const SERVICE_SUPPORT_CARDS = [
  {
    title: 'Operational Frame',
    body: 'Root route is the service surface. It should feel like an always-on console, not a documentation landing page.',
  },
  {
    title: 'Launch Assets',
    body: 'Ports, rail hubs, and hospitals remain the first asset grammar for Tokyo-first operations.',
  },
  {
    title: 'Workbench Route',
    body: 'Deep design review, component specs, and architecture mapping live behind `/lab`, not on the service root.',
  },
];

export const STATE_PLATES: StatePlate[] = [
  { name: 'Calm Mode', tag: 'ready state', copy: 'No critical event is active, but the system stays loaded and useful.' },
  { name: 'Event Lock', tag: 'live event', copy: 'A quake becomes an operating picture instead of a list item.' },
  { name: 'Focused Asset', tag: 'asset context', copy: 'The shell narrows around one asset without a page jump.' },
  { name: 'Scenario Shift', tag: 'simulation', copy: 'A changed quake recomputes exposure, priorities, and reasoning.' },
];

export const COMPONENT_SPECS: ComponentSpec[] = [
  {
    name: 'Event Snapshot',
    role: 'Declare what changed in operational terms.',
    contains: 'One event, one interpretation, supporting meta, no narrative sprawl.',
    avoid: 'Generic quake cards, consumer copy, or long explanatory prose.',
  },
  {
    name: 'Asset Exposure',
    role: 'Order exposed assets by operational consequence.',
    contains: 'Ranked assets, severity labels, clear supporting detail.',
    avoid: 'Decorative pins or unordered lists that hide priority.',
  },
  {
    name: 'Check These Now',
    role: 'Translate the current state into concrete operator checks.',
    contains: 'Short action lines, clear urgency, consequence-aware order.',
    avoid: 'Passive observations or AI chatter with no action attached.',
  },
  {
    name: 'Replay Rail',
    role: 'Explain how the service state developed over time.',
    contains: 'Knowable moments, not raw timestamps alone.',
    avoid: 'Generic timeline widgets with no decision meaning.',
  },
  {
    name: 'Analyst Note',
    role: 'Add compact reasoning without becoming a chatbot.',
    contains: 'Why the shell behaves this way and what changed.',
    avoid: 'Copilot framing, assistant avatars, or theatrical tone.',
  },
];

export const ARCHITECTURE_CARDS: ArchitectureCard[] = [
  {
    title: 'Route Contract',
    body: 'The route split is explicit so product work and legacy work stop contaminating each other.',
    items: ['`/` -> service shell', '`/lab` -> workbench tabs', '`/legacy` -> old globe bootstrap'],
  },
  {
    title: 'Bootstrap Boundary',
    body: 'Entry resolution stays thin. Legacy bootstrap remains isolated and only loads when the route asks for it.',
    items: ['`src/entry.ts` resolves pathname', '`src/main.ts` exports legacy bootstrap only', '`src/namazue/app.ts` owns new shell startup'],
  },
  {
    title: 'Folder Ownership',
    body: 'The new shell should be readable by responsibility, not by accident or history.',
    items: ['`src/namazue/content.ts` for product copy + specs', '`src/namazue/templates.ts` for view rendering', '`src/namazue/styles.css` for shell tokens and layout'],
  },
  {
    title: 'Layer Model',
    body: 'The product model still follows the approved event-to-operations stack.',
    items: ['Event layer', 'Impact layer', 'Asset exposure layer', 'Priority layer', 'Replay / Scenario layer'],
  },
  {
    title: 'Maintenance Rule',
    body: 'No new route should depend on the legacy bootstrap tree. Shared code must be tiny and explicit.',
    items: ['No route-specific DOM cross-talk', 'No legacy imports from new shell code', 'Static review content lives in typed registries'],
  },
  {
    title: 'Deployment Rule',
    body: 'Cloudflare Pages must resolve nested routes directly so `/lab` and `/legacy` can be checked on the live domain.',
    items: ['SPA fallback via `_redirects`', 'Keep route links absolute', 'Preserve direct reload behavior on live URLs'],
  },
];

/* ================================================================
   DESIGN SYSTEM DATA
   ================================================================ */

export interface DesignColor {
  name: string;
  token: string;
  value: string;
  usage: string;
}

export interface DesignTypeSpec {
  label: string;
  family: 'display' | 'body' | 'mono';
  weight: string;
  size: string;
  tracking: string;
  sample: string;
}

export interface DesignSurface {
  name: string;
  level: string;
  desc: string;
}

export interface DesignSeveritySpec {
  id: 'clear' | 'watch' | 'priority' | 'critical';
  name: string;
  desc: string;
  color: string;
  glow: string;
  surface: string;
}

export interface DesignSpacing {
  token: string;
  px: number;
}

export interface DesignMotion {
  name: string;
  easing: string;
  duration: string;
  use: string;
}

export const DESIGN_COLORS: DesignColor[] = [
  { name: 'Background 0', token: '--nz-bg-0', value: '#040a11', usage: 'Page foundation' },
  { name: 'Background 1', token: '--nz-bg-1', value: '#07111c', usage: 'Primary background' },
  { name: 'Background 2', token: '--nz-bg-2', value: '#0b1624', usage: 'Elevated background' },
  { name: 'Background 3', token: '--nz-bg-3', value: '#0f1d2f', usage: 'Highest background' },
  { name: 'Surface 0', token: '--nz-surface-0', value: 'rgba(8,18,30,0.88)', usage: 'Card base' },
  { name: 'Surface 1', token: '--nz-surface-1', value: 'rgba(11,22,36,0.92)', usage: 'Elevated card' },
  { name: 'Surface 2', token: '--nz-surface-2', value: 'rgba(14,27,42,0.85)', usage: 'Nested element' },
  { name: 'Text 100', token: '--nz-text-100', value: '#f0f6fc', usage: 'Primary text' },
  { name: 'Text 80', token: '--nz-text-80', value: '#c9d6e3', usage: 'Secondary text' },
  { name: 'Text 60', token: '--nz-text-60', value: '#8da2b5', usage: 'Muted text' },
  { name: 'Text 40', token: '--nz-text-40', value: '#5a7286', usage: 'Subdued text' },
  { name: 'Text 20', token: '--nz-text-20', value: '#3a4f62', usage: 'Hint / disabled' },
  { name: 'Accent', token: '--nz-accent', value: '#5ba3e6', usage: 'Primary interactive' },
  { name: 'Accent Bright', token: '--nz-accent-bright', value: '#8ec8ff', usage: 'Active / highlight' },
  { name: 'Safe', token: '--nz-safe', value: '#5ec99e', usage: 'Clear / nominal' },
  { name: 'Warning', token: '--nz-warn', value: '#e8a44c', usage: 'Watch / elevated' },
  { name: 'Danger', token: '--nz-danger', value: '#e85c5c', usage: 'Critical / urgent' },
];

export const DESIGN_TYPE_SPECS: DesignTypeSpec[] = [
  { label: 'Display XL', family: 'display', weight: '700', size: '88px', tracking: '-0.06em', sample: 'namazue.dev' },
  { label: 'Display LG', family: 'display', weight: '700', size: '52px', tracking: '-0.05em', sample: 'Earthquake Operations Console' },
  { label: 'Display MD', family: 'display', weight: '600', size: '28px', tracking: '-0.04em', sample: 'Event Snapshot' },
  { label: 'Display SM', family: 'display', weight: '600', size: '22px', tracking: '-0.04em', sample: 'Asset Exposure' },
  { label: 'Display XS', family: 'display', weight: '600', size: '18px', tracking: '-0.03em', sample: 'Panel Title' },
  { label: 'Body', family: 'body', weight: '400', size: '14px', tracking: 'normal', sample: 'The console is ready for replay, scenario review, and asset inspection.' },
  { label: 'Body Small', family: 'body', weight: '400', size: '13px', tracking: 'normal', sample: 'Harbor operations visible in calm watch posture.' },
  { label: 'Mono Label', family: 'mono', weight: '600', size: '11px', tracking: '0.14em', sample: 'OPERATIONAL IMPACT ELEVATED' },
  { label: 'Mono Code', family: 'mono', weight: '400', size: '12px', tracking: '0.02em', sample: '--nz-accent: #5ba3e6' },
  { label: 'Mono Small', family: 'mono', weight: '500', size: '10px', tracking: '0.12em', sample: 'TOKYO METRO OPERATIONS' },
];

export const DESIGN_SURFACES: DesignSurface[] = [
  { name: 'Page', level: 'level-0', desc: 'Root background. Darkest layer. No elevation.' },
  { name: 'Card', level: 'level-1', desc: 'Primary card surface. Slight inner glow on top edge.' },
  { name: 'Elevated', level: 'level-2', desc: 'Nested panels and overlays. Medium shadow.' },
  { name: 'Float', level: 'level-3', desc: 'Tooltips and popovers. Backdrop blur active.' },
  { name: 'Glow', level: 'level-glow', desc: 'Accent-highlighted cards. Gradient border top. Analyst notes.' },
];

export const DESIGN_SEVERITY_SPECS: DesignSeveritySpec[] = [
  {
    id: 'clear',
    name: 'Clear',
    desc: 'Nominal operations. No action required.',
    color: '#5ec99e',
    glow: 'rgba(94,201,158,0.20)',
    surface: 'rgba(94,201,158,0.07)',
  },
  {
    id: 'watch',
    name: 'Watch',
    desc: 'Monitoring active. Situation awareness elevated.',
    color: '#5ba3e6',
    glow: 'rgba(91,163,230,0.25)',
    surface: 'rgba(91,163,230,0.08)',
  },
  {
    id: 'priority',
    name: 'Priority',
    desc: 'Action expected. Inspection or verification needed.',
    color: '#e8a44c',
    glow: 'rgba(232,164,76,0.22)',
    surface: 'rgba(232,164,76,0.07)',
  },
  {
    id: 'critical',
    name: 'Critical',
    desc: 'Immediate action. Operational disruption likely.',
    color: '#e85c5c',
    glow: 'rgba(232,92,92,0.22)',
    surface: 'rgba(232,92,92,0.07)',
  },
];

export const DESIGN_SPACING: DesignSpacing[] = [
  { token: 'space-1', px: 4 },
  { token: 'space-2', px: 8 },
  { token: 'space-3', px: 12 },
  { token: 'space-4', px: 16 },
  { token: 'space-5', px: 20 },
  { token: 'space-6', px: 24 },
  { token: 'space-7', px: 32 },
  { token: 'space-8', px: 40 },
  { token: 'space-9', px: 48 },
  { token: 'space-10', px: 64 },
  { token: 'space-11', px: 80 },
  { token: 'space-12', px: 96 },
];

export const DESIGN_MOTIONS: DesignMotion[] = [
  { name: 'Fast', easing: 'cubic-bezier(0.16, 1, 0.3, 1)', duration: '120ms', use: 'Micro-feedback: button press, hover color' },
  { name: 'Normal', easing: 'cubic-bezier(0.16, 1, 0.3, 1)', duration: '200ms', use: 'Standard transitions: panels, badges, borders' },
  { name: 'Smooth', easing: 'cubic-bezier(0.4, 0, 0.2, 1)', duration: '380ms', use: 'Layout shifts, content entrance' },
  { name: 'Spring', easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', duration: '500ms', use: 'Playful emphasis, tooltip bounce' },
];

export const VOICE_CARDS: VoiceCard[] = [
  {
    title: 'Good Voice',
    tone: 'good',
    intro: 'Short, calm, and operational language should dominate the surface.',
    lines: [
      'Operational impact elevated across coastal Tokyo',
      '3 assets require immediate inspection',
      'Scenario shift increased port exposure',
      'Rail access risk is rising in the eastern corridor',
    ],
  },
  {
    title: 'Forbidden Phrases',
    tone: 'bad',
    intro: 'Anything that sounds like a chatbot, safety PSA, or marketing site weakens the product.',
    lines: [
      'Do not worry',
      'AI will help you understand this event',
      'This shocking quake changes everything',
      'You are safe now',
    ],
  },
];
