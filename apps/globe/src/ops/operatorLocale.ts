import type { OperatorViewId } from '../layers/bundleRegistry';
import type { BundleId } from '../layers/layerRegistry';
import { getLocale, type Locale } from '../i18n';
import type {
  CanonicalEventConfidence,
  CanonicalEventSource,
} from '../data/eventEnvelope';
import type { OperatorBundleTrust, RealtimeState } from './readModelTypes';
import type { OpsAsset, OpsAssetClass, OpsRegion, OpsSeverity } from './types';

function localeValue<T>(values: Record<Locale, T>): T {
  return values[getLocale()];
}

export function operatorText(key: string, vars: Record<string, string | number> = {}): string {
  const text = localeValue({
    en: EN_TEXT[key] ?? key,
    ko: KO_TEXT[key] ?? EN_TEXT[key] ?? key,
    ja: JA_TEXT[key] ?? EN_TEXT[key] ?? key,
  });

  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ''));
}

export function formatOperatorRegion(region: OpsRegion | null | undefined): string {
  if (!region) {
    return operatorText('region.japan');
  }

  return localeValue({
    en: {
      hokkaido: 'Hokkaido',
      tohoku: 'Tohoku',
      kanto: 'Kanto',
      chubu: 'Chubu',
      kansai: 'Kansai',
      chugoku: 'Chugoku',
      shikoku: 'Shikoku',
      kyushu: 'Kyushu',
    }[region],
    ko: {
      hokkaido: '홋카이도',
      tohoku: '도호쿠',
      kanto: '간토',
      chubu: '주부',
      kansai: '간사이',
      chugoku: '주고쿠',
      shikoku: '시코쿠',
      kyushu: '규슈',
    }[region],
    ja: {
      hokkaido: '北海道',
      tohoku: '東北',
      kanto: '関東',
      chubu: '中部',
      kansai: '関西',
      chugoku: '中国',
      shikoku: '四国',
      kyushu: '九州',
    }[region],
  });
}

export function formatSeverityLabel(severity: OpsSeverity, uppercase = false): string {
  const value = localeValue({
    en: {
      clear: 'clear',
      watch: 'watch',
      priority: 'priority',
      critical: 'critical',
    }[severity],
    ko: {
      clear: '안정',
      watch: '주의',
      priority: '우선',
      critical: '긴급',
    }[severity],
    ja: {
      clear: '安定',
      watch: '注意',
      priority: '優先',
      critical: '緊急',
    }[severity],
  });

  return uppercase && getLocale() === 'en' ? value.toUpperCase() : value;
}

export function formatRealtimeStateLabel(state: RealtimeState): string {
  return localeValue({
    en: { fresh: 'fresh', stale: 'stale', degraded: 'degraded' }[state],
    ko: { fresh: '최신', stale: '지연', degraded: '저하' }[state],
    ja: { fresh: '最新', stale: '遅延', degraded: '劣化' }[state],
  });
}

export function formatTrustLabel(trust: OperatorBundleTrust): string {
  return localeValue({
    en: trust,
    ko: {
      confirmed: '확정',
      review: '검토',
      degraded: '저하',
      pending: '대기',
    }[trust],
    ja: {
      confirmed: '確認済み',
      review: '要確認',
      degraded: '劣化',
      pending: '待機',
    }[trust],
  });
}

export function formatSourceLabel(source: CanonicalEventSource): string {
  return localeValue({
    en: {
      server: 'Server',
      usgs: 'USGS',
      jma: 'JMA',
      historical: 'Historical',
      scenario: 'Scenario',
    }[source],
    ko: {
      server: '서버',
      usgs: 'USGS',
      jma: 'JMA',
      historical: '과거 사례',
      scenario: '시나리오',
    }[source],
    ja: {
      server: 'サーバー',
      usgs: 'USGS',
      jma: '気象庁',
      historical: '過去事例',
      scenario: 'シナリオ',
    }[source],
  });
}

