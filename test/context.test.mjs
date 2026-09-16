import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer } from "../src/server.js";
import { UNTRUSTED_BANNER } from "../src/manifest.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");

let client, store, manifest;

before(async () => {
  const built = buildServer({
    environment: "dev",
    staleAfterSeconds: 60 * 60 * 24 * 365, // a year — keep fixtures "fresh"
    sources: {
      git: { path: repoRoot },                       // this repo itself
      docs: { path: join(here, "fixtures", "docs") } // fixture runbooks
    },
  });
  store = built.store;
  client = new Client({ name: "test-client", version: "0.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await built.server.connect(st);
  await client.connect(ct);

  const res = await client.callTool({
    name: "assemble_context",
    arguments: { application: "autonomous-trust-context", taskRef: "task_ctx00001" },
  });
  manifest = JSON.parse(res.content[0].text);
});

after(async () => { await client.close(); });

test("assembles a manifest federating both sources over real MCP", () => {
  const sources = manifest.claims.map((c) => c.source);
  assert.ok(sources.includes("repo-structure"), "git structure claim present");
  assert.ok(sources.includes("commit-history"), "git history claim present");
  assert.ok(sources.some((s) => s.startsWith("docs:")), "docs claims present");
  assert.equal(manifest.scope.application, "autonomous-trust-context");
  assert.equal(manifest.scope.taskRef, "task_ctx00001");
});

test("the manifest conforms to the published Context Manifest contract", () => {
  const schemaDir = join(repoRoot, "node_modules", "autonomous-trust-contracts", "schemas", "v1");
  const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true });
  addFormats(ajv);
  ajv.addSchema(JSON.parse(readFileSync(join(schemaDir, "common.schema.json"), "utf8")));
  const validate = ajv.compile(JSON.parse(readFileSync(join(schemaDir, "context-manifest.schema.json"), "utf8")));
  assert.ok(validate(manifest), ajv.errorsText(validate.errors));
});

test("content digests are integrity-checkable against served content", async () => {
  const claim = manifest.claims.find((c) => c.source.startsWith("docs:"));
  const res = await client.callTool({
    name: "get_claim_content",
    arguments: { contextId: manifest.contextId, source: claim.source },
  });
  const served = res.content[0].text; // curated tier: served verbatim
  assert.equal("sha256:" + createHash("sha256").update(served).digest("hex"), claim.contentDigest);
});

test("untrusted-tier content is wrapped as data-not-instructions and marked low confidence", async () => {
  const claim = manifest.claims.find((c) => c.source === "commit-history");
  assert.equal(claim.trustTier, "untrusted");
  assert.equal(claim.confidence, "low");
  const res = await client.callTool({
    name: "get_claim_content",
    arguments: { contextId: manifest.contextId, source: "commit-history" },
  });
  assert.ok(res.content[0].text.startsWith(UNTRUSTED_BANNER), "banner prepended");
});

test("dependency and structure claims are authoritative and high confidence", () => {
  for (const source of ["repo-structure", "repo-dependencies"]) {
    const claim = manifest.claims.find((c) => c.source === source);
    assert.equal(claim.trustTier, "authoritative", source);
    assert.equal(claim.confidence, "high", source);
  }
});

test("unknown context or claim requests fail loudly", async () => {
  const res = await client.callTool({
    name: "get_claim_content",
    arguments: { contextId: "ctx_nope0000", source: "repo-structure" },
  });
  assert.equal(res.isError, true);
});
