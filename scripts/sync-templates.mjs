#!/usr/bin/env node
/**
 * sync-templates.mjs
 *
 * Reads portzenX/templates/<id>/ and upserts each into Supabase:
 *   schema  → templates.schema  (jsonb)
 *   HTML    → Supabase Storage  templates/<id>.html
 *   metadata→ templates row     (name, category, tags, is_active, preview_url)
 *
 * Usage:
 *   node scripts/sync-templates.mjs [--validate] [--write] [<id> ...]
 *
 * Flags:
 *   --validate  Validate 5-primitive contract before showing diff.
 *               Rejects invalid templates (no write even with --write).
 *   --write     Actually write to Supabase/Storage after showing diff.
 *               Validation is always run when --write is given.
 *   <id>        Specific template IDs to process (default: all folders).
 *
 * Default (no flags): show diff only — never writes.
 *
 * Carve-outs honoured by validator:
 *   (a) image subfield intrinsic keys src/x/y/scale — only "src" needs a
 *       data-subfield annotation; x/y/scale are implicit crop data.
 *   (b) image-type data-field may sit on a container <div> that wraps the
 *       real <img> — valid, not flagged as orphan.
 */

import { createClient } from '@supabase/supabase-js';
import fs  from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT          = path.resolve(__dirname, '..');
const TEMPLATES_DIR = path.join(ROOT, 'templates');

