// Purpose: Prisma 7 CLI settings. The connection and the seed command live here, not in schema.prisma or package.json.
// Rules: standards/data.md, standards/security.md. The CLI uses the migrator role (app_owner). The app never reads this file.
// The URL is read from the environment at run time. validate and generate work without it. migrate and db seed need it.
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // T-02 writes prisma/seed.ts. `prisma db seed` runs this command.
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL_MIGRATOR,
  },
});
