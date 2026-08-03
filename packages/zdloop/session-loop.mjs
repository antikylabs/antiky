#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import console from "node:console";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { setTimeout } from "node:timers";

import { runCodex } from "./session-codex-stream.mjs";
import { createGemmaEventSummarizer } from "./session-stream-summarizer.mjs";
import {
  createLoopControl,
  createTui,
  LoopKilledError,
  printCodexOutput,
  shouldUseTui,
} from "./session-loop-tui.mjs";

const TODO_RELATIVE_PATH = "docs/objectives/03-TODO_A.txt";
const FEEDBACK_RELATIVE_PATH = "docs/objectives/01-FEEDBACK_H.txt";
const MEMORY_RELATIVE_PATH = "docs/objectives/04-AGENT-SESSIONS_A.txt";
const TODO_PATH = resolve(TODO_RELATIVE_PATH);
const FEEDBACK_PATH = resolve(FEEDBACK_RELATIVE_PATH);
const MEMORY_PATH = resolve(MEMORY_RELATIVE_PATH);
const PROMPT =
  "Use $zd-session to run the next open task. Run exactly one session and stop after its handoff; the outer runner will decide whether another session is allowed.";
const MAX_WAIT_MS = 2_147_483_647;

function usage() {
  return `Usage: npm run zdloop -- <wait> [--dry-run] [--no-tui]

Run one $zd-session at a time until ${FEEDBACK_RELATIVE_PATH} is empty and the next open
CHECKPOINT in ${TODO_RELATIVE_PATH} is reached.
After the checkpoint, run one read-only Codex recap with a manual testing guide.
The wait is a gap after a completed session, not a wall-clock schedule.

Arguments:
  <wait>       Positive duration with a unit: 250ms, 60s, 5m, or 1h
  --dry-run    Print the task snapshot and Codex prompts without changing files
  --no-tui     Disable the interactive dashboard even when attached to a terminal
  --help       Show this help

Interactive controls:
  s            Finish the active session, run the recap, then pause
  x / Ctrl+C   Kill the active Codex process and exit immediately
  l / L        Toggle the agent stream between summaries and raw Codex logs
  c            Continue from the summary screen when runnable work exists
  q            Quit from the summary screen

Stream model:
  Tool events are summarized locally with google/gemma-3-270m.
  Inference runs in a worker thread so TUI controls remain responsive.
  Set ZDLOOP_STREAM_MODEL=off to use deterministic event labels instead.
`;
}

function fail(message) {
  throw new Error(message);
}

function parseDuration(value) {
  const match = /^(\d+)(ms|s|m|h)$/.exec(value ?? "");
  if (!match) fail("Wait must be a positive duration such as 60s, 5m, or 250ms");

  const amount = Number(match[1]);
  if (amount === 0) fail("Wait must be a positive duration such as 60s, 5m, or 250ms");
  const multipliers = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000 };
  const milliseconds = amount * multipliers[match[2]];
  if (!Number.isSafeInteger(milliseconds) || milliseconds > MAX_WAIT_MS) {
    fail(`Wait must not exceed ${MAX_WAIT_MS}ms`);
  }
  return milliseconds;
}

function parseArguments(args) {
  if (args.includes("--help")) return { help: true };

  const knownOptions = new Set(["--dry-run", "--no-tui"]);
  const unknown = args.filter((arg) => arg.startsWith("--") && !knownOptions.has(arg));
  if (unknown.length > 0) fail(`Unknown option: ${unknown[0]}`);

  const positional = args.filter((arg) => !arg.startsWith("--"));
  if (positional.length !== 1) fail("Exactly one wait duration is required");

  return {
    help: false,
    dryRun: args.includes("--dry-run"),
    noTui: args.includes("--no-tui"),
    waitLabel: positional[0],
    waitMs: parseDuration(positional[0]),
  };
}

function isCheckpoint(line) {
  return /^(?:\([ABC]\) \d{4}-\d{2}-\d{2} )?CHECKPOINT\b/.test(line);
}

function isBlocked(line) {
  const blockVerdicts = line.match(/\b(?:BLOCKED|UNBLOCKED)\b/g) ?? [];
  return blockVerdicts.at(-1) === "BLOCKED";
}

function isDecision(line) {
  return /^\([ABC]\) \d{4}-\d{2}-\d{2} DECIDE\b/.test(line);
}

function buildDecisionPrompt(task, answer) {
  return `Use $zd-session to complete exactly this task:\n\n${task}\n\nThe user reviewed the preceding COMPARE and supplied this decision:\n\nUser decision: ${answer}\n\nTreat that as the resolved product direction. Implement it, verify it, commit it, tick off the task, and stop after the handoff.`;
}

