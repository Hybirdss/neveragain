import type { AppState } from '../types';
import type {
  ReplayMilestone,
  ScenarioDelta,
  ServiceReadModel,
  RealtimeStatus,
} from './readModelTypes';

export interface ServiceBackendState {
  readModel: ServiceReadModel;
  realtimeStatus: RealtimeStatus;
  replayMilestones: ReplayMilestone[];
  scenarioDelta: ScenarioDelta | null;
}

export function selectServiceBackendState(state: Pick<
  AppState,
  'serviceReadModel' | 'realtimeStatus' | 'replayMilestones' | 'scenarioDelta'
>): ServiceBackendState {
  if (!state.serviceReadModel) {
    throw new Error('serviceReadModel is required before the service route can render backend truth');
  }

  return {
    readModel: state.serviceReadModel,
    realtimeStatus: state.realtimeStatus,
    replayMilestones: state.replayMilestones,
    scenarioDelta: state.scenarioDelta,
  };
}
