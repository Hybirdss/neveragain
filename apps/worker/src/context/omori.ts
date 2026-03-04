/**
 * Modified Omori Law + Bath's Law — Aftershock Statistics
 *
 * Pure computation: no DB, no API calls.
 */

import type { AftershockStats } from '@namazue/db';

/**
 * Compute aftershock statistics using modified Omori law.
 *
 * Modified Omori: n(t) = K / (t + c)^p
 * Bath's law: largest aftershock ≈ Mw - 1.2
 *
 * @param mainshockMw - Mainshock magnitude
 * @returns AftershockStats object
 */
export function computeOmoriStats(mainshockMw: number): AftershockStats {
  // Bath's law: expected maximum aftershock magnitude
  const bathExpectedMax = mainshockMw - 1.2;

  // Modified Omori parameters (empirical for Japan subduction zone)
  const p = 1.1;  // decay exponent
  const c = 0.05; // time offset (days)

  // Reasenberg & Jones (1989) generic parameters for Japan
  const a = -1.67;
  const b = 0.91;

  // Rate of M≥m aftershocks at time t: λ(t,m) = 10^(a+b*(Mw-m)) / (t+c)^p
  function cumulativeRate(mMin: number, tStart: number, tEnd: number): number {
    // Integrate n(t) from tStart to tEnd
    const coefficient = Math.pow(10, a + b * (mainshockMw - mMin));
    if (Math.abs(p - 1) < 0.01) {
      // p ≈ 1: integral is K * ln((tEnd+c)/(tStart+c))
      return coefficient * Math.log((tEnd + c) / (tStart + c));
    }
    // General case: K * ((tEnd+c)^(1-p) - (tStart+c)^(1-p)) / (1-p)
    return coefficient * (
      Math.pow(tEnd + c, 1 - p) - Math.pow(tStart + c, 1 - p)
    ) / (1 - p);
  }

  // Convert expected count to probability (Poisson: P = 1 - e^(-λ))
  function countToProb(count: number): number {
    return Math.min(99, Math.max(0, (1 - Math.exp(-count)) * 100));
  }

  const rate24h_m4 = cumulativeRate(4.0, 0, 1);     // 0-1 day
  const rate7d_m4 = cumulativeRate(4.0, 0, 7);       // 0-7 days
  const rate24h_m5 = cumulativeRate(5.0, 0, 1);
  const rate7d_m5 = cumulativeRate(5.0, 0, 7);

  return {
    omori: {
      prob_24h_m4plus: Math.round(countToProb(rate24h_m4) * 10) / 10,
      prob_7d_m4plus: Math.round(countToProb(rate7d_m4) * 10) / 10,
      prob_24h_m5plus: Math.round(countToProb(rate24h_m5) * 10) / 10,
      prob_7d_m5plus: Math.round(countToProb(rate7d_m5) * 10) / 10,
    },
    bath_expected_max: Math.round(bathExpectedMax * 10) / 10,
  };
}
