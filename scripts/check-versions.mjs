#!/usr/bin/env node
/**
 * Version consistency guard.
 *
 * The plugin version is the single source of truth. It is the update signal that
 * Claude Code, Cursor, and `npx plugins` use — if it does not move, users never
 * receive a changed SKILL.md. This script fails the build when the copies drift.
 *
 * Checks, for every plugin listed in .claude-plugin/marketplace.json:
 *   1. plugin.json (Agent Plugins root manifest)      == marketplace entry version
 *   2. .claude-plugin/plugin.json                     == marketplace entry version
 *   3. .cursor-plugin/marketplace.json entry          == marketplace entry version
 *   4. every skills/<name>/SKILL.md metadata.version  == marketplace entry version
 *   5. each SKILL.md frontmatter uses only agentskills.io spec fields
 *   6. mcp.json is valid and declares a transport per server
 */

import { readFileSync, existsSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Fields allowed in SKILL.md frontmatter by the Agent Skills spec. */
const SPEC_FIELDS = new Set([
  'name',
  'description',
  'license',
  'compatibility',
  'metadata',
  'allowed-tools',
]);

const errors = [];
const notes = [];

const fail = (msg) => errors.push(msg);
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

/**
 * Minimal YAML frontmatter reader.
 *
 * Only needs to handle the subset this repo writes: top-level scalar keys, a
 * `>-` folded block for `description`, and a one-level `metadata:` map. Avoids
 * adding a YAML dependency to a repo that agents clone on every install.
 */
function parseFrontmatter(content) {
  if (!content.startsWith('---\n')) return null;
  const end = content.indexOf('\n---', 3);
  if (end === -1) return null;
  const body = content.slice(4, end + 1);

  const top = {};
  const lines = body.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.startsWith('#')) continue;
    // Only consider unindented keys as top-level.
    const m = /^([A-Za-z0-9_-]+):(.*)$/.exec(line);
    if (!m) continue;

    const key = m[1];
    const rest = m[2].trim();

    if (rest === '' || rest === '>-' || rest === '|' || rest === '>') {
      // Block scalar or nested map — collect the indented run that follows.
      const nested = {};
      let sawNested = false;
      let j = i + 1;
      for (; j < lines.length; j++) {
        if (!lines[j].trim()) continue;
        if (!/^\s/.test(lines[j])) break;
        const nm = /^\s+([A-Za-z0-9_-]+):\s*(.*)$/.exec(lines[j]);
        if (nm) {
          sawNested = true;
          nested[nm[1]] = nm[2].trim().replace(/^["']|["']$/g, '');
        }
      }
      top[key] = rest === '' && sawNested ? nested : '<block>';
      i = j - 1;
    } else {
      top[key] = rest.replace(/^["']|["']$/g, '');
    }
  }
  return top;
}

const marketplacePath = join(ROOT, '.claude-plugin', 'marketplace.json');
if (!existsSync(marketplacePath)) {
  fail('.claude-plugin/marketplace.json is missing');
  report();
}

const marketplace = readJson(marketplacePath);
const cursorPath = join(ROOT, '.cursor-plugin', 'marketplace.json');
const cursor = existsSync(cursorPath) ? readJson(cursorPath) : null;

for (const entry of marketplace.plugins ?? []) {
  const rel = String(entry.source).replace(/^\.\//, '');
  const dir = join(ROOT, rel);
  const expected = entry.version;
  const label = `plugin "${entry.name}"`;

  if (!expected) {
    fail(`${label}: marketplace entry has no "version" — it is the update signal and is required`);
    continue;
  }
  if (!existsSync(dir)) {
    fail(`${label}: source directory "${rel}" does not exist`);
    continue;
  }

  // 1. Agent Plugins root manifest
  const agentManifest = join(dir, 'plugin.json');
  if (!existsSync(agentManifest)) {
    fail(`${label}: missing root plugin.json (required by the Agent Plugins spec / Cursor)`);
  } else {
    const m = readJson(agentManifest);
    if (m.version !== expected) {
      fail(`${label}: plugin.json version "${m.version}" != marketplace "${expected}"`);
    }
    if (!m.$schema?.includes('agent-plugins.org')) {
      fail(`${label}: plugin.json is missing the Agent Plugins $schema identifier`);
    }
    if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(m.name ?? '') || /--|\.\./.test(m.name ?? '')) {
      fail(`${label}: plugin.json name "${m.name}" violates Agent Plugins name constraints`);
    }
  }

  // 2. Claude Code manifest
  const claudeManifest = join(dir, '.claude-plugin', 'plugin.json');
  if (!existsSync(claudeManifest)) {
    fail(`${label}: missing .claude-plugin/plugin.json`);
  } else {
    const m = readJson(claudeManifest);
    if (m.version !== expected) {
      fail(`${label}: .claude-plugin/plugin.json version "${m.version}" != marketplace "${expected}"`);
    }
  }

  // 3. Cursor marketplace entry
  if (cursor) {
    const cEntry = (cursor.plugins ?? []).find((p) => p.name === entry.name);
    if (!cEntry) {
      fail(`${label}: absent from .cursor-plugin/marketplace.json`);
    } else if (cEntry.version !== expected) {
      fail(`${label}: cursor marketplace version "${cEntry.version}" != "${expected}"`);
    }
  }

  // 4 + 5. Skills
  const skillsDir = join(dir, 'skills');
  if (existsSync(skillsDir)) {
    for (const name of readdirSync(skillsDir)) {
      const skillFile = join(skillsDir, name, 'SKILL.md');
      if (!existsSync(skillFile)) continue;

      const fm = parseFrontmatter(readFileSync(skillFile, 'utf8'));
      if (!fm) {
        fail(`${label}: ${name}/SKILL.md has no YAML frontmatter`);
        continue;
      }

      for (const key of Object.keys(fm)) {
        if (!SPEC_FIELDS.has(key)) {
          fail(
            `${label}: ${name}/SKILL.md has non-spec frontmatter field "${key}". ` +
              `claude.ai and the OpenAI plugin importer reject unknown fields — ` +
              `move it under "metadata:".`,
          );
        }
      }

      if (fm.name !== name) {
        fail(`${label}: ${name}/SKILL.md frontmatter name "${fm.name}" != directory "${name}"`);
      }

      const skillVersion = fm.metadata?.version;
      if (!skillVersion) {
        fail(`${label}: ${name}/SKILL.md is missing metadata.version`);
      } else if (skillVersion !== expected) {
        fail(
          `${label}: ${name}/SKILL.md metadata.version "${skillVersion}" != plugin "${expected}". ` +
            `Bump the plugin version and this together, or users never receive the change.`,
        );
      }
    }
  }

  // 6. mcp.json / .mcp.json
  //
  // Two files on purpose. The Agent Plugins spec (Cursor) reads `mcp.json`;
  // the `plugins` CLI and Claude Code's default discovery read `.mcp.json`.
  // A symlink would break on Windows checkouts, so both are real files and
  // this check keeps them from drifting.
  const mcpPath = join(dir, 'mcp.json');
  const dotMcpPath = join(dir, '.mcp.json');

  if (existsSync(mcpPath) !== existsSync(dotMcpPath)) {
    fail(
      `${label}: mcp.json and .mcp.json must both exist. ` +
        `Cursor/Agent Plugins reads "mcp.json"; the plugins CLI and Claude Code read ".mcp.json".`,
    );
  } else if (existsSync(mcpPath)) {
    const a = JSON.stringify(readJson(mcpPath));
    const b = JSON.stringify(readJson(dotMcpPath));
    if (a !== b) {
      fail(`${label}: mcp.json and .mcp.json have diverged — they must stay identical`);
    }
  }

  if (existsSync(mcpPath)) {
    const mcp = readJson(mcpPath);
    for (const [name, server] of Object.entries(mcp.mcpServers ?? {})) {
      if (!server.type) {
        fail(`${label}: mcp.json server "${name}" has no "type" — Claude Code reads it as stdio and skips it`);
      }
      if (server.url && !server.url.startsWith('https://')) {
        fail(`${label}: mcp.json server "${name}" must use https`);
      }
      if (server.headers && Object.keys(server.headers).length) {
        notes.push(
          `${label}: mcp.json server "${name}" declares headers — these are public package data, never put credentials there`,
        );
      }
    }
  }
}

report();

function report() {
  for (const n of notes) console.warn(`warn  ${n}`);
  if (errors.length) {
    console.error(`\n${errors.length} version/manifest problem(s):\n`);
    for (const e of errors) console.error(`  ✗ ${e}`);
    console.error('');
    process.exit(1);
  }
  console.log('✓ manifests and skill versions are consistent');
}
