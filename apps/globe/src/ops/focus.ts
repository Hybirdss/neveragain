import type { EarthquakeEvent } from '../types';
import type { OpsFocus, OpsPriority } from './types';

export function selectConsoleFocus(input: {
  selectedEvent: EarthquakeEvent | null;
  priorities: OpsPriority[];
}): OpsFocus {
  if (!input.selectedEvent || input.priorities.length === 0) {
    return { type: 'calm' };
  }

  return { type: 'event', earthquakeId: input.selectedEvent.id };
}
