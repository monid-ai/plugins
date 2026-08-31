#!/usr/bin/env node
/**
 * Bump a plugin's version everywhere it appears, in one command.
 *
 *   node scripts/bump-version.mjs 1.1.0
 *   node scripts/bump-version.mjs 1.1.0 --plugin monid
 *
 * The version lives in five files. Editing them by hand is the failure mode
 * this repo is most likely to hit: miss one and check-versions.mjs fails the
 * build; miss the whole bump and Claude Code and Cursor keep serving the old
 * plugin while the push looks successful.
 *
 * Also mirrors mcp.json to .mcp.json, which must stay identical.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const version = args.find((a) => !a.startsWith('--'));
const pluginIdx = args.indexOf('--plugin');
const only = pluginIdx !== -1 ? args[pluginIdx + 1] : null;

if (!version) {
  console.error('usage: node scripts/bump-version.mjs <version> [--plugin <name>]');
  process.exit(1);
}
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`"${version}" is not semver (expected e.g. 1.1.0)`);
  process.exit(1);
}

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
/** Preserve two-space indentation and the trailing newline Prettier/git expect. */
const writeJson = (p, o) => writeFileSync(p, JSON.stringify(o, null, 2) + '\n');

const changed = [];

function bumpMarketplace(relPath, sourceKey) {
  const path = join(ROOT, relPath);
  if (!existsSync(path)) return [];
  const doc = readJson(path);
  const names = [];
  for (const entry of doc.plugins ?? []) {
    if (only && entry.name !== only) continue;
    entry.version = version;
    names.push({ name: entry.name, source: String(entry[sourceKey] ?? entry.source) });
  }
  writeJson(path, doc);
  changed.push(relPath);
  return names;
}

// Marketplace entries — Claude Code is authoritative for the plugin list.
const plugins = bumpMarketplace('.claude-plugin/marketplace.json', 'source');
bumpMarketplace('.cursor-plugin/marketplace.json', 'source');

if (!plugins.length) {
  console.error(only ? `no plugin named "${only}"` : 'no plugins found in marketplace.json');
  process.exit(1);
}

for (const { name, source } of plugins) {
  const dir = join(ROOT, source.replace(/^\.\//, ''));

  // Agent Plugins root manifest + Claude Code manifest
  for (const rel of ['plugin.json', '.claude-plugin/plugin.json']) {
    const p = join(dir, rel);
    if (!existsSync(p)) continue;
    const m = readJson(p);
    m.version = version;
    writeJson(p, m);
    changed.push(`${source}/${rel}`);
  }

  // Skill frontmatter: metadata.version, indentation-preserving.
  const skillsDir = join(dir, 'skills');
  if (existsSync(skillsDir)) {
    for (const skill of readdirSync(skillsDir)) {
      const sp = join(skillsDir, skill, 'SKILL.md');
      if (!existsSync(sp)) continue;
      const before = readFileSync(sp, 'utf8');
      const after = before.replace(
        /^(\s+version:\s*)(["']?)[^"'\n]*\2\s*$/m,
        (_, prefix) => `${prefix}"${version}"`,
      );
      if (after !== before) {
        writeFileSync(sp, after);
        changed.push(`${source}/skills/${skill}/SKILL.md`);
      }
    }
  }

  // mcp.json and .mcp.json must stay byte-identical.
  const mcp = join(dir, 'mcp.json');
  const dotMcp = join(dir, '.mcp.json');
  if (existsSync(mcp)) {
    const body = readFileSync(mcp, 'utf8');
    if (!existsSync(dotMcp) || readFileSync(dotMcp, 'utf8') !== body) {
      writeFileSync(dotMcp, body);
      changed.push(`${source}/.mcp.json (mirrored from mcp.json)`);
    }
  }

  console.log(`  ${name} -> ${version}`);
}

console.log(`\nUpdated ${changed.length} file(s):`);
for (const c of changed) console.log(`  ${c}`);
console.log('\nNext: node scripts/check-versions.mjs');