export function formatConfidenceLabel(confidence: CanonicalEventConfidence): string {
  return localeValue({
    en: {
      high: 'High confidence',
      medium: 'Medium confidence',
      low: 'Low confidence',
    }[confidence],
    ko: {
      high: '신뢰도 높음',
      medium: '신뢰도 보통',
      low: '신뢰도 낮음',
    }[confidence],
    ja: {
      high: '高信頼',
      medium: '中信頼',
      low: '低信頼',
    }[confidence],
  });
}

export function formatBundleLabel(bundleId: BundleId): string {
  return localeValue({
    en: {
      seismic: 'Seismic',
      maritime: 'Maritime',
      lifelines: 'Lifelines',
      medical: 'Medical',
      'built-environment': 'Built Environment',
    }[bundleId],
    ko: {
      seismic: '지진',
      maritime: '해상',
      lifelines: '기간망',
      medical: '의료',
      'built-environment': '도시 구조물',
    }[bundleId],
    ja: {
      seismic: '地震',
      maritime: '海上',
      lifelines: 'ライフライン',
      medical: '医療',
      'built-environment': '都市構造物',
    }[bundleId],
  });
}

export function formatBundleDescription(bundleId: BundleId): string {
  return localeValue({
    en: {
      seismic: 'Event truth, shaking fields, and fault context.',
      maritime: 'Ships, port approaches, and coastal operational posture.',
      lifelines: 'Rail, power, water, and telecom corridors.',
      medical: 'Hospital access and clinical response posture.',
      'built-environment': '3D buildings and urban structural context.',
    }[bundleId],
    ko: {
      seismic: '기준 이벤트, 진동장, 단층 맥락을 봅니다.',
      maritime: '선박, 항만 접근, 연안 운영 상태를 봅니다.',
      lifelines: '철도, 전력, 상수도, 통신 축을 봅니다.',
      medical: '병원 접근성과 의료 대응 상태를 봅니다.',
      'built-environment': '3D 건물과 도시 구조 맥락을 봅니다.',
    }[bundleId],
    ja: {
      seismic: '基準イベント、揺れ場、断層文脈を確認します。',
      maritime: '船舶、港湾アプローチ、沿岸運用の状態を確認します。',
      lifelines: '鉄道、電力、水道、通信の回廊を確認します。',
      medical: '病院アクセスと医療対応の状態を確認します。',
      'built-environment': '3D建築物と都市構造の文脈を確認します。',
    }[bundleId],
  });
}

export function formatOperatorViewLabel(viewId: OperatorViewId): string {
  return localeValue({
    en: {
      'national-impact': 'National Impact',
      'coastal-operations': 'Coastal Operations',
      'rail-stress': 'Rail Stress',
      'medical-access': 'Medical Access',
      'built-environment': 'Built Environment',
    }[viewId],
    ko: {
      'national-impact': '전국 영향',
      'coastal-operations': '연안 운영',
      'rail-stress': '철도 스트레스',
      'medical-access': '의료 접근',
      'built-environment': '도시 구조물',
    }[viewId],
    ja: {
      'national-impact': '全国影響',
      'coastal-operations': '沿岸運用',
      'rail-stress': '鉄道ストレス',
      'medical-access': '医療アクセス',
      'built-environment': '都市構造物',
    }[viewId],
  });
}

export function formatAssetClassLabel(assetClass: OpsAssetClass): string {
  return localeValue({
    en: {
      port: 'port',
      rail_hub: 'rail hub',
      hospital: 'hospital',
      power_substation: 'power substation',
      water_facility: 'water facility',
      telecom_hub: 'telecom hub',
      building_cluster: 'building cluster',
    }[assetClass],
    ko: {
      port: '항만',
      rail_hub: '철도 거점',
      hospital: '병원',
      power_substation: '전력 거점',
      water_facility: '상수도 거점',
      telecom_hub: '통신 거점',
      building_cluster: '건물 군집',
    }[assetClass],
    ja: {
      port: '港湾',
      rail_hub: '鉄道拠点',
      hospital: '病院',
      power_substation: '電力拠点',
      water_facility: '上水施設',
      telecom_hub: '通信拠点',
      building_cluster: '建物クラスター',
    }[assetClass],
  });
}

