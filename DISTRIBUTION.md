# Distribution

**Status tracking and per-channel runbooks live in Notion:**
[Plugins and Marketplaces → Distribution Channels](https://app.notion.com/p/3cd3fb3d4dd280d3b71fd06471787154)

That database is the source of truth for *where Monid is published, what state each channel is in, and how to publish to it*. Each row opens to a full runbook.

This file covers only what must live next to the code.

---

## Release checklist

Run this whenever `SKILL.md` or `mcp.json` changes.

```bash
# 1. Edit plugins/monid/skills/monid/SKILL.md and/or plugins/monid/mcp.json

# 2. Bump everywhere at once (5 files + mirrors mcp.json -> .mcp.json)
node scripts/bump-version.mjs 1.1.0

# 3. Verify
node scripts/check-versions.mjs
npx plugins discover .            # must print "1 skill, mcp"

# 4. Ship
git commit -am "..." && git push
```

5. Publish a GitHub release — this fires `publish-clawhub.yml`, which pushes the skill to [ClawHub](https://clawhub.ai/monid/skills/monid)
6. Update **Version** on the affected [Notion rows](https://app.notion.com/p/3cd3fb3d4dd280d3b71fd06471787154)

Skipping the bump is the failure mode that looks like nothing happened: Claude Code and Cursor pin installs to the version field, so users never receive a change that didn't move it. Use the script rather than editing by hand — five files is four too many to get right consistently.

---

## ClawHub is automated

An earlier version of this file called ClawHub "the one channel that will silently rot". That was wrong. It has a CLI (`clawhub skill publish`), a REST API, and an official reusable GitHub Action, wired up in `.github/workflows/publish-clawhub.yml`.

Publishes are content-fingerprinted upstream, so a release whose `SKILL.md` is unchanged is a no-op rather than a spurious patch version.

**Never pass `categories` or `topics` from CI.** Supplying either suspends that unchanged-skill skip and publishes a new patch version of *every* skill in the run. Set them once from the skill's settings page on ClawHub.

Requires a `CLAWHUB_TOKEN` repository secret.

---

## Version ownership

| Artifact | Source of truth | Bumps when |
|---|---|---|
| Plugin + skill | `plugins/monid/plugin.json` | `SKILL.md` or `mcp.json` changes |
| `@monid-ai/cli` | git tag in `monid-ai/cli` | CLI code changes |
| MCP server | `monid-services` (`1.2.0`) | tool contract changes |

Deliberately **not** in lockstep. A CLI patch must not force a plugin republish and a Cursor re-review. The skill declares `metadata.minimum-cli-version` and checks it at runtime — a floor, not an equality, so a newer CLI is always acceptable.

---

## Why two MCP config files

`mcp.json` and `.mcp.json` are both real files with identical content.

| File | Read by |
|---|---|
| `mcp.json` | Agent Plugins spec, Cursor |
| `.mcp.json` | `vercel-labs/plugins` CLI, Claude Code default discovery |

A symlink would break Windows checkouts, so `check-versions.mjs` asserts they stay byte-identical. If they diverge, six of seven agents install the plugin without its MCP server and nothing errors.

---

## Publishing `server.json` to the MCP Registry

The manifest is written and validates against the official `2025-12-11` schema. Full runbook is in the Notion row; the two things that must not be lost:

- The DNS TXT record goes on the **apex** of `monid.ai`, not a `_mcp-auth` selector. Selector placement fails with a generic signature error.
- `monid-mcp-registry.key` must never be committed. Store it as a repo secret.

---

## Adding a channel

1. Add a row in the Notion database, filling in **Definition source** and **Update mechanism** first — those two determine whether the channel can rot.
2. If it needs a new manifest, put it in **this repo**, not a new one. Per-marketplace repos multiply the places a version can drift.
3. If the update mechanism is manual, add it to the release checklist above.
