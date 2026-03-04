/**
 * Tsunami Risk Assessment — Pure Function
 *
 * Estimates tsunami risk based on earthquake parameters.
 * NOT a prediction — statistical classification only.
 */

interface TsunamiRisk {
  risk: 'high' | 'moderate' | 'low' | 'none';
  source: 'rule_engine';
  confidence: 'high' | 'medium';
  factors: string[];
}

/**
 * Assess tsunami risk from earthquake parameters.
 *
 * Rules (simplified from JMA criteria):
 * - M7.5+ shallow (<60km) offshore reverse fault → high
 * - M6.5+ shallow (<40km) offshore → moderate
 * - M5.5+ offshore → low
 * - Otherwise → none
 */
export function assessTsunamiRisk(
  magnitude: number,
  depth_km: number,
  faultType?: string,
  lat?: number,
  lng?: number,
): TsunamiRisk {
  const factors: string[] = [];

  // Check if offshore (rough Japan coastline approximation)
  const isOffshore = lng !== undefined && lat !== undefined && (
    lng > 142 || // East of Japan trench
    (lat < 34 && lng > 136) || // South of Nankai
    (lat > 40 && lng > 140)    // Off Tohoku/Hokkaido
  );

  if (!isOffshore) {
    return { risk: 'none', source: 'rule_engine', confidence: 'high', factors: ['Inland earthquake'] };
  }

  factors.push('Offshore epicenter');

  if (magnitude >= 7.5 && depth_km < 60) {
    factors.push(`Large magnitude (M${magnitude})`);
    factors.push(`Shallow depth (${depth_km}km)`);
    if (faultType === 'interface') {
      factors.push('Subduction interface mechanism');
    }
    return { risk: 'high', source: 'rule_engine', confidence: 'high', factors };
  }

  if (magnitude >= 6.5 && depth_km < 40) {
    factors.push(`Moderate magnitude (M${magnitude})`);
    factors.push(`Shallow depth (${depth_km}km)`);
    return { risk: 'moderate', source: 'rule_engine', confidence: 'medium', factors };
  }

  if (magnitude >= 5.5) {
    factors.push(`Magnitude M${magnitude}`);
    return { risk: 'low', source: 'rule_engine', confidence: 'medium', factors };
  }

  return { risk: 'none', source: 'rule_engine', confidence: 'high', factors: ['Small offshore event'] };
}
