import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.name.endsWith(".md")) out.push(p);
  }
  return out;
};

/**
 * Docs / runbooks source adapter (curated tier): one claim per markdown
 * file under the configured directory. Freshness from file mtime.
 */
export function docsSource({ path }) {
  return {
    name: "docs",
    collect() {
      return walk(path).map((file) => ({
        source: `docs:${relative(path, file)}`,
        trustTier: "curated",
        ageSeconds: Math.max(0, Math.floor((Date.now() - statSync(file).mtimeMs) / 1000)),
        content: readFileSync(file, "utf8"),
      }));
    },
  };
}