export function buildPriorityTitle(asset: OpsAsset): string {
  switch (asset.class) {
    case 'port':
      return localeValue({
        en: `Verify ${asset.name} access`,
        ko: `${asset.name} 접근 상태 확인`,
        ja: `${asset.name}のアクセス状況を確認`,
      });
    case 'rail_hub':
      return localeValue({
        en: `Inspect ${asset.name.replace(' Station', '')} rail hub`,
        ko: `${asset.name} 철도 거점 점검`,
        ja: `${asset.name}鉄道拠点を点検`,
      });
    case 'hospital':
      return localeValue({
        en: `Confirm ${asset.name} access posture`,
        ko: `${asset.name} 의료 접근 상태 확인`,
        ja: `${asset.name}の医療アクセス状況を確認`,
      });
    case 'power_substation':
      return localeValue({
        en: `Verify ${asset.name} power posture`,
        ko: `${asset.name} 전력 상태 확인`,
        ja: `${asset.name}の電力状態を確認`,
      });
    case 'water_facility':
      return localeValue({
        en: `Verify ${asset.name} water posture`,
        ko: `${asset.name} 용수 공급 상태 확인`,
        ja: `${asset.name}の給水状態を確認`,
      });
    case 'telecom_hub':
      return localeValue({
        en: `Verify ${asset.name} telecom posture`,
        ko: `${asset.name} 통신 상태 확인`,
        ja: `${asset.name}の通信状態を確認`,
      });
    case 'building_cluster':
      return localeValue({
        en: `Review ${asset.name} built-environment posture`,
        ko: `${asset.name} 도시 구조 상태 검토`,
        ja: `${asset.name}の都市構造状態を確認`,
      });
  }
}

export function buildPriorityRationale(input: {
  region: OpsRegion;
  assetClass: OpsAssetClass;
  severity: OpsSeverity;
  reasons: string[];
}): string {
  const region = formatOperatorRegion(input.region);
  const assetLabel = formatAssetClassLabel(input.assetClass);
  const severity = formatSeverityLabel(input.severity);
  const reasons = input.reasons.join(', ');

  return localeValue({
    en: `${region} ${assetLabel} posture is ${severity} because ${reasons}.`,
    ko: `${region} 권역의 ${assetLabel} 상태는 ${severity}입니다. 근거: ${reasons}.`,
    ja: `${region}の${assetLabel}状態は${severity}です。根拠: ${reasons}。`,
  });
}

export function formatElevatedAssetSummary(count: number, scope: 'visible' | 'national'): string {
  if (getLocale() === 'en') {
    if (scope === 'visible') {
      return count === 1
        ? '1 visible asset in elevated posture'
        : `${count} visible assets in elevated posture`;
    }

    return count === 1
      ? '1 asset in elevated posture nationwide'
      : `${count} assets in elevated posture nationwide`;
  }

  return operatorText(scope === 'visible' ? 'ops.visibleElevated' : 'ops.nationalElevated', { count });
}

