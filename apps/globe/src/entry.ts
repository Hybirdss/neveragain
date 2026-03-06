import { resolveAppRoute } from './namazue/routeModel';

async function start(): Promise<void> {
  const route = resolveAppRoute(window.location.pathname);

  if (route === 'legacy') {
    const { bootstrapLegacyApp, registerLegacyServiceWorker } = await import('./main');
    registerLegacyServiceWorker();
    await bootstrapLegacyApp();
    return;
  }

  const { bootstrapNamazueApp } = await import('./namazue/app');
  bootstrapNamazueApp(route);
}

start().catch((error) => {
  console.error('[namazue] entry bootstrap failed:', error);
});
