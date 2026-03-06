import { resolveAppRoute } from './namazue/routeModel';

async function start(): Promise<void> {
  const route = resolveAppRoute(window.location.pathname);

  if (route === 'lab') {
    const { bootstrapNamazueApp } = await import('./namazue/app');
    bootstrapNamazueApp();
    return;
  }

  // Default: new spatial console
  const app = document.getElementById('app');
  if (!app) throw new Error('Missing #app root');
  const { bootstrapConsole } = await import('./runtime/consoleRuntime');
  await bootstrapConsole(app);
}

start().catch((error) => {
  console.error('[namazue] entry bootstrap failed:', error);
});
