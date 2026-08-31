# Monid Plugins

Official agent plugins for [Monid](https://monid.ai) — discover and run hundreds of data endpoints (web scraping, people and company enrichment, social media, search results, media generation) through one interface.

This repo is the distribution package. It works with Claude Code, Cursor, Codex, Grok Build, Kimi Code, GitHub Copilot CLI, and VS Code.

---

## Install

### Any supported agent (recommended)

```bash
npx plugins add monid-ai/plugins
```

Auto-detects every agent installed on your machine and installs to all of them.

### Claude Code

```
/plugin marketplace add monid-ai/plugins
/plugin install monid@monid
```

### Cursor

Open **Customize** in the sidebar and search for `monid`, or install from the [Cursor Marketplace](https://cursor.com/marketplace).

### No install — MCP only

Add this as a custom MCP server / connector in any MCP-capable client (ChatGPT, Claude.ai, Cursor, VS Code):

```
https://mcp.monid.ai/v1
```

It uses OAuth — there is no API key to paste.

---

## What you get

The plugin ships **two transports** for the same capabilities, plus a skill that tells your agent which to use.

| | MCP server | CLI |
|---|---|---|
| Setup | None — OAuth on first use | `npm i -g @monid-ai/cli` + API key |
| Works without a shell | Yes | No |
| Results go to | Conversation context | Context **or** a file (`-o`) |
| Best for | Everything by default | Large results, scripting, CI |

The bundled [`monid` skill](plugins/monid/skills/monid/SKILL.md) detects which transport is available and routes accordingly. It prefers MCP, and falls back to the CLI when the MCP tools are absent or when a result is large enough that writing it to a file protects the context window.

### MCP tools

`monid_discover` · `monid_inspect` · `monid_run` · `monid_get_run` · `monid_stop_run` · `monid_list_runs` · `monid_balance` · `monid_list_workspaces` · `monid_list_resources` · `monid_get_resource` · `monid_get_resource_external` · `monid_list_resource_events` · `monid_release_resource`

Discovery and inspection are free. Only `monid_run` spends workspace balance.

---

## Repository layout

```
.claude-plugin/marketplace.json   Claude Code marketplace catalog
.cursor-plugin/marketplace.json   Cursor multi-plugin manifest
plugins/monid/
├── plugin.json                   Agent Plugins 1.0.0 manifest (Cursor, npx plugins)
├── .claude-plugin/plugin.json    Claude Code plugin manifest
├── mcp.json                      Remote MCP server (streamable-http)
├── skills/monid/SKILL.md         Transport-aware agent skill
└── assets/logo.svg
scripts/check-versions.mjs        Version + manifest consistency guard
```

The plugin carries both an [Agent Plugins](https://agent-plugins.org) root manifest and a Claude Code manifest, so every ecosystem discovers it from a single tree. `mcp.json` declares `type: "streamable-http"`, which Claude Code accepts as an alias for `http`.

---

## Versioning

**The plugin version is the source of truth.** It is the update signal — Claude Code and Cursor pin an install to it, so users receive a changed `SKILL.md` only when this number moves.

| Artifact | Version | Bumps when |
|---|---|---|
| Plugin | `plugins/monid/plugin.json` | `SKILL.md` or `mcp.json` changes |
| Skill | `metadata.version` in `SKILL.md` — must equal the plugin version | same commit |
| `@monid-ai/cli` | Tracked independently in [monid-ai/cli](https://github.com/monid-ai/cli) | CLI code changes |
| MCP server | Tracked independently, server-side | Tool contract changes |

The CLI and MCP server are **not** in lockstep with this repo. The skill declares a minimum CLI version (`metadata.minimum-cli-version`) and checks it at runtime; a newer CLI is always acceptable.

Run the guard before committing:

```bash
node scripts/check-versions.mjs
```

It fails the build if any manifest, marketplace entry, or skill version disagrees — and also rejects `SKILL.md` frontmatter fields outside the [Agent Skills spec](https://agentskills.io/specification), which claude.ai and the OpenAI plugin importer reject at upload.

---

## Releasing

1. Edit `SKILL.md` and/or `mcp.json`.
2. Bump the version in all four places (`plugins/monid/plugin.json`, `plugins/monid/.claude-plugin/plugin.json`, both `marketplace.json` files) and in the skill's `metadata.version`.
3. `node scripts/check-versions.mjs`
4. Commit and push to `main`. Claude Code and `npx plugins` pick it up on the next refresh; Cursor re-indexes via Auto Refresh.

---

## Links

- Dashboard — https://app.monid.ai
- API keys — https://app.monid.ai/access/api-keys
- CLI — https://github.com/monid-ai/cli
- Example skills — https://github.com/monid-ai/skills

## License

MIT — see [LICENSE](LICENSE).