const EN_TEXT: Record<string, string> = {
  'region.japan': 'Japan',
  'panel.eventTruth': 'Event Truth',
  'panel.checkTheseNow': 'Check These Now',
  'event.conflict': 'Conflict detected',
  'event.materialDivergence': 'Material divergence',
  'event.dataPending': 'Data pending',
  'event.dataState': 'Data {state}',
  'event.truthLabel': '{source} truth',
  'count.revisions': '{count} revisions',
  'queue.more': '{count} more queued',
  'metric.magnitude': 'Magnitude',
  'metric.depth': 'Depth',
  'metric.elapsed': 'Elapsed',
  'time.justNow': 'just now',
  'time.minutesAgo': '{count}m ago',
  'time.hoursAgo': '{count}h ago',
  'time.daysAgo': '{count}d ago',
  'status.monitoringActive': 'Monitoring active',
  'health.degradedHeadline': 'Realtime feed degraded',
  'health.degradedDetail': 'Fallback realtime feed active. Verify source confidence before acting.',
  'health.materialHeadline': 'Material revision divergence detected',
  'health.materialDetail': 'Source revisions diverge materially and require operator review.',
  'health.conflictHeadline': 'Conflicting source revisions detected',
  'health.lowConfidenceHeadline': 'Selected event truth is low confidence',
  'health.staleHeadline': 'Realtime updates are delayed',
  'health.conflictDetail': '{count} revisions from {sources} require operator review.',
  'health.lowConfidenceDetail': 'Selected truth originates from a low-confidence {source} revision. Verify before acting.',
  'health.staleDetail': 'Primary feed is stale; decisions may lag current field conditions.',
  'health.nominalHeadline': 'Primary realtime feed healthy',
  'health.nominalDetail': 'No source conflicts or realtime degradation detected.',
  'health.feed': 'feed',
  'health.divergenceDetail': '{count} revisions from {sources} show {details}.',
  'ops.noSignificantEvent': 'No operationally significant event selected',
  'ops.autoSelect': 'Operational focus auto-selected from current incident stream',
  'ops.retainCurrent': 'Operational focus retained on the current incident',
  'ops.escalate': 'Operational focus escalated to a materially stronger incident',
  'ops.active': 'Operational focus active',
  'ops.nationalElevated': '{count} assets in elevated posture nationwide',
  'ops.visibleElevated': '{count} visible assets in elevated posture',
  'ops.noneElevated': 'No assets in elevated posture',
  'system.calm': 'System calm',
  'system.eventActive': 'Event active',
};

const KO_TEXT: Record<string, string> = {
  'region.japan': '일본',
  'panel.eventTruth': '기준 이벤트 정보',
  'panel.checkTheseNow': '우선 확인',
  'event.conflict': '출처 충돌',
  'event.materialDivergence': '중요 불일치',
  'event.dataPending': '데이터 대기',
  'event.dataState': '데이터 {state}',
  'event.truthLabel': '{source} 기준',
  'count.revisions': '리비전 {count}건',
  'queue.more': '대기 {count}건',
  'metric.magnitude': '규모',
  'metric.depth': '깊이',
  'metric.elapsed': '경과',
  'time.justNow': '방금',
  'time.minutesAgo': '{count}분 전',
  'time.hoursAgo': '{count}시간 전',
  'time.daysAgo': '{count}일 전',
  'status.monitoringActive': '감시 중',
  'health.degradedHeadline': '실시간 피드 저하',
  'health.degradedDetail': '대체 실시간 피드가 동작 중입니다. 조치 전 출처 신뢰도를 확인하세요.',
  'health.materialHeadline': '리비전 간 중요 불일치 감지',
  'health.materialDetail': '출처별 리비전 차이가 커서 운영자 검토가 필요합니다.',
  'health.conflictHeadline': '출처 리비전 충돌 감지',
  'health.lowConfidenceHeadline': '선택된 이벤트 신뢰도가 낮습니다',
  'health.staleHeadline': '실시간 업데이트가 지연되고 있습니다',
  'health.conflictDetail': '{sources} 기준 리비전 {count}건이 충돌해 운영자 검토가 필요합니다.',
  'health.lowConfidenceDetail': '{source} 리비전의 신뢰도가 낮습니다. 조치 전 확인하세요.',
  'health.staleDetail': '주 피드가 지연되어 현장 상황 반영이 늦을 수 있습니다.',
  'health.nominalHeadline': '주 실시간 피드 정상',
  'health.nominalDetail': '출처 충돌이나 실시간 저하가 감지되지 않았습니다.',
  'health.feed': '피드',
  'health.divergenceDetail': '{sources} 기준 리비전 {count}건에서 {details} 불일치가 확인됩니다.',
  'ops.noSignificantEvent': '운영상 의미 있는 이벤트가 아직 선택되지 않았습니다',
  'ops.autoSelect': '현재 이벤트 흐름에서 운영 초점이 자동 선택되었습니다',
  'ops.retainCurrent': '현재 이벤트에 운영 초점을 유지합니다',
  'ops.escalate': '더 강한 이벤트로 운영 초점이 상향되었습니다',
  'ops.active': '운영 초점 유지 중',
  'ops.nationalElevated': '전국 기준 경계 상태 자산 {count}건',
  'ops.visibleElevated': '현재 화면 내 경계 상태 자산 {count}건',
  'ops.noneElevated': '경계 상태 자산이 없습니다',
  'system.calm': '시스템 안정',
  'system.eventActive': '이벤트 활성',
};

