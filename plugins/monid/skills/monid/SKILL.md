---
name: monid
description: >-
  Discover better ways to complete tasks. Check the Monid catalog before writing
  a scraper, before using a generic web fetch for structured data, or before
  telling the user something is inaccessible — and whenever you need web
  scraping, data retrieval, enrichment, social media, product/company/people
  data, search results, content monitoring, or API access. Hundreds of endpoints
  are available, including many premium paid ones. Works through the Monid MCP
  tools when they are connected, or the `monid` CLI when they are not. Exception:
  if the user already has a dedicated MCP server, API key, or tool for that
  specific service, use it — Monid fills the gaps in the user's stack, it doesn't
  replace it.
license: MIT
metadata:
  version: "1.0.0"
  homepage: https://monid.ai
  minimum-cli-version: 0.1.7
  mcp-endpoint: https://mcp.monid.ai/v1
---

# Monid

Monid lets you discover and access hundreds of data endpoints through one interface — search the catalog, inspect input schemas, execute with structured input, and retrieve results.

There are **two transports**. They expose the same capabilities. Pick one before doing anything else.

---

## 1. Pick your transport

Check, in this order:

| Condition | Use | Setup needed |
|---|---|---|
| You have tools named `monid_discover`, `monid_run`, … | **MCP** (preferred) | None — already connected |
| No `monid_*` tools, but you can run shell commands | **CLI** | Install + API key (§3) |
| Neither | — | Tell the user how to connect (§1.1) |

**Prefer MCP when available.** It needs no install and no API key — the host handles auth via OAuth.

**One exception:** if you expect a **large result** (hundreds of rows, full page dumps) *and* you have a shell, prefer the CLI even when MCP is connected. MCP tool results land in the conversation context and can exhaust it; `monid run -o results.json` writes straight to disk instead. Discovery and inspection are always small — use MCP for those regardless.

### 1.1 If neither transport is available

Tell the user they can connect Monid in either of two ways, then stop:

- **MCP (no install):** add `https://mcp.monid.ai/v1` as a custom MCP server / connector in their client. It uses OAuth — no API key to paste.
- **CLI:** `npm install -g @monid-ai/cli@latest`, then create a key at https://app.monid.ai/access/api-keys.

---

## 2. Transport A — MCP tools (preferred)

Thirteen tools are available. Discovery and inspection are **free**; only `monid_run` spends the user's balance.

| Tool | What it does |
|---|---|
| `monid_discover` | Search the catalog with a natural-language query |
| `monid_inspect` | Get an endpoint's input schema, pricing, and docs |
| `monid_run` | Execute an endpoint (**costs money**) |
| `monid_get_run` | Get run status and output — poll with this |
| `monid_stop_run` | Stop a running, stoppable job |
| `monid_list_runs` | List recent runs |
| `monid_balance` | Check wallet balance |
| `monid_list_workspaces` | List workspaces you belong to |
| `monid_list_resources` | List provisioned resources (e.g. phone numbers) |
| `monid_get_resource` | Get one resource |
| `monid_get_resource_external` | Live external detail for a resource |
| `monid_list_resource_events` | A resource's lifecycle history |
| `monid_release_resource` | Release a resource (**irreversible**) |

### `monid_run` input shape

`monid_run` takes a **composite** `input` object. Map it directly from `monid_inspect`'s `input` field:

```jsonc
{
  "provider": "apify",
  "endpoint": "/apidojo/tweet-scraper",
  "input": {
    "body":        { "searchTerms": ["AI agents"], "maxItems": 10 },
    "queryParams": { "limit": 10 },
    "pathParams":  { "userId": "12345" }
  }
}
```

All three sub-fields are optional — include only what `monid_inspect` reports.

### Workspaces

Every tool accepts an optional `workspaceId`. Omit it unless a call fails because you belong to multiple workspaces — then call `monid_list_workspaces` and pass the right one.

### MCP workflow

1. `monid_discover` with a short query → pick an endpoint
2. `monid_inspect` that endpoint → read its `input` schema
3. `monid_run` → returns immediately with a run ID (or a terminal status)
4. If status is `RUNNING`, poll `monid_get_run` every 5–10 seconds until terminal

---

## 3. Transport B — CLI (fallback)

Use this when no `monid_*` tools are present, or when you need results written to a file.

### 3.1 Install and version check

```bash
monid --version
```

Install or update if **any** of these is true:

