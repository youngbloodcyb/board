import { defineConfig } from 'drizzle-kit';
import { Signer } from '@aws-sdk/rds-signer';

const signer = new Signer({
  hostname: process.env.PGHOST!,
  port: Number(process.env.PGPORT ?? 5432),
  username: process.env.PGUSER!,
  region: process.env.AWS_REGION!,
});

const token = await signer.getAuthToken();

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './src/db/drizzle',
  dbCredentials: {
    url: `postgresql://${process.env.PGUSER}:${encodeURIComponent(token)}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}?sslmode=${process.env.PGSSLMODE ?? 'require'}`,
  },
});
