# Autonomous Trust — Composite Context MCP Server (v1.3)

**Governed autonomy, earned by evidence.** The third deliverable of the [Autonomous Trust](https://commercetrustlabs.org/reference-architecture.html) pluggability roadmap (§8.5): **Composite Context as an MCP server** — the context plane served over the protocol every agent client already speaks.

It federates existing sources into **contract-conformant Context Manifests**: every claim carries its source, freshness, confidence, a **content trust tier**, and a sha256 digest. The manifest is metadata; content is pulled per-claim — so an agent takes the *minimum* context a task needs, and everything it saw is auditable afterward.

```
agent client (Claude Code, any MCP client)
      │  assemble_context(application, taskRef)
      ▼
autonomous-trust-context ──► git repository   (structure, dependencies: authoritative
      │                                        commit history: UNTRUSTED free text)
      │                 ──► docs / runbooks   (curated)
      ▼
Context Manifest (v1 contract) ──► get_claim_content(contextId, source)
```

## Provenance is not integrity

The red-team finding this server encodes: a source can be fresh and well-provenanced while its *content* is attacker-influenced. Every claim therefore carries a `trustTier`:

- **authoritative** — systems of record (repo structure, dependency manifests): `high` confidence.
- **curated** — human-maintained docs and runbooks.
- **untrusted** — externally influenced free text (commit messages here; tickets and chat in real estates): forced to `low` confidence, and served wrapped in a **data-not-instructions banner** so injection attempts arrive defused.

## Tools

| Tool | Does |
|---|---|
| `assemble_context` | Runs all configured source adapters and returns a [Context Manifest](https://github.com/commerce-trust-labs/autonomous-trust-contracts) — metadata only |
| `get_claim_content` | Returns the content behind one claim (banner-wrapped when untrusted) |

## Quickstart

```bash
cp context.config.example.json context.config.json   # point at your repo + docs
npm install
npm start                                            # stdio MCP server
```

Attach to Claude Code:

```bash
claude mcp add autonomous-trust-context -- node /path/to/src/server.js
```

## Adapters are the pluggability seam

`src/adapters/` ships two credential-free reference adapters (`git`, `docs`). An adapter is one function: `collect() → [{ source, trustTier, ageSeconds, content }]`. Service catalogs, observability, ticketing, and wikis are the same shape — write one against your own estate and the manifest contract does the rest.

## Tests

```bash
npm test
```

Six tests through a **real MCP client** over an in-memory transport: federation of both sources, contract conformance of the manifest against the published schemas, digest integrity of served content, untrusted-tier banner wrapping, authoritative-tier confidence, and loud failures for unknown claims.

## Honest limitations (v1.3)

- Two reference adapters; real estates need adapters for their own systems of record.
- In-memory manifest store — manifests live for the server process.
- Age-based staleness only; no source-specific freshness policies yet.
- The banner defuses instruction-following by convention; it is a mitigation, not a guarantee — pair it with a client that treats tool output as data.

---

Part of [Commerce Trust Labs](https://commercetrustlabs.org) — an independent personal research initiative. Apache-2.0.
