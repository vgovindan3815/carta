/**
 * v2.2 migration script — applies 0002_v22_spec.sql to Neon via HTTP (no WebSocket needed).
 * Run: node scripts/migrate-v22.mjs
 */
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env.local') });

const { neon } = createRequire(import.meta.url)('@neondatabase/serverless');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

const sql = neon(DATABASE_URL);

// Read the migration file
const migrationPath = join(__dirname, '..', 'drizzle', '0002_v22_spec.sql');
const migrationSql = readFileSync(migrationPath, 'utf8');

// Split on --> statement-breakpoint and execute each statement
const statements = migrationSql
  .split('--> statement-breakpoint')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

console.log(`Applying ${statements.length} statements...`);

for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i];
  if (!stmt) continue;
  try {
    await sql.unsafe(stmt);
    console.log(`  ✓ Statement ${i + 1}/${statements.length}`);
  } catch (err) {
    if (err.message?.includes('already exists') || err.message?.includes('duplicate column')) {
      console.log(`  ⚠ Statement ${i + 1}: already applied (${err.message.slice(0, 80)})`);
    } else {
      console.error(`  ✗ Statement ${i + 1} failed: ${err.message}`);
      console.error(`    SQL: ${stmt.slice(0, 120)}`);
    }
  }
}

console.log('Migration complete.');
