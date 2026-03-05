/**
 * Tsunami Risk Assessment — Re-export from shared module
 *
 * All logic has been centralized in @namazue/db/geo.ts to eliminate
 * duplication across worker, tools, and analysis pipelines.
 */

export { assessTsunamiRisk } from '@namazue/db';
export type { TsunamiRisk } from '@namazue/db';
