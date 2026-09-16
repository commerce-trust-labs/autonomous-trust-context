import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const git = (repo, args) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" }).trim();

/**
 * Git repository source adapter.
 * Emits three claims:
 *  - repo-structure   (authoritative): tracked file tree
 *  - repo-dependencies(authoritative): package manifest, when present
 *  - commit-history   (UNTRUSTED)    : recent commit subjects — free text,
 *    externally influenced, admissible as data only.
 */
export function gitSource({ path }) {
  return {
    name: "git",
    collect() {
      const headEpoch = Number(git(path, ["log", "-1", "--format=%ct"]));
      const ageSeconds = Math.max(0, Math.floor(Date.now() / 1000 - headEpoch));
      const claims = [];

      const tree = git(path, ["ls-files"]);
      claims.push({ source: "repo-structure", trustTier: "authoritative", ageSeconds, content: tree });

      for (const manifest of ["package.json", "pom.xml", "go.mod", "requirements.txt"]) {
        if (existsSync(join(path, manifest))) {
          claims.push({
            source: "repo-dependencies", trustTier: "authoritative", ageSeconds,
            content: readFileSync(join(path, manifest), "utf8"),
          });
          break;
        }
      }

      const log = git(path, ["log", "-15", "--format=%h %ct %s"]);
      claims.push({ source: "commit-history", trustTier: "untrusted", ageSeconds, content: log });

      return claims;
    },
  };
}
