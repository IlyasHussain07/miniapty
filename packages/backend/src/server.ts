import { buildApp } from './app';
import { closeDb } from './db/index';

const PORT = Number(process.env.PORT ?? 3000);
const app = buildApp();

async function start(): Promise<void> {
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

async function shutdown(signal: string): Promise<void> {
  app.log.info(`Received ${signal}, shutting down…`);
  await app.close();
  closeDb();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();
