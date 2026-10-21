import { NestFactory } from '@nestjs/core';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module.js';

const SNAPSHOT_FILE = new URL('../data/snapshot.json', import.meta.url);
const NOT_EXPORTED = new Set(['audit_log']);

interface Snapshot {
  exportedAt: string;
  tables: { name: string; rows: Record<string, unknown>[] }[];
}

async function tablesInInsertOrder(dataSource: DataSource): Promise<string[]> {
  const names: string[] = (
    await dataSource.query<{ tablename: string }[]>(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`)
  ).map((row) => row.tablename);
  const links = await dataSource.query<{ child: string; parent: string }[]>(
    `SELECT conrelid::regclass::text AS child, confrelid::regclass::text AS parent
       FROM pg_constraint WHERE contype = 'f' AND connamespace = 'public'::regnamespace`,
  );

  const done: string[] = [];
  const remaining = new Set(names);
  while (remaining.size > 0) {
    const ready = [...remaining]
      .filter((name) =>
        links.filter((link) => link.child === name && link.parent !== name).every((link) => done.includes(link.parent)),
      )
      .sort();
    if (ready.length === 0) {
      throw new Error(`Foreign keys form a cycle between: ${[...remaining].join(', ')}`);
    }
    for (const name of ready) {
      done.push(name);
      remaining.delete(name);
    }
  }
  return done;
}

async function exportSnapshot(dataSource: DataSource): Promise<void> {
  const tables: Snapshot['tables'] = [];
  for (const name of await tablesInInsertOrder(dataSource)) {
    if (NOT_EXPORTED.has(name)) {
      continue;
    }
    const where = name === 'users' ? `WHERE role <> 'superuser'` : '';
    const result = await dataSource.query<{ row: Record<string, unknown> }[]>(
      `SELECT to_jsonb(t) AS row FROM "${name}" t ${where} ORDER BY to_jsonb(t)::text`,
    );
    tables.push({ name, rows: result.map((r) => r.row) });
  }

  const text =
    `{\n  "exportedAt": ${JSON.stringify(new Date().toISOString())},\n  "tables": [\n` +
    tables
      .map(
        (table) =>
          `    { "name": ${JSON.stringify(table.name)}, "rows": [` +
          (table.rows.length ? `\n${table.rows.map((row) => `      ${JSON.stringify(row)}`).join(',\n')}\n    ` : '') +
          `] }`,
      )
      .join(',\n') +
    `\n  ]\n}\n`;
  mkdirSync(new URL('./', SNAPSHOT_FILE), { recursive: true });
  writeFileSync(SNAPSHOT_FILE, text);

  console.log(`Exported to backend/data/snapshot.json:`);
  for (const table of tables) {
    console.log(`  ${table.name.padEnd(22)} ${table.rows.length} rows`);
  }
}

async function importSnapshot(dataSource: DataSource, confirmed: boolean): Promise<void> {
  let snapshot: Snapshot;
  try {
    snapshot = JSON.parse(readFileSync(SNAPSHOT_FILE, 'utf8')) as Snapshot;
  } catch {
    throw new Error('backend/data/snapshot.json not found. Run "npm run data:export" on the machine that has the data.');
  }

  const options = dataSource.options as { host?: string; port?: number; database?: string };
  const existing = await tablesInInsertOrder(dataSource);
  const missing = snapshot.tables.map((t) => t.name).filter((name) => !existing.includes(name));
  if (missing.length > 0) {
    throw new Error(`The database has no table for: ${missing.join(', ')}. Is the code up to date (git pull)?`);
  }

  let rowsToDelete = 0;
  for (const name of existing) {
    rowsToDelete += Number((await dataSource.query<{ n: string }[]>(`SELECT count(*) AS n FROM "${name}"`))[0].n);
  }
  rowsToDelete -= Number((await dataSource.query<{ n: string }[]>(`SELECT count(*) AS n FROM users WHERE role = 'superuser'`))[0].n);
  const rowsToLoad = snapshot.tables.reduce((sum, table) => sum + table.rows.length, 0);

  console.log(`Database: ${options.host}:${options.port}/${options.database}`);
  console.log(`Snapshot: exported ${snapshot.exportedAt}, ${rowsToLoad} rows in ${snapshot.tables.length} tables`);
  console.log(`This DELETES ${rowsToDelete} rows (everything except the superuser) and loads the snapshot.`);
  if (!confirmed) {
    console.log('\nNothing was changed. To go ahead: npm run data:import -- --yes');
    return;
  }

  await dataSource.transaction(async (manager) => {
    const superusers = await manager.query<{ row: unknown }[]>(
      `SELECT to_jsonb(u) AS row FROM users u WHERE role = 'superuser'`,
    );
    await manager.query(`TRUNCATE ${existing.map((name) => `"${name}"`).join(', ')} RESTART IDENTITY CASCADE`);

    const insert = (name: string, rows: unknown[]) =>
      manager.query(`INSERT INTO "${name}" SELECT r.* FROM jsonb_populate_recordset(NULL::"${name}", $1::jsonb) r`, [
        JSON.stringify(rows),
      ]);
    for (const table of snapshot.tables) {
      if (table.rows.length > 0) {
        await insert(table.name, table.rows);
      }
    }
    if (superusers.length > 0) {
      await insert('users', superusers.map((s) => s.row));
    }
  });

  console.log('\nDone. Loaded:');
  for (const table of snapshot.tables) {
    console.log(`  ${table.name.padEnd(22)} ${table.rows.length} rows`);
  }
}

async function main() {
  const mode = process.argv[2];
  if (mode !== 'export' && mode !== 'import') {
    console.log('Usage: node dist/data-snapshot.js export | import [--yes]');
    return;
  }
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const dataSource = app.get(DataSource);
    if (mode === 'export') {
      await exportSnapshot(dataSource);
    } else {
      await importSnapshot(dataSource, process.argv.includes('--yes'));
    }
  } finally {
    await app.close();
  }
}

await main();