// ── Load .env ─────────────────────────────────────────────────────────────────
{
  const envPath = path.join(ROOT, '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*([^#=\s][^=]*?)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      const [, key, raw] = m;
      if (key in process.env) continue;
      process.env[key] = raw.replace(/^(['"])([\s\S]*)\1$/, '$2');
    }
  }
}

const SUPABASE_URL   = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY    = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const BUCKET         = 'templates';
const VALID_TYPES    = new Set(['text', 'textarea', 'image', 'link', 'repeater']);
const IMAGE_INTRINSIC = new Set(['src', 'x', 'y', 'scale']);

// ── CLI ───────────────────────────────────────────────────────────────────────
const argv        = process.argv.slice(2);
const WRITE       = argv.includes('--write');
const VALIDATE    = argv.includes('--validate') || WRITE;
const EXPLICIT_IDS = argv.filter(a => !a.startsWith('-'));

// ── ANSI colours ──────────────────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',  bold:  '\x1b[1m',
  red:    '\x1b[31m', green: '\x1b[32m',
  yellow: '\x1b[33m', cyan:  '\x1b[36m',
  gray:   '\x1b[90m',
};
const c = (col, s) => `${C[col]}${s}${C.reset}`;

// ── Discovery ─────────────────────────────────────────────────────────────────
function discoverIds() {
  if (EXPLICIT_IDS.length > 0) return EXPLICIT_IDS;
  return fs.readdirSync(TEMPLATES_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name);
}

function loadLocal(id) {
  const dir = path.join(TEMPLATES_DIR, id);

  // Schema: prefer <id>.schema.json, fall back to schema.json
  let schemaPath = path.join(dir, `${id}.schema.json`);
  if (!fs.existsSync(schemaPath)) schemaPath = path.join(dir, 'schema.json');
  if (!fs.existsSync(schemaPath)) throw new Error(`No schema file in templates/${id}/`);

  // HTML: prefer <id>.template.html, fall back to template.html
  let htmlPath = path.join(dir, `${id}.template.html`);
  if (!fs.existsSync(htmlPath)) htmlPath = path.join(dir, 'template.html');
  if (!fs.existsSync(htmlPath)) throw new Error(`No template.html in templates/${id}/`);

  const manifestPath = path.join(dir, 'manifest.json');
  const manifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    : {};

  return {
    id,
    schema:   JSON.parse(fs.readFileSync(schemaPath, 'utf8')),
    html:     fs.readFileSync(htmlPath, 'utf8'),
    manifest,
  };
}

// ── Schema flattener ──────────────────────────────────────────────────────────
function flattenSchema(schema) {
  const scalars   = new Map();
  const repeaters = new Map();
  for (const sec of schema.sections ?? []) {
    for (const f of sec.fields ?? []) {
      if (f.type === 'repeater') {
        repeaters.set(f.key, { def: f, items: f.items ?? [], subKeys: new Set((f.items ?? []).map(i => i.key)) });
      } else {
        scalars.set(f.key, f);
      }
    }
  }
  return { scalars, repeaters };
}

// ── HTML annotation extractor ─────────────────────────────────────────────────
function parseAnnotations(rawHtml) {
  // Strip scripts + comments — avoids false positives from JS string literals
  const html = rawHtml
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  const dataFields = new Set(
    [...html.matchAll(/\bdata-field="([^"]+)"/g)].map(m => m[1])
  );

  // Split on repeater boundaries (valid because nested repeaters are forbidden)
  const repeaterSubs = new Map();
  for (const seg of html.split(/(?=\bdata-repeater="[^"]*")/)) {
    const rm = seg.match(/^data-repeater="([^"]+)"/);
    if (!rm) continue;
    repeaterSubs.set(
      rm[1],
      new Set([...seg.matchAll(/\bdata-subfield="([^"]+)"/g)].map(m => m[1]))
    );
  }

  return { dataFields, repeaterSubs };
}

// ── Contract validator ────────────────────────────────────────────────────────
function validate(id, schema, html) {
  const errors = [];
  const { scalars, repeaters } = flattenSchema(schema);
  const { dataFields, repeaterSubs } = parseAnnotations(html);

  // 1. Five primitives; no nested repeaters
  for (const sec of schema.sections ?? []) {
    for (const f of sec.fields ?? []) {
      if (!VALID_TYPES.has(f.type))
        errors.push(`[primitive] "${f.key}" has invalid type "${f.type}"`);
      if (f.type === 'repeater') {
        for (const sub of f.items ?? []) {
          if (!VALID_TYPES.has(sub.type))
            errors.push(`[primitive] "${f.key}".items "${sub.key}" has invalid type "${sub.type}"`);
          if (sub.type === 'repeater')
            errors.push(`[nested] "${f.key}" contains nested repeater "${sub.key}"`);
        }
      }
    }
  }

  // 2. Schema → HTML
  for (const [key] of scalars) {
    if (!dataFields.has(key))
      errors.push(`[orphan schema→html] scalar "${key}": no data-field="${key}" in HTML`);
  }
  for (const [key, { items }] of repeaters) {
    if (!repeaterSubs.has(key)) {
      errors.push(`[orphan schema→html] repeater "${key}": no data-repeater="${key}" in HTML`);
      continue;
    }
    const htmlSubs = repeaterSubs.get(key);
    for (const sub of items) {
      // Carve-out (a): image intrinsic keys other than "src" need no HTML annotation
      if (sub.type === 'image' && IMAGE_INTRINSIC.has(sub.key) && sub.key !== 'src') continue;
      if (!htmlSubs.has(sub.key))
        errors.push(`[orphan schema→html] "${key}".items["${sub.key}"]: no data-subfield="${sub.key}" in repeater template`);
    }
  }

  // 3. HTML → Schema
  for (const key of dataFields) {
    if (!scalars.has(key))
      errors.push(`[orphan html→schema] data-field="${key}": no schema entry`);
    // Carve-out (b): image field on container div — the key IS in scalars (type "image")
    // so it won't reach this error branch. No special handling needed.
  }
  for (const [key, subs] of repeaterSubs) {
    if (!repeaters.has(key)) {
      errors.push(`[orphan html→schema] data-repeater="${key}": no schema entry`);
      continue;
    }
    const { subKeys } = repeaters.get(key);
    for (const sub of subs) {
      if (subKeys.has(sub)) continue;
      // Carve-out (a): x/y/scale as data-subfield are tolerated (implicit crop keys)
      if (IMAGE_INTRINSIC.has(sub)) continue;
      errors.push(`[orphan html→schema] data-subfield="${sub}" in repeater "${key}": no schema entry`);
    }
  }

  return errors;
}

// ── Canonical JSON compare ────────────────────────────────────────────────────
function deepSort(v) {
  if (Array.isArray(v)) return v.map(deepSort);
  if (v && typeof v === 'object')
    return Object.fromEntries(Object.keys(v).sort().map(k => [k, deepSort(v[k])]));
  return v;
}
const jsonEq = (a, b) => JSON.stringify(deepSort(a)) === JSON.stringify(deepSort(b));

// ── Normalise HTML for comparison (strip BOM, trim) ───────────────────────────
const normHtml = s => (s ?? '').replace(/^﻿/, '').trim();

// ── Compute diff ──────────────────────────────────────────────────────────────
function computeDiff(local, dbRow, storageHtml) {
  const { id, schema, html, manifest } = local;
  const diffs = [];

  // Schema
  if (!dbRow || !jsonEq(dbRow.schema, schema))
    diffs.push({ field: 'schema', was: dbRow?.schema ?? null, now: schema });

  // HTML
  const localNorm   = normHtml(html);
  const storageNorm = storageHtml !== null ? normHtml(storageHtml) : null;
  if (storageNorm === null)
    diffs.push({ field: 'html', label: `NOT IN STORAGE → new upload (${localNorm.length} bytes)` });
  else if (storageNorm !== localNorm)
    diffs.push({ field: 'html', label: `storage ${storageNorm.length}B → local ${localNorm.length}B` });

  // Manifest metadata
  for (const f of ['name', 'category', 'tags', 'is_active']) {
    if (!(f in manifest)) continue;
    if (!jsonEq(dbRow?.[f], manifest[f]))
      diffs.push({ field: f, was: dbRow?.[f] ?? null, now: manifest[f] });
  }

  // preview_url: migrate from local: scheme to storage URL
  const storagePublicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${id}.html`;
  if (!dbRow?.preview_url || dbRow.preview_url.startsWith('local:'))
    diffs.push({ field: 'preview_url', was: dbRow?.preview_url ?? null, now: storagePublicUrl });

  return diffs;
}

// ── Storage download via public URL ───────────────────────────────────────────
async function fetchStorageHtml(id) {
  const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${id}.html`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// ── Print diff ────────────────────────────────────────────────────────────────
function printDiff(diffs) {
  for (const d of diffs) {
    if (d.field === 'schema') {
      console.log(c('yellow', `    ~ schema  differs (JSON deep-equal failed)`));
    } else if (d.field === 'html') {
      console.log(c('yellow', `    ~ html    ${d.label}`));
    } else {
      const was = JSON.stringify(d.was);
      const now = JSON.stringify(d.now);
      console.log(c('yellow', `    ~ ${d.field.padEnd(12)} ${was} → ${now}`));
    }
  }
}

// ── Apply writes ──────────────────────────────────────────────────────────────
async function applyWrites(sb, local, diffs) {
  const { id, schema, html, manifest } = local;
  const storagePublicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${id}.html`;
  let ok = true;

  if (diffs.some(d => d.field === 'html')) {
    const buf = Buffer.from(normHtml(html), 'utf8');
    const { error } = await sb.storage.from(BUCKET).upload(`${id}.html`, buf, {
      contentType: 'text/html;charset=utf-8',
      upsert: true,
    });
    if (error) {
      console.log(c('red', `    ✗ storage upload: ${error.message}`));
      ok = false;
    } else {
      console.log(c('green', `    ✓ storage: uploaded ${id}.html`));
    }
  }

  const rowData = { id, schema };
  for (const f of ['name', 'category', 'tags', 'is_active']) {
    if (f in manifest) rowData[f] = manifest[f];
  }
  if (diffs.some(d => d.field === 'preview_url')) rowData.preview_url = storagePublicUrl;

  const { error: ue } = await sb.from('templates').upsert(rowData, { onConflict: 'id' });
  if (ue) {
    console.log(c('red', `    ✗ db upsert: ${ue.message}`));
    ok = false;
  } else {
    console.log(c('green', `    ✓ db: upserted templates row`));
  }

  return ok;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error(c('red', 'VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY not set'));
    process.exit(1);
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const ids = discoverIds();

  console.log(c('bold', '\nPortZen Template Sync'));
  console.log(c('gray', `mode : ${WRITE ? 'WRITE' : 'dry-run'} | validate : ${VALIDATE ? 'yes' : 'no'}`));
  console.log(c('gray', `ids  : ${ids.join(', ')}\n`));

  const results = [];

  for (const id of ids) {
    console.log(c('bold', `── ${id} ${'─'.repeat(Math.max(0, 44 - id.length))}`));

    // Load local files
    let local;
    try {
      local = loadLocal(id);
    } catch (e) {
      console.log(c('red', `  ✗ load: ${e.message}\n`));
      results.push({ id, ok: false });
      continue;
    }
    console.log(c('gray', `  files: schema(${JSON.stringify(local.schema).length}B) html(${local.html.length}B) manifest(${Object.keys(local.manifest).length} keys)`));

    // Validate
    if (VALIDATE) {
      const errors = validate(id, local.schema, local.html);
      if (errors.length === 0) {
        console.log(c('green', `  validate: OK`));
        console.log(c('gray',  `    ✓ 5 primitives`));
        console.log(c('gray',  `    ✓ no nested repeaters`));
        console.log(c('gray',  `    ✓ all orphan-key checks pass`));
        console.log(c('gray',  `    ✓ carve-out (a): image intrinsic x/y/scale not required in HTML`));
        console.log(c('gray',  `    ✓ carve-out (b): image field on container div tolerated`));
      } else {
        console.log(c('red', `  validate: FAIL — ${errors.length} error${errors.length > 1 ? 's' : ''}`));
        errors.forEach(e => console.log(c('red', `    ✗ ${e}`)));
        console.log('');
        results.push({ id, ok: false, errors });
        continue;
      }
    }

    // Fetch current Supabase state
    const [rowRes, storageHtml] = await Promise.all([
      sb.from('templates').select('*').eq('id', id).maybeSingle(),
      fetchStorageHtml(id),
    ]);

    if (rowRes.error) {
      console.log(c('red', `  ✗ db fetch: ${rowRes.error.message}\n`));
      results.push({ id, ok: false });
      continue;
    }

    const dbRow = rowRes.data ?? null;
    console.log(c('gray', `  remote: db-row=${dbRow ? 'exists' : 'MISSING'} storage=${storageHtml !== null ? 'exists' : 'MISSING'}`));

    // Diff
    const diffs = computeDiff(local, dbRow, storageHtml);

    if (diffs.length === 0) {
      console.log(c('green', `  diff: NO-OP — local matches Supabase\n`));
      results.push({ id, ok: true, noOp: true });
      continue;
    }

    console.log(c('yellow', `  diff: ${diffs.length} change${diffs.length > 1 ? 's' : ''}:`));
    printDiff(diffs);

    if (WRITE) {
      const ok = await applyWrites(sb, local, diffs);
      results.push({ id, ok, diffs });
    } else {
      results.push({ id, ok: true, diffs });
    }

    console.log('');
  }

  // Summary
  console.log(c('bold', '─'.repeat(48)));
  const total   = results.length;
  const failed  = results.filter(r => !r.ok).length;
  const noOps   = results.filter(r => r.ok && r.noOp).length;
  const changed = results.filter(r => r.ok && !r.noOp).length;

  console.log(c('bold', `Summary: ${total} template${total !== 1 ? 's' : ''}`));
  if (noOps)   console.log(c('green',  `  ✓ ${noOps} already in sync (no-op)`));
  if (changed) console.log(c('yellow', `  ~ ${changed} with changes${WRITE ? ' — written' : ' — dry-run, not written'}`));
  if (failed)  console.log(c('red',    `  ✗ ${failed} failed`));

  if (!WRITE && changed > 0)
    console.log(c('gray', '\nPass --write to apply changes.'));

  console.log('');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error(c('red', `Fatal: ${e.stack ?? e.message}`));
  process.exit(1);
});