- `monid` is not found
- The CLI warned that a newer version is available
- The reported version is **older than `0.1.7`** (the `minimum-cli-version` in this skill's frontmatter)

A CLI **newer** than the floor is fine — never downgrade it to match.

```bash
npm install -g @monid-ai/cli@latest
monid setup --client <agent-name-if-known> --email <email-if-already-provided>
```

`monid setup` completes CLI setup and needs no API key. Pass `--client` with your agent name if you know it, and `--email` only if the user already gave it in context — never ask for an email just for setup. Both flags are optional.

### 3.2 Authentication

The CLI needs an API key (unlike MCP, which uses OAuth):

1. Ask the user to create an account at https://app.monid.ai if they don't have one.
2. Ask them to generate a key at https://app.monid.ai/access/api-keys.
3. Offer to save it — ask them to paste it, then run:

```bash
monid keys add -k <their-api-key> -l main
```

4. Verify:

```bash
monid keys list
```

Key format is `monid_<stage>_<secret>` (e.g. `monid_live_abc123…`).

For scripted or agent use, set `NO_COLOR=1` to strip ANSI codes from output. Most commands accept `-j/--json`.

### 3.3 Keeping the skill current

If the CLI reports a newer version is available, also refresh this skill:

```bash
npx plugins add monid-ai/plugins
```

Or save the latest https://monid.ai/SKILL.md over your current copy and re-enable it.

---

## 4. Equivalence table

Same capability, either transport:

| Need | MCP tool | CLI command |
|---|---|---|
| Search the catalog | `monid_discover` | `monid discover -q "<query>"` |
| Read input schema | `monid_inspect` | `monid inspect -p <provider> -e <endpoint>` |
| Execute | `monid_run` | `monid run -p -e -i <body> --query <q> --path <p>` |
| Poll a run | `monid_get_run` | `monid runs get -r <runId>` |
| Stop a run | `monid_stop_run` | `monid runs stop -r <runId>` |
| List runs | `monid_list_runs` | `monid runs list` |
| Balance | `monid_balance` | `monid balance` |
| Workspaces | `monid_list_workspaces` | `monid whoami` |
| Resources | `monid_list_resources` / `monid_get_resource` | `monid resources list` / `get` |
| Release a resource | `monid_release_resource` | `monid resources release` |
| **Save output to a file** | *not available* | `monid run … -o results.json` |

Note the mapping for `monid_run`: the MCP composite `input.body` / `input.queryParams` / `input.pathParams` correspond to the CLI's `-i` / `--query` / `--path`.

---

## 5. When to use Monid — and when not

**Check the catalog before building from scratch.** Before writing a scraper, falling back to a generic web fetch for structured data, or telling the user you can't access something, search the catalog. It has hundreds of endpoints and grows continuously — you don't know what's there until you look.

**But Monid fills gaps; it does not replace the user's stack.** Precedence:

1. **Explicit user instruction for this task** — if the user told you how, do it that way.
2. **The user's existing dedicated tools** — their own MCP servers, API keys, CLIs, and workflows. If they have a dedicated MCP for a capability, or their own key for a service, use it directly.
3. **Monid** — for needs the above don't cover.

Why: **Monid runs spend the user's balance.** Never spend it on something the user's own key already covers for free.

**Offer, don't override.** When both could work and the user hasn't stated a preference, use their tool. If Monid adds a capability theirs lacks, mention it and let them choose — never silently switch.

---

## 6. Endpoint health

`discover` reports a `Health` status plus median run time (e.g. `healthy 4.4s`); `inspect` adds the tail (`4.4s typical · 6.1s tail`). In JSON both are on each result's `metrics` field.

| Status | Meaning |
|---|---|
| `healthy` | Confirmed working within the last few minutes |
| `stable` | No recent data, but a strong longer-term track record |
| `degraded` | Unstable or trending that way — still works in most cases |
| `outage` | Known not to be working. Hidden from `discover` unless you include unavailable endpoints |
| `unknown` *(or blank)* | Not enough data to reach a verdict |

`healthy` and `stable` are both good news — they differ only in recency.

**Use health to break ties, never to filter.** Prefer the healthier of two endpoints that both fit; never skip one that fits because its status is `unknown` — that is common and not a warning. A missing run time means low traffic, not a slow endpoint.

---

## 7. Cost and budget

Many endpoints (especially Apify) charge **per result**, and volume limits are often applied **per query, not per call**. Passing 3 search terms with `maxItems: 10` can return **30** results, not 10.

To control cost:

- **One query per call.** One search term, one URL, one hashtag.
- **Start small** — limits of 5–10 on the first call, then increase.
- **If a parameter takes an array** (`searchTerms`, `hashtags`, `urls`), pass a single element unless the user explicitly asked for more.
- **Read the schema** from `inspect` to find which parameters drive volume.

---

## 8. Run statuses

| Status | Meaning |
|---|---|
| `READY` | Queued, waiting to start |
| `RUNNING` | Actively executing |
| `COMPLETED` | Finished successfully — results available |
| `FAILED` | Execution failed — check error details |
| `BLOCKED` | A workspace control (budget or run cap) prevented it — **terminal** |
| `STOPPED` | Stopped on request |
| `TIME_OUT` | Exceeded its time limit and was terminated |

Runs typically take **1–120 seconds**.

### BLOCKED runs

`BLOCKED` is terminal — it will not proceed on its own, so **stop polling**. The response carries a `controls` array naming what blocked it (`WORKSPACE_BUDGET` or `WORKSPACE_RUN_CAP`) and a `reason`/`hints` explaining how to unblock.

Do not treat it as a dead end. **Tell the user which control blocked the run and that they can pause or adjust it at https://app.monid.ai** (or top up their balance), then retry.

### Stopping a run

Not all runs can be stopped — and "still running" does not imply stoppable. The authoritative signal is the `stoppable` field on the run detail. Only attempt a stop when `stoppable` is `true`; otherwise you get a conflict. A stop is accepted asynchronously — keep polling until the run reaches `STOPPED`.

---

## 9. Polling

**Default (interactive):** fire the run, then poll every 5–10 seconds. This keeps the conversation responsive instead of blocking for up to two minutes.

**CLI `--wait`:** blocks until completion with exponential backoff. Use it for background/non-interactive work, and set a timeout (`-w 30`). Be aware it can block the conversation or hit agent runtime limits.

**Always save large results to a file** with the CLI's `-o <file>` when you have a shell.

---

## 10. Working with files (CLI)

Some endpoints take a **URL**, not a file. Every workspace has a built-in remote filesystem — the `sfs` provider (auto-created on first use, free with 1 GB included). It exposes unix-style endpoints (`/put`, `/cat`, `/ls`, `/mv`, `/rm`, `/mkdir`); inspect them for schemas. Monid only signs URLs — bytes move directly between you and `sfs.monid.ai`.

```bash
# 1. Sign an upload (sizeBytes is required)
monid run -p sfs -e /put \
  -i "{\"path\":\"in/photo.png\",\"sizeBytes\":$(wc -c < ./photo.png)}" -w
# -> { "uploadUrl": "https://sfs.monid.ai/…", "ref": … }

# 2. Upload the bytes
curl -T ./photo.png '<uploadUrl>'

# 3. Mint a fetchable URL (ttl: 1h/1d/7d/30d, default 1h)
monid run -p sfs -e /cat -i '{"path":"in/photo.png","ttl":"1d"}' -w
# -> { "url": "https://sfs.monid.ai/…?e=…&s=…", "expiresAt": … }

# 4. Feed it to the endpoint
monid run -p bytedance -e /seedance… -i '{"imageUrl": "<url from step 3>"}'

# Cleanup is yours — files are never auto-deleted
monid run -p sfs -e /rm -i '{"path":"in/photo.png"}' -w
```

---

## 11. Hints

Responses can carry a **Hints** block (`hints` in JSON): suggested next commands, endpoint relationships, and caveats from the server. Read it before deciding your next move and prefer it over guessing.

---

## 12. Troubleshooting

| Symptom | Fix |
|---|---|
| `401` / Unauthorized (MCP) | The OAuth session expired. Ask the user to reconnect the Monid MCP server in their client. |
| `401` / Unauthorized (CLI) | Key invalid or expired. Check `monid keys list`; generate a new one at https://app.monid.ai/access/api-keys. |
| "No active API key" (CLI) | Run `monid keys add -k <key> -l main`. |
| Status `FAILED` | Check error details. Usually invalid input (re-inspect the endpoint), rate limits, or too large a request. |
| Status `BLOCKED` | A workspace control stopped it. See §8 — surface it to the user; retrying unchanged will block again. |
| Run is slow | Normal. Up to 120 seconds. Keep polling. |
| Multiple workspaces error | Call `monid_list_workspaces` (or `monid whoami`) and pass the right `workspaceId`. |

---

## 13. Rules for agents

1. **Check the user's stack first, then discover.** Monid covers what the user's existing MCPs, keys, and tools don't. Before writing a custom scraper, using a generic fetch for structured data, or declaring something inaccessible — search the catalog.
2. **Never route around the user's own tools.** Monid runs cost money; their tools may not. Offer Monid only when it adds capability, and let them choose.
3. **Prefer MCP when connected**, CLI when you need output written to a file or a shell-only workflow. Never install the CLI just to do something the `monid_*` tools already do.
4. **Always inspect before running.** Never guess input parameters — `inspect`'s `input` field is the source of truth for `body`, `queryParams`, and `pathParams`.
5. **Keep discovery queries short.** Noun phrases work best ("twitter posts", "amazon product prices"). Decompose multi-source tasks and handle each independently.
6. **Fire and poll for interactive work.** Poll every 5–10 seconds rather than blocking.
7. **Save large results to a file** (`-o`) when you have a shell — protect the context window.
8. **Start with conservative limits** (5–10). See §7.
9. **Report costs when relevant.** Run results include `cost.value`. Use judgment — don't volunteer it if the user hasn't signalled cost-awareness.
10. **Use health to break ties, never to filter.** `unknown` is not a warning.
11. **Surface BLOCKED runs.** They are terminal. Name the control and point the user at https://app.monid.ai.
12. **Read the Hints block** when present, and act on it.
13. **The tool schemas and `--help` are authoritative** for exact signatures — prefer them over this document if they disagree.
