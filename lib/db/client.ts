import postgres, { type Sql } from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '@/lib/db/schema';

let sqlClient: Sql | null = null;
let database: PostgresJsDatabase<typeof schema> | null = null;

function getConnectionString(): string {
  return process.env.DATABASE_URL || '';
}

export function isDatabaseEnabled(): boolean {
  return Boolean(getConnectionString());
}

export function getDb(): PostgresJsDatabase<typeof schema> | null {
  const connectionString = getConnectionString();
  if (!connectionString) {
    return null;
  }

  if (!database) {
    sqlClient = postgres(connectionString, {
      max: 5,
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: 'require',
    });
    database = drizzle(sqlClient, { schema });
  }

  return database;
}

export async function closeDb(): Promise<void> {
  if (sqlClient) {
    await sqlClient.end();
  }
  sqlClient = null;
  database = null;
}
