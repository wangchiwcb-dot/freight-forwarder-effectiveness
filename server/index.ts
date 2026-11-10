import { createApp } from './app.js';
import { readConfig } from './config.js';
import { DemoRepository } from './repositories/demo.js';
import { PostgresRepository } from './repositories/postgres.js';

async function main() {
  const config = readConfig();
  const repository =
    config.DATA_SOURCE === 'demo' ? new DemoRepository() : new PostgresRepository(config);
  const app = await createApp(config, repository, () => new Date(), true);
  for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.once(signal, () => {
      void app.close().then(() => process.exit(0));
    });
  await repository.ready();
  await app.listen({ host: config.HOST, port: config.PORT });
}
main().catch(() => {
  // Do not emit connection strings or raw database errors to logs.
  process.stderr.write(
    'Server startup failed. Check configuration, database access and built static files.\n',
  );
  process.exit(1);
});
