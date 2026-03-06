import type { Vessel, VesselType } from '../data/aisManager';

export interface MaritimeOverview {
  totalTracked: number;
  highPriorityTracked: number;
  underwayCount: number;
  anchoredCount: number;
  summary: string;
}

export function isHighPriorityVessel(type: VesselType): boolean {
  return type === 'passenger' || type === 'tanker';
}

export function buildMaritimeOverview(vessels: Vessel[]): MaritimeOverview {
  const totalTracked = vessels.length;
  const highPriorityTracked = vessels.filter((v) => isHighPriorityVessel(v.type)).length;
  const underwayCount = vessels.filter((v) => v.sog > 0.5).length;
  const anchoredCount = totalTracked - underwayCount;

  if (totalTracked === 0) {
    return {
      totalTracked: 0,
      highPriorityTracked: 0,
      underwayCount: 0,
      anchoredCount: 0,
      summary: 'No tracked traffic',
    };
  }

  const parts = [`${totalTracked} tracked`];
  if (highPriorityTracked > 0) parts.push(`${highPriorityTracked} high-priority`);
  if (underwayCount > 0) parts.push(`${underwayCount} underway`);
  if (anchoredCount > 0) parts.push(`${anchoredCount} anchored`);

  return {
    totalTracked,
    highPriorityTracked,
    underwayCount,
    anchoredCount,
    summary: parts.join(' · '),
  };
}
