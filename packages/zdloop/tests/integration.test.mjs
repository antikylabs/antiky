import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../..");
const read = (path) => readFileSync(join(root, path), "utf8");

test("the root exposes the zdloop workspace commands", () => {
  const packageJson = JSON.parse(read("package.json"));

  assert.equal(packageJson.scripts.zdloop, "node packages/zdloop/session-loop.mjs");
  assert.equal(packageJson.scripts.zdarchive, "node packages/zdloop/archive-tasks.mjs");
  assert.equal(packageJson.scripts["test:zdloop"], "npm test --workspace @antiky/zdloop");
});

test("root security anchors keep npm workspace overrides effective", () => {
  const packageJson = JSON.parse(read("package.json"));

  assert.equal(packageJson.dependencies["@huggingface/transformers"], "3.8.1");
  assert.equal(packageJson.dependencies.next, "15.5.22");
  assert.equal(packageJson.dependencies.postcss, "8.5.25");
  assert.equal(packageJson.dependencies.sharp, "0.35.3");
  assert.equal(packageJson.overrides.postcss, "$postcss");
  assert.equal(packageJson.overrides.sharp, "$sharp");
});

test("the vendored runner targets Antiky's formal objective files", () => {
  const loop = read("packages/zdloop/session-loop.mjs");
  const archive = read("packages/zdloop/archive-tasks.mjs");

  assert.match(loop, /docs\/objectives\/03-TODO_A\.txt/);
  assert.match(loop, /docs\/objectives\/01-FEEDBACK_H\.txt/);
  assert.match(loop, /docs\/objectives\/04-AGENT-SESSIONS_A\.txt/);
  assert.match(loop, /Follow \.claude\/commands\/session\.md to run the next open task/);
  assert.match(archive, /docs\/objectives\/03-TODO_A\.txt/);
  assert.match(archive, /docs\/objectives\/07-DONE_S\.txt/);
});

test("the dependency tree contains no vulnerable sharp or postcss release", () => {
  const lock = JSON.parse(read("package-lock.json"));
  const sharpVersions = Object.entries(lock.packages)
    .filter(([path]) => path.endsWith("node_modules/sharp"))
    .map(([, metadata]) => metadata.version);

  assert.ok(sharpVersions.length > 0, "expected sharp to be present in the installed tree");
  for (const version of sharpVersions) {
    const [major, minor] = version.split(".").map(Number);
    assert.ok(major > 0 || minor >= 35, `sharp ${version} is below the patched 0.35.0 release`);
  }

  const postcssVersions = Object.entries(lock.packages)
    .filter(([path]) => path.endsWith("node_modules/postcss"))
    .map(([, metadata]) => metadata.version);

  assert.ok(postcssVersions.length > 0, "expected postcss to be present in the installed tree");
  for (const version of postcssVersions) {
    const [major, minor, patch] = version.split(".").map(Number);
    const isPatched = major > 8 || (major === 8 && (minor > 5 || (minor === 5 && patch >= 18)));
    assert.ok(isPatched, `postcss ${version} is below the patched 8.5.18 release`);
  }
});

test("Claude commands are fully specialized for Antiky", () => {
  const commandNames = ["archive", "session", "status", "triage"];

  for (const name of commandNames) {
    const command = read(`.claude/commands/${name}.md`);
    assert.doesNotMatch(command, /\{[A-Z_]+\}/);
    assert.match(command, /docs\/objectives\/03-TODO_A\.txt/);
  }

  const session = read(".claude/commands/session.md");
  assert.match(session, /docs\/VISION_DIRECTION_H\.md/);
  assert.match(session, /docs\/GOOD_ENGINEERING_H\.md/);
  assert.match(session, /docs\/adr\//);
  assert.match(session, /docs\/aip\//);
  assert.match(session, /@COMPARE/);
  assert.match(session, /@DECIDE/);

  const triage = read(".claude/commands/triage.md");
  assert.match(triage, /docs\/objectives\/05-ARCHIVE-FEEDBACK_A\.txt/);
  assert.match(triage, /docs\/objectives\/06-ARCHIVE-FINDINGS_A\.txt/);
  assert.match(triage, /@COMPARE/);
  assert.match(triage, /@DECIDE/);
});

test("Codex skills delegate to the matching canonical Claude commands", () => {
  const skillNames = ["archive", "status", "triage"];

  for (const name of skillNames) {
    const skill = read(`.agents/skills/zd-${name}/SKILL.md`);
    assert.match(skill, new RegExp(`name: zd-${name}`));
    assert.match(skill, new RegExp(`\\.claude/commands/${name}\\.md`));
  }

  assert.equal(existsSync(join(root, ".agents/skills/zd-session")), false);
});

test("the objective scaffolding documents ownership and loop inputs", () => {
  const objectives = read("docs/objectives/README.md");

  for (const path of [
    "00-GOALS_H_A.txt",
    "01-FEEDBACK_H.txt",
    "02-AGENT-FINDINGS_A.txt",
    "03-TODO_A.txt",
    "04-AGENT-SESSIONS_A.txt",
    "05-ARCHIVE-FEEDBACK_A.txt",
    "06-ARCHIVE-FINDINGS_A.txt",
    "07-DONE_S.txt",
    "08-REPORT_S.txt",
  ]) {
    assert.match(objectives, new RegExp(path.replace(".", "\\.")));
  }

  assert.match(objectives, /VISION_DIRECTION_H\.md/);
  assert.match(objectives, /GOOD_ENGINEERING_H\.md/);
});

test("the todo.txt-compatible task file contains no legend pseudo-tasks", () => {
  const lines = read("docs/objectives/03-TODO_A.txt")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  assert.ok(lines.length > 0, "expected at least the direction checkpoint");
  assert.equal(lines.filter((line) => line.startsWith("#")).length, 0);
  assert.ok(lines.some((line) => line.includes("CHECKPOINT")));
});
