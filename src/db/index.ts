// db/index.ts
import { defineRelations } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { Signer } from '@aws-sdk/rds-signer';
import { awsCredentialsProvider } from '@vercel/oidc-aws-credentials-provider';
import { attachDatabasePool } from '@vercel/functions';
import * as schema from './schema';

const signer = new Signer({
  hostname: process.env.PGHOST!,
  port: Number(process.env.PGPORT ?? 5432),
  username: process.env.PGUSER!,
  region: process.env.AWS_REGION!,
  credentials: awsCredentialsProvider({
    roleArn: process.env.AWS_ROLE_ARN!,
    clientConfig: { region: process.env.AWS_REGION! },
  }),
});

const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT ?? 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: () => signer.getAuthToken(),   // called per new connection
  ssl: { rejectUnauthorized: true },
  max: 1,
});

attachDatabasePool(pool);

const relations = defineRelations(schema);

export const db = drizzle({ client: pool, relations });
