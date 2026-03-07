import { resolveAppRoute, type AppRoute } from './namazue/routeModel';
import { initializeLocale } from './i18n';

export interface EntryRouteLoaders {
  service(appRoot: HTMLElement): Promise<void>;
  legacy(): Promise<void>;
  lab(): Promise<void>;
}

export const DEFAULT_ENTRY_ROUTE_LOADERS: EntryRouteLoaders = {
  async service(appRoot) {
    const { bootstrapConsole } = await import('./core/bootstrap');
    await bootstrapConsole(appRoot);
  },
  async legacy() {
    const { bootstrapLegacyApp, registerLegacyServiceWorker } = await import('./main');
    registerLegacyServiceWorker();
    await bootstrapLegacyApp();
  },
  async lab() {
    const { bootstrapNamazueApp } = await import('./namazue/app');
    bootstrapNamazueApp('lab');
  },
};

export async function runEntryRoute(
  route: AppRoute,
  options: {
    appRoot?: HTMLElement | null;
    loaders?: Partial<EntryRouteLoaders>;
  } = {},
): Promise<void> {
  const loaders: EntryRouteLoaders = {
    ...DEFAULT_ENTRY_ROUTE_LOADERS,
    ...options.loaders,
  };

  if (route === 'legacy') {
    await loaders.legacy();
    return;
  }

  if (route === 'lab') {
    await loaders.lab();
    return;
  }

  const app = options.appRoot ?? document.getElementById('app');
  if (!app) throw new Error('Missing #app root');
  await loaders.service(app);
}

export async function start(): Promise<void> {
  await initializeLocale();
  const route = resolveAppRoute(window.location.pathname);
  await runEntryRoute(route);
}

if (typeof window !== 'undefined') {
  void start().catch((error) => {
    console.error('[namazue] entry bootstrap failed:', error);
  });
}
