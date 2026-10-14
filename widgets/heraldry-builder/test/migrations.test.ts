// The committed migrations are the only schema source. These tests apply them to empty databases
// and prove 0001 reproduces the schema production was created from (test/fixtures/production-schema.sql).
import { applyD1Migrations, env } from 'cloudflare:test';
import { afterEach, describe, it, expect } from 'vitest';
import productionSchema from './fixtures/production-schema.sql?raw';
import readme from '../README.md?raw';

interface SchemaObject { type: string; name: string; tbl_name: string; sql: string }

/** Comments and whitespace differ between files that create the same object; the statement doesn't. */
function normaliseSql(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([(),])\s*/g, '$1')
    .replace(/^CREATE (UNIQUE )?(TABLE|INDEX) IF NOT EXISTS /i, 'CREATE $1$2 ')
    .trim();
}

async function schemaObjects(db: D1Database): Promise<SchemaObject[]> {
  const { results } = await db.prepare(
    `SELECT type, name, tbl_name, sql FROM sqlite_master
     WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations'
     ORDER BY type, name`
  ).all<SchemaObject>();
  return results.map((o) => ({ ...o, sql: normaliseSql(o.sql) }));
}

async function execAll(db: D1Database, sql: string) {
  const statements = sql.replace(/--[^\n]*/g, '').split(';').map((s) => s.trim()).filter(Boolean);
  await db.batch(statements.map((s) => db.prepare(s)));
}

const [init, ...laterMigrations] = env.MIGRATIONS;
const DESIGN_MODEL = env.MIGRATIONS.findIndex((m) => m.name === '0007_design_model.sql');

/** A row as the schema before the design-model reset has it. */
const insertOldArms = (id: string) =>
  env.MIGRATION_DB.prepare(
    `INSERT INTO arms (id, registry_id, display_name, design, signature, blazon, field_division, readability,
       edit_secret_hash, created_at, updated_at)
     VALUES (?, 'default', 'Name', '{}', ?, 'Vert', 'plain', 'bold', 'h', '2026-10-03T00:00:00Z', '2026-10-03T00:00:00Z')`
  ).bind(id, `sig-${id}`);

/** A row of the current schema. */
const insertArms = (id: string, discord: string | null = null) =>
  env.MIGRATION_DB.prepare(
    `INSERT INTO arms (id, registry_id, display_name, contact_discord, design, signature, blazon, partition_key, primary_key,
       readability, edit_secret_hash, created_at, updated_at)
     VALUES (?, 'default', 'Name', ?, '{}', ?, 'Vert', 'plain', NULL, 'bold', 'h', '2026-10-03T00:00:00Z', '2026-10-03T00:00:00Z')`
  ).bind(id, discord, `sig-${id}`);