function readPlan() {
  if (!existsSync(TODO_PATH))
    fail(`${TODO_RELATIVE_PATH} does not exist; run this command from the repository root`);

  const contents = readFileSync(TODO_PATH, "utf8");
  const significantLines = contents
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));
  const checkpointIndex = significantLines.findIndex(
    (line) => !line.startsWith("x ") && isCheckpoint(line),
  );
  if (checkpointIndex === -1)
    fail(`No open checkpoint remains in ${TODO_RELATIVE_PATH}; refusing to loop`);

  const band = significantLines.slice(0, checkpointIndex);
  const openBand = band.filter((line) => !line.startsWith("x "));

  return {
    blocked: openBand.filter(isBlocked),
    checkpoint: significantLines[checkpointIndex],
    contents,
    done: band.filter((line) => /^x \d{4}-\d{2}-\d{2} \([ABC]\) /.test(line)),
    tasks: openBand.filter((line) => !isBlocked(line)),
  };
}

function readFeedback() {
  if (!existsSync(FEEDBACK_PATH))
    fail(`${FEEDBACK_RELATIVE_PATH} does not exist; run this command from the repository root`);

  const contents = readFileSync(FEEDBACK_PATH, "utf8");
  const lines = contents.split("\n");
  const dividerIndex = lines.findIndex((line) => line.trim() === "---");
  if (dividerIndex === -1) fail(`${FEEDBACK_RELATIVE_PATH} has no --- inbox divider`);

  const entries = lines
    .slice(dividerIndex + 1)
    .map((line) => line.trim())
    .filter(Boolean);
  return {
    contents,
    entries,
    urgent: entries.filter((line) => line.startsWith("!")).length,
  };
}

function readLoopState() {
  return { feedback: readFeedback(), plan: readPlan() };
}

function hasRunnableWork(state) {
  return state.feedback.entries.length > 0 || state.plan.tasks.length > 0;
}

function readHeadCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    fail("Could not read the starting git commit; run this command inside the Antiky repository");
  }
}

function buildRecapPrompt(startCommit, checkpoint) {
  return `This is the final read-only recap for a completed zdloop run. The run started at git commit ${startCommit} and stopped at "${checkpoint}". Review committed changes in ${startCommit}..HEAD and the matching recent work-session handoffs in ${MEMORY_RELATIVE_PATH}. Read docs/VISION_DIRECTION_H.md, docs/GOOD_ENGINEERING_H.md, and relevant records in docs/adr/ and docs/aip/ when judging the result. Do not change files. Tell the user what changed, give a prioritized manual test checklist, say what feedback to provide for each item, and call out known failures, deferred work, or blocked tasks. Ignore changes that predate the starting commit and treat unrelated uncommitted worktree changes as pre-existing.`;
}

function sessionLabel(count) {
  return count === 1 ? "session" : "sessions";
}

function printBlocked(plan) {
  if (plan.blocked.length === 0) return;
  console.log(`Blocked in this band: ${plan.blocked.length}`);
  for (const task of plan.blocked) console.log(`  - ${task}`);
}

function printRecapDryRun(startCommit, checkpoint) {
  console.log("\nFinal recap: 1 read-only Codex session after checkpoint");
  console.log(`   Prompt: ${buildRecapPrompt(startCommit, checkpoint)}`);
}

function printDryRunSummary(state, waitLabel, waitMs) {
  const { feedback, plan } = state;

  console.log("Dry run summary:");
  console.log(`  Tasks to work: ${plan.tasks.length}`);
  console.log(`  Blocked tasks: ${plan.blocked.length}`);
  console.log(`  Pending feedback: ${feedback.entries.length} (${feedback.urgent} urgent)`);
  if (feedback.entries.length > 0) {
    const minimumSessions = Math.max(1, plan.tasks.length + feedback.urgent);
    console.log(
      `  Minimum Codex sessions before checkpoint: ${minimumSessions} (recalculated after triage)`,
    );
  } else {
    console.log(`  Codex sessions before checkpoint: ${plan.tasks.length}`);
  }
  console.log(`  Wait between sessions: ${waitLabel} (${waitMs}ms)`);
  console.log(`  Stop: ${plan.checkpoint}`);
}

function printDryRun(state, waitLabel, waitMs, startCommit) {
  const { feedback, plan } = state;
  printDryRunSummary(state, waitLabel, waitMs);

  if (feedback.entries.length > 0) {
    console.log(
      "\nFeedback forces the next Codex session before the checkpoint can stop the loop.",
    );
    console.log(
      `\n1. Triage ${FEEDBACK_RELATIVE_PATH}, then take the first eligible task in the live band`,
    );
    console.log(`   Prompt: ${PROMPT}`);
    console.log("\nFeedback to triage:");
    for (const entry of feedback.entries) console.log(`  - ${entry}`);
    if (plan.tasks.length > 0) {
      console.log("\nCurrently runnable tasks (triage may reorder this snapshot):");
      for (const task of plan.tasks) console.log(`  - ${task}`);
    }
    printBlocked(plan);
    printRecapDryRun(startCommit, plan.checkpoint);
    console.log("No files changed and Codex was not invoked.");
    return;
  }

  for (const [index, task] of plan.tasks.entries()) {
    console.log(`\n${index + 1}. ${task}`);
    if (isDecision(task)) {
      console.log("   Human input required in the TUI before this session.");
    } else {
      console.log(`   Prompt: ${PROMPT}`);
    }
  }

  printBlocked(plan);
  printRecapDryRun(startCommit, plan.checkpoint);
  console.log("No files changed and Codex was not invoked.");
}