const JA_TEXT: Record<string, string> = {
  'region.japan': '日本',
  'panel.eventTruth': '基準イベント情報',
  'panel.checkTheseNow': '優先確認',
  'event.conflict': 'ソース競合',
  'event.materialDivergence': '重要な不一致',
  'event.dataPending': 'データ待機',
  'event.dataState': 'データ{state}',
  'event.truthLabel': '{source}基準',
  'count.revisions': '改訂{count}件',
  'queue.more': '残り{count}件',
  'metric.magnitude': '規模',
  'metric.depth': '深さ',
  'metric.elapsed': '経過',
  'time.justNow': 'たった今',
  'time.minutesAgo': '{count}分前',
  'time.hoursAgo': '{count}時間前',
  'time.daysAgo': '{count}日前',
  'status.monitoringActive': '監視中',
  'health.degradedHeadline': 'リアルタイムフィード劣化',
  'health.degradedDetail': '代替リアルタイムフィードで動作中です。対応前にソース信頼度を確認してください。',
  'health.materialHeadline': '改訂間の重要な不一致を検知',
  'health.materialDetail': 'ソース改訂の差分が大きく、運用者の確認が必要です。',
  'health.conflictHeadline': 'ソース改訂の競合を検知',
  'health.lowConfidenceHeadline': '選択中イベントの信頼度が低い状態です',
  'health.staleHeadline': 'リアルタイム更新が遅延しています',
  'health.conflictDetail': '{sources}の改訂{count}件で競合があり、運用確認が必要です。',
  'health.lowConfidenceDetail': '{source}改訂の信頼度が低いため、対応前に確認してください。',
  'health.staleDetail': '主フィードが遅延しており、現地状況の反映が遅れる可能性があります。',
  'health.nominalHeadline': '主リアルタイムフィード正常',
  'health.nominalDetail': 'ソース競合やリアルタイム劣化は検知されていません。',
  'health.feed': 'フィード',
  'health.divergenceDetail': '{sources}の改訂{count}件で {details} の不一致が確認されます。',
  'ops.noSignificantEvent': '運用上重要なイベントはまだ選択されていません',
  'ops.autoSelect': '現在のイベント群から運用フォーカスを自動選択しました',
  'ops.retainCurrent': '現在のイベントに運用フォーカスを維持します',
  'ops.escalate': 'より強いイベントへ運用フォーカスを引き上げました',
  'ops.active': '運用フォーカス継続中',
  'ops.nationalElevated': '全国で警戒姿勢の資産 {count} 件',
  'ops.visibleElevated': '現在画面内で警戒姿勢の資産 {count} 件',
  'ops.noneElevated': '警戒姿勢の資産はありません',
  'system.calm': 'システム安定',
  'system.eventActive': 'イベント有効',
};