describe('migrations', () => {
  it('are numbered consecutively from 0001_init', () => {
    expect(init.name).toBe('0001_init.sql');
    const numbers = env.MIGRATIONS.map((m) => parseInt(m.name, 10));
    expect(numbers).toEqual(numbers.map((_, i) => i + 1));
  });

  it('apply cleanly to an empty database (the test database was built that way)', async () => {
    const applied = await env.DB.prepare(`SELECT name FROM d1_migrations ORDER BY id`).all<{ name: string }>();
    expect(applied.results.map((r) => r.name)).toEqual(env.MIGRATIONS.map((m) => m.name));
    const registries = await env.DB.prepare(`SELECT id, name, is_default FROM registries WHERE id = 'default'`).all();
    expect(registries.results).toEqual([{ id: 'default', name: 'Default', is_default: 1 }]);
  });

  it('0001 reproduces the production schema object for object', async () => {
    await execAll(env.BASELINE_DB, productionSchema);
    await applyD1Migrations(env.MIGRATION_DB, [init]);
    const production = await schemaObjects(env.BASELINE_DB);
    expect(production.length).toBeGreaterThan(8);
    expect(await schemaObjects(env.MIGRATION_DB)).toEqual(production);
    const seeded = await env.MIGRATION_DB.prepare(`SELECT id, name, is_default, created_at FROM registries`).all();
    const original = await env.BASELINE_DB.prepare(`SELECT id, name, is_default, created_at FROM registries`).all();
    expect(seeded.results).toEqual(original.results);
  });

  it('0001 is harmless to re-run against a database that already has its tables', async () => {
    const before = await schemaObjects(env.MIGRATION_DB);
    await execAll(env.MIGRATION_DB, init.queries.join(';\n'));
    expect(await schemaObjects(env.MIGRATION_DB)).toEqual(before);
    const registries = await env.MIGRATION_DB.prepare(`SELECT COUNT(*) AS n FROM registries`).first<{ n: number }>();
    expect(registries!.n).toBe(1);
  });

  it('0002–0006 carry existing arms and tags across the tags table rebuild', async () => {
    await env.MIGRATION_DB.batch([
      insertOldArms('a1'),
      insertOldArms('a2'),
      env.MIGRATION_DB.prepare(`INSERT INTO arms_tags (arms_id, registry_id, tag) VALUES ('a1', 'default', 'charge:wolf'), ('a1', 'default', 'tincture:or'), ('a2', 'default', 'charge:wolf')`),
    ]);
    expect(DESIGN_MODEL).toBe(env.MIGRATIONS.length - 1);
    await applyD1Migrations(env.MIGRATION_DB, env.MIGRATIONS.slice(0, DESIGN_MODEL));
    expect(laterMigrations.length).toBeGreaterThan(0);

    const tags = await env.MIGRATION_DB.prepare(`SELECT arms_id, tag FROM arms_tags ORDER BY arms_id, tag`).all();
    expect(tags.results).toEqual([
      { arms_id: 'a1', tag: 'charge:wolf' },
      { arms_id: 'a1', tag: 'tincture:or' },
      { arms_id: 'a2', tag: 'charge:wolf' },
    ]);
  });

  it('0005 gives rows that already exist the words they stored, as padded lowercase words', async () => {
    const rows = await env.MIGRATION_DB.prepare(`SELECT id, search_text FROM arms ORDER BY id`).all();
    expect(rows.results).toEqual([{ id: 'a1', search_text: ' name vert ' }, { id: 'a2', search_text: ' name vert ' }]);
    const column = await env.MIGRATION_DB.prepare(`SELECT dflt_value, "notnull" FROM pragma_table_info('arms') WHERE name = 'search_text'`).first();
    expect(column).toEqual({ dflt_value: "''", notnull: 1 });
  });

  it('deleting an arms row deletes its tags', async () => {
    await env.MIGRATION_DB.prepare(`DELETE FROM arms WHERE id = 'a1'`).run();
    const tags = await env.MIGRATION_DB.prepare(`SELECT arms_id FROM arms_tags`).all();
    expect(tags.results).toEqual([{ arms_id: 'a2' }]);
  });

  it('allow only one default registry', async () => {
    await expect(
      env.MIGRATION_DB.prepare(`INSERT INTO registries (id, name, is_default, created_at) VALUES ('second', 'Second', 1, 'now')`).run()
    ).rejects.toThrow(/UNIQUE/i);
    await env.MIGRATION_DB.prepare(`INSERT INTO registries (id, name, is_default, created_at) VALUES ('third', 'Third', 0, 'now')`).run();
    await env.MIGRATION_DB.prepare(`INSERT INTO registries (id, name, is_default, created_at) VALUES ('fourth', 'Fourth', 0, 'now')`).run();
  });

  it('0007 empties the arms, tag and owner tables, keeps the registries, and ends at the schema the Worker runs on', async () => {
    await env.MIGRATION_DB.batch([
      env.MIGRATION_DB.prepare(`INSERT INTO owner_emails (arms_id, email_hmac, key_version, created_at) VALUES ('a2', 'h', 1, 'now')`),
      env.MIGRATION_DB.prepare(`INSERT INTO owner_tokens (token_hash, arms_id, created_at, expires_at) VALUES ('t', 'a2', 'now', 'later')`),
    ]);
    await applyD1Migrations(env.MIGRATION_DB, env.MIGRATIONS);
    for (const table of ['arms', 'arms_tags', 'owner_emails', 'owner_tokens']) {
      const n = await env.MIGRATION_DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>();
      expect(n!.n, table).toBe(0);
    }
    const registries = await env.MIGRATION_DB.prepare(`SELECT id FROM registries ORDER BY id`).all();
    expect(registries.results.map((r) => r.id)).toContain('default');
    expect(await schemaObjects(env.MIGRATION_DB)).toEqual(await schemaObjects(env.DB));
  });

  it('0007 keys candidates by partition (required) and primary group (nullable) and drops the old columns', async () => {
    const { results } = await env.MIGRATION_DB.prepare(`SELECT name, "notnull" FROM pragma_table_info('arms')`).all<{ name: string; notnull: number }>();
    const notNull = new Map(results.map((c) => [c.name, c.notnull === 1]));
    expect(notNull.get('partition_key')).toBe(true);
    expect(notNull.get('primary_key')).toBe(false);
    for (const gone of ['contact', 'field_division', 'ordinary', 'charge', 'division_group', 'ordinary_group', 'charge_group']) {
      expect(notNull.has(gone), gone).toBe(false);
    }
    for (const kept of ['contact_discord', 'field_shape', 'search_text']) expect(notNull.has(kept), kept).toBe(true);
  });

  it('keeps the owner email and token tables, served by their lookup indexes', async () => {
    const tables = await env.MIGRATION_DB.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'owner_%' ORDER BY name`).all<{ name: string }>();
    expect(tables.results.map((t) => t.name)).toEqual(['owner_emails', 'owner_tokens']);
    const plan = await env.MIGRATION_DB.prepare(
      `EXPLAIN QUERY PLAN SELECT arms_id FROM owner_emails WHERE email_hmac = ? AND key_version = ?`
    ).bind('h', 1).all<{ detail: string }>();
    expect(plan.results.map((r) => r.detail).join('\n')).toContain('owner_emails_lookup');
  });

  it('checks the Discord username', async () => {
    await insertArms('d-ok', 'some.user_1').run();
    for (const bad of ['a..b', 'x', 'y'.repeat(33), 'Upper', 'no spaces']) {
      await expect(insertArms('d-bad', bad).run(), bad).rejects.toThrow(/CHECK/i);
    }
    await env.MIGRATION_DB.prepare(`DELETE FROM arms WHERE id = 'd-ok'`).run();
  });

  it('cascades an arms deletion to its tags, owner email and tokens', async () => {
    await env.MIGRATION_DB.batch([
      insertArms('c1'),
      env.MIGRATION_DB.prepare(`INSERT INTO arms_tags (arms_id, registry_id, tag) VALUES ('c1', 'default', 'charge:wolf')`),
      env.MIGRATION_DB.prepare(`INSERT INTO owner_emails (arms_id, email_hmac, key_version, created_at) VALUES ('c1', 'h', 1, 'now')`),
      env.MIGRATION_DB.prepare(`INSERT INTO owner_tokens (token_hash, arms_id, created_at, expires_at) VALUES ('t', 'c1', 'now', 'later')`),
    ]);
    await env.MIGRATION_DB.prepare(`DELETE FROM arms WHERE id = 'c1'`).run();
    for (const table of ['arms_tags', 'owner_emails', 'owner_tokens']) {
      const n = await env.MIGRATION_DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>();
      expect(n!.n, table).toBe(0);
    }
  });

  it('serves the candidate lookup from the conflict-key index', async () => {
    const plan = await env.MIGRATION_DB.prepare(
      `EXPLAIN QUERY PLAN SELECT id FROM arms
       WHERE registry_id = ? AND partition_key = ? AND primary_key IS ? ORDER BY created_at, id`
    ).bind('default', 'plain', null).all<{ detail: string }>();
    const detail = plan.results.map((r) => r.detail).join('\n');
    expect(detail).toContain('arms_registry_conflict_keys');
    expect(detail).not.toContain('TEMP B-TREE');
    const gone = await env.MIGRATION_DB.prepare(`SELECT name FROM sqlite_master WHERE name IN ('arms_registry_similar_groups', 'arms_registry_similarity')`).all();
    expect(gone.results).toEqual([]);
  });
});

describe('changing the default registry (README procedure)', () => {
  const NEW_REGISTRY = `INSERT INTO registries (id, name, is_default, created_at) VALUES ('my-shire', 'The Shire of Example', 0, '2026-11-01T00:00:00Z')`;

  /** The statements of the documented "change the default" command, in the documented order. */
  function documentedStatements(): string[] {
    const command = readme.match(/--command "(UPDATE registries SET is_default[^"]*)"/);
    if (!command) throw new Error('README has no default-registry command');
    return command[1].split(';').map((statement) => statement.trim()).filter(Boolean);
  }

  // The database is shared by the tests in this file: put the original registry back as the default.
  afterEach(async () => {
    await env.MIGRATION_DB.batch([
      env.MIGRATION_DB.prepare(`DELETE FROM registries WHERE id = 'my-shire'`),
      env.MIGRATION_DB.prepare(`UPDATE registries SET is_default = 1 WHERE id = 'default'`),
    ]);
  });

  const defaults = async () =>
    (await env.MIGRATION_DB.prepare(`SELECT id FROM registries WHERE is_default = 1`).all<{ id: string }>()).results.map((r) => r.id);

  it('moves the single default to the new registry when run in the documented order', async () => {
    await applyD1Migrations(env.MIGRATION_DB, env.MIGRATIONS);
    await env.MIGRATION_DB.prepare(NEW_REGISTRY).run();
    for (const statement of documentedStatements()) await env.MIGRATION_DB.prepare(statement).run();
    expect(await defaults()).toEqual(['my-shire']);
  });

  it('is why the order matters: setting the new default first is rejected by the one-default index', async () => {
    await applyD1Migrations(env.MIGRATION_DB, env.MIGRATIONS);
    await env.MIGRATION_DB.prepare(NEW_REGISTRY).run();
    await expect(env.MIGRATION_DB.prepare(`UPDATE registries SET is_default = 1 WHERE id = 'my-shire'`).run()).rejects.toThrow();
    expect(await defaults()).toEqual(['default']);
  });

  it('leaves the current default alone when the new id does not exist', async () => {
    await applyD1Migrations(env.MIGRATION_DB, env.MIGRATIONS);
    for (const statement of documentedStatements()) await env.MIGRATION_DB.prepare(statement).run();
    expect(await defaults()).toEqual(['default']);
  });
});
