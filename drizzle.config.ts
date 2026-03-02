import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!url) {
  console.warn(
    '[drizzle] DIRECT_URL or DATABASE_URL is not set. Commands may fail.'
  );
}

export default defineConfig({
  out: './drizzle',
  schema: './lib/db/schema.ts',
  dialect: 'postgresql',
  tablesFilter: ['billing_*'],
  dbCredentials: {
    url: url || '',
  },
  verbose: true,
  strict: true,
});
