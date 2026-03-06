import { prepareAnalysisForEvent } from '@namazue/db';

interface DeliveryEventInput {
  magnitude: number;
  depth_km: number;
  lat: number;
  lng: number;
  place?: string | null;
  place_ja?: string | null;
}

export function prepareAnalysisForDelivery(
  analysis: unknown,
  event: DeliveryEventInput,
): Record<string, any> | null {
  return prepareAnalysisForEvent(analysis, event);
}
