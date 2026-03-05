export interface CronStepLogger {
  error: (...args: unknown[]) => void;
}

export async function runCronStep<T>(
  label: string,
  work: () => Promise<T>,
  logger: CronStepLogger = console,
): Promise<T | null> {
  try {
    return await work();
  } catch (error) {
    logger.error(`[cron] ${label} failed:`, error);
    return null;
  }
}