function appendMemory(task, prompt, result) {
  if (!existsSync(MEMORY_PATH)) {
    appendFileSync(
      MEMORY_PATH,
      "# Antiky agent sessions\n\nFinal handoffs captured by packages/zdloop/session-loop.mjs. Newest entries are last.\n",
    );
  }

  const status = result.code === 0 ? "success" : `failure (exit ${result.code})`;
  const signal = result.signal ? `\nSignal: ${result.signal}` : "";
  const message = result.finalMessage || "(no final message)";
  appendFileSync(
    MEMORY_PATH,
    `\n## ${new Date().toISOString()}\n\nTask: ${task}\n\nPrompt: ${prompt}\n\nStatus: ${status}${signal}\n\n${message}\n`,
  );
}

function wait(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function finishAtCheckpoint(sessionCount, state, startCommit) {
  console.log(
    `Checkpoint reached after ${sessionCount} Codex ${sessionLabel(sessionCount)}: ${state.plan.checkpoint}`,
  );
  printBlocked(state.plan);

  const recapPrompt = buildRecapPrompt(startCommit, state.plan.checkpoint);
  console.log("Starting final read-only Codex recap.");
  const result = await runCodex(recapPrompt, {
    approvalPolicy: "never",
    sandbox: "read-only",
  });
  appendMemory("Final loop recap", recapPrompt, result);
  printCodexOutput("Final Codex recap", result.finalMessage);
  if (result.code !== 0) fail(`Final Codex recap exited with status ${result.code}`);
}

async function runLoop(waitLabel, waitMs, startCommit) {
  let sessionCount = 0;

  while (true) {
    const state = readLoopState();
    if (!hasRunnableWork(state)) {
      await finishAtCheckpoint(sessionCount, state, startCommit);
      return;
    }

    const task =
      state.feedback.entries.length > 0
        ? `Triage ${state.feedback.entries.length} pending ${FEEDBACK_RELATIVE_PATH} entries, then take the first eligible task`
        : state.plan.tasks[0];
    if (state.feedback.entries.length === 0 && isDecision(task)) {
      console.log(`Decision required: ${task}`);
      console.log("Run zdloop interactively to answer it.");
      return;
    }
    console.log(`Starting Codex session ${sessionCount + 1}: ${task}`);
    const result = await runCodex(PROMPT, { sandbox: "workspace-write" });
    appendMemory(task, PROMPT, result);
    printCodexOutput("Codex handoff", result.finalMessage);
    if (result.code !== 0) fail(`Codex exited with status ${result.code}; stopping the loop`);

    const nextState = readLoopState();
    const todoChanged = nextState.plan.contents !== state.plan.contents;
    const feedbackChanged = nextState.feedback.contents !== state.feedback.contents;
    if (!todoChanged && !feedbackChanged) {
      if (state.feedback.entries.length === 0) {
        fail(`${TODO_RELATIVE_PATH} did not change; stopping to avoid repeating the same task`);
      }
      fail(
        `Neither ${TODO_RELATIVE_PATH} nor ${FEEDBACK_RELATIVE_PATH} changed; stopping to avoid repeating the same feedback session`,
      );
    }

    sessionCount += 1;
    if (!hasRunnableWork(nextState)) {
      await finishAtCheckpoint(sessionCount, nextState, startCommit);
      return;
    }

    console.log(`Waiting ${waitLabel} before the next Codex session. Press Ctrl+C to stop.`);
    await wait(waitMs);
  }
}

async function runTuiRecap(tui, control, activitySummarizer, startCommit, checkpoint) {
  const recapPrompt = buildRecapPrompt(startCommit, checkpoint);
  tui.setPhase("recap", "Preparing the testing and feedback summary");
  const result = await runCodex(recapPrompt, {
    approvalPolicy: "never",
    activitySummarizer,
    control,
    sandbox: "read-only",
    tui,
  });
  if (control.killRequested) throw new LoopKilledError();
  appendMemory("Final loop recap", recapPrompt, result);
  if (result.code !== 0) fail(`Final Codex recap exited with status ${result.code}`);
  return result.finalMessage;
}

async function pauseAtSummary(tui, control, summary, notice) {
  while (true) {
    tui.showSummary(summary, notice);
    const action = await tui.waitForSummaryAction();
    if (action === "quit") return false;

    const state = readLoopState();
    if (hasRunnableWork(state)) {
      control.resetStop();
      tui.setLoopState(state);
      return true;
    }
    notice = `No runnable work is above ${state.plan.checkpoint}. Add feedback or advance the checkpoint, then press c.`;
  }
}

async function runTuiLoop(waitLabel, waitMs, initialCommit, tui, control) {
  let startCommit = initialCommit;
  let sessionCount = 0;
  let feedbackProcessed = 0;

  tui.start();
  const activitySummarizer = createGemmaEventSummarizer({
    enabled: process.env.ZDLOOP_STREAM_MODEL !== "off",
    onStatus: (status) => tui.setStreamStatus(status),
    onSummary: (summary) => tui.addActivity(summary),
  });
  void activitySummarizer.warmup();
  try {
    while (true) {
      if (control.killRequested) throw new LoopKilledError();
      const state = readLoopState();
      tui.setLoopState(state);
      tui.setSessionCount(sessionCount);
      tui.setFeedbackProcessed(feedbackProcessed);

      if (control.stopRequested || !hasRunnableWork(state)) {
        const graceful = control.stopRequested;
        const summary = await runTuiRecap(
          tui,
          control,
          activitySummarizer,
          startCommit,
          state.plan.checkpoint,
        );
        const notice = graceful
          ? `Graceful stop complete after ${sessionCount} ${sessionLabel(sessionCount)}. Review the recap before continuing or quitting.`
          : `Checkpoint reached after ${sessionCount} ${sessionLabel(sessionCount)}: ${state.plan.checkpoint}`;
        const shouldContinue = await pauseAtSummary(tui, control, summary, notice);
        if (!shouldContinue) return;

        startCommit = readHeadCommit();
        sessionCount = 0;
        feedbackProcessed = 0;
        continue;
      }

      const task =
        state.feedback.entries.length > 0
          ? `Triage ${state.feedback.entries.length} pending ${FEEDBACK_RELATIVE_PATH} entries, then take the first eligible task`
          : state.plan.tasks[0];
      let prompt = PROMPT;
      if (state.feedback.entries.length === 0 && isDecision(task)) {
        const answer = await tui.waitForDecision(task);
        if (control.killRequested) throw new LoopKilledError();
        prompt = buildDecisionPrompt(task, answer);
      }
      tui.setPhase("running", task);
      const result = await runCodex(prompt, {
        activitySummarizer,
        control,
        sandbox: "workspace-write",
        tui,
      });
      if (control.killRequested) throw new LoopKilledError();
      appendMemory(task, prompt, result);
      if (result.code !== 0) fail(`Codex exited with status ${result.code}; stopping the loop`);

      const nextState = readLoopState();
      const todoChanged = nextState.plan.contents !== state.plan.contents;
      const feedbackChanged = nextState.feedback.contents !== state.feedback.contents;
      if (!todoChanged && !feedbackChanged) {
        if (state.feedback.entries.length === 0) {
          fail(`${TODO_RELATIVE_PATH} did not change; stopping to avoid repeating the same task`);
        }
        fail(
          `Neither ${TODO_RELATIVE_PATH} nor ${FEEDBACK_RELATIVE_PATH} changed; stopping to avoid repeating the same feedback session`,
        );
      }

      feedbackProcessed += Math.max(
        0,
        state.feedback.entries.length - nextState.feedback.entries.length,
      );
      sessionCount += 1;
      tui.setLoopState(nextState);
      tui.setSessionCount(sessionCount);
      tui.setFeedbackProcessed(feedbackProcessed);
      if (control.stopRequested || !hasRunnableWork(nextState)) continue;

      tui.setPhase("waiting", `Next session starts after the ${waitLabel} gap`);
      await control.wait(waitMs, (remaining) => tui.setWaitRemaining(remaining));
    }
  } finally {
    await activitySummarizer.close({ wait: !control.killRequested });
  }
}

async function main() {
  let tui;
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      console.log(usage());
      return;
    }

    const state = readLoopState();
    const startCommit = readHeadCommit();
    if (options.dryRun) {
      printDryRun(state, options.waitLabel, options.waitMs, startCommit);
      return;
    }

    if (shouldUseTui(options)) {
      const control = createLoopControl();
      tui = createTui(control);
      await runTuiLoop(options.waitLabel, options.waitMs, startCommit, tui, control);
    } else {
      await runLoop(options.waitLabel, options.waitMs, startCommit);
    }
  } catch (error) {
    if (error instanceof LoopKilledError) {
      process.exitCode = 130;
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error(`session-loop: ${message}`);
    process.exitCode = 1;
  } finally {
    tui?.close();
  }
}

await main();
