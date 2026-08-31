# Monid distribution registry

Every channel Monid is published through, what file defines it, and how a change reaches users.

> Mirror of the intended Notion database. Kept here because it lives next to the manifests it describes — if you add a channel, add a row in the same PR.

The two columns that matter most are **Definition source** and **Update mechanism**. Together they answer "if I change the skill, where does it go, and what do I have to do?" A channel with a manual update mechanism is a channel that will silently go stale.

---

## Status

| Channel | Type | Surfaces | Definition source | Update mechanism | Review? | Listing | Status |
|---|---|---|---|---|---|---|---|
| **ClawHub** | Skill catalog | Skill | `plugins/monid/skills/monid/SKILL.md` | **Manual upload** | No | https://clawhub.ai/monid/skills/monid | Live |
| **npm `@monid-ai/cli`** | Package registry | CLI | `monid-ai/cli` `package.json` | CI on release tag | No | [npmjs.com](https://www.npmjs.com/package/@monid-ai/cli) | Live |
| **`monid.ai/SKILL.md`** | Skill catalog | Skill | `plugins/monid/skills/monid/SKILL.md` | Git push (CloudFront → GitHub raw) | No | https://monid.ai/SKILL.md | Live — origin cutover pending deploy |
| **`monid-ai/skills`** | Skill catalog | CLI | `monid-ai/skills` `skills/` | Git push | No | [github](https://github.com/monid-ai/skills) | Live |
| **Claude Code marketplace** | Plugin marketplace | MCP + Skill | `.claude-plugin/marketplace.json` | Git push | No | — | Ready, unannounced |
| **`npx plugins`** (7 agents) | Plugin marketplace | MCP + Skill | `plugins/monid/plugin.json` + `.mcp.json` | Git push | No | — | Ready, unannounced |
| **Cursor Marketplace** | Plugin marketplace | MCP + Skill | `plugins/monid/plugin.json` | Submit + manual review | **Yes** | — | Not submitted |
| **cursor.directory** | Plugin marketplace | MCP + Skill | repo | Manual submit | Light | — | Not submitted |
| **Official MCP Registry** | MCP registry | MCP | `server.json` | `mcp-publisher` (registry API) | No | — | Blocked on DNS TXT |
| **Glama** | MCP registry | MCP | ingests MCP Registry | Registry API | No | — | Not started |
| **PulseMCP** | MCP registry | MCP | ingests MCP Registry | Registry API | No | — | Not started |
| **Smithery** | MCP registry | MCP | TBD | TBD | ? | — | Intake unverified |
| **Docker MCP Catalog** | MCP registry | MCP | PR to catalog repo | Git PR | **Yes** | — | Not started |
| **ChatGPT + Codex Directory** | Connector directory | MCP (+ Skill) | OpenAI portal draft | Resubmit + review | **Yes** | — | Blocked (see below) |
| **Claude.ai Connectors** | Connector directory | MCP | `https://mcp.monid.ai/v1` | Live | No | — | Works via custom URL; directory is partner-gated |
| **Grok Bot Plugins** | Connector directory | MCP | — | No self-serve path | **Yes** | — | Needs xAI outreach |

**Only ClawHub is manual-upload.** Everything else is git-push or an API, so ClawHub is the one channel guaranteed to drift. Re-upload `SKILL.md` there whenever the plugin version changes.

---

## Version ownership

| Artifact | Source of truth | Independent of |
|---|---|---|
| Plugin + skill | `plugins/monid/plugin.json` → mirrored into `SKILL.md` `metadata.version` | CLI, MCP server |
| `@monid-ai/cli` | git tag in `monid-ai/cli` | plugin |
| MCP server | `monid-services` (`1.2.0`) | plugin, CLI |

The skill declares `metadata.minimum-cli-version` and checks it at runtime. A newer CLI is always fine — that is why it is a floor, not an equality. `node scripts/check-versions.mjs` enforces the rest.

---

## Publishing to the MCP Registry

`server.json` is written and validates against the official schema. Two steps remain.

**1. Prove domain ownership** (one time). This claims the `ai.monid/*` namespace, which is cleaner than `io.github.monid-ai/*`.

```bash
# macOS ships LibreSSL, which cannot do Ed25519 — use OpenSSL 3
brew install openssl@3
OPENSSL=/opt/homebrew/opt/openssl@3/bin/openssl   # /usr/local/... on Intel

$OPENSSL genpkey -algorithm Ed25519 -out monid-mcp-registry.key
PUBLIC_KEY="$($OPENSSL pkey -in monid-mcp-registry.key -pubout -outform DER | tail -c 32 | base64)"
echo "monid.ai. IN TXT \"v=MCPv1; k=ed25519; p=${PUBLIC_KEY}\""
```

Add that TXT record on the **apex** of `monid.ai` — not under a `_mcp-auth` selector. Selector placement fails with a generic signature error.

**2. Publish.**

```bash
brew install mcp-publisher
PRIVATE_KEY="$($OPENSSL pkey -in monid-mcp-registry.key -noout -text | grep -A3 'priv:' | tail -n +2 | tr -d ' :\n')"
mcp-publisher login dns --domain monid.ai --private-key "$PRIVATE_KEY"
mcp-publisher publish
```

Keep `monid-mcp-registry.key` out of git — store it as a repository secret so CI can re-publish on MCP server version bumps.

Publishing here is what feeds Glama, PulseMCP, and the VS Code/GitHub MCP registry, so those rows resolve without separate work.

---

## Blockers for the ChatGPT / Codex submission

Verified during research on 2026-08-30:

- [ ] `/.well-known/openai-apps-challenge` returns **404** on both `api.monid.ai` and `mcp.monid.ai`. Domain verification cannot start until it serves the token.
- [ ] No MCP tool sets a `title`. All 13 use the legacy `server.tool()` overload, so clients render raw names like `monid_get_resource_external`. Migrating to `registerTool()` adds `title` and `outputSchema` together.
- [ ] `destructiveHint` is unset on the 10 read-only tools. The MCP spec default is `true`, so a strict client may prompt for confirmation on `monid_discover`. Set it to `false` explicitly. **This is a live bug, not just a listing concern.**
- [ ] Verified business identity on the OpenAI Platform, plus an **Apps Management: Write** role for the submitter.
- [ ] 5 positive and 3 negative test cases.
- [ ] Reviewer demo credentials that work without MFA.
- [ ] Public privacy policy and terms URLs.
- [ ] `monid.ai/docs` is still a one-page Mintlify scaffold; several submissions want a real docs URL.

Optional but strong: implement the [SEP-2640 skills extension](https://developers.openai.com/plugins/build/mcp-server) (`capabilities.extensions["io.modelcontextprotocol/skills"]` plus `skills/list` and `skills/get`) so OpenAI imports the Monid skill directly from the MCP server.

---

## Adding a channel

1. Add a row above, filling in **Definition source** and **Update mechanism** first.
2. If it needs a new manifest, put it in this repo — not in a new one. Per-marketplace repos multiply the places a version can drift.
3. If the update mechanism is manual, say so loudly and add it to the release checklist in [README.md](README.md).
