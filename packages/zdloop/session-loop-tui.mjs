import console from "node:console";
import process from "node:process";
import { clearTimeout, setTimeout } from "node:timers";

import { renderDecision } from "./session-loop-decision.mjs";

const ANSI = {
  boldCyan: "\u001b[1;36m",
  cyan: "\u001b[36m",
  dim: "\u001b[2m",
  reset: "\u001b[0m",
  underlineCyan: "\u001b[4;36m",
  yellow: "\u001b[38;5;220m",
};
const TUI_ENTER = "\u001b[?1049h\u001b[?25l\u001b[?1000h\u001b[?1006h";
const TUI_EXIT = "\u001b[?1006l\u001b[?1000l\u001b[?25h\u001b[?1049l";
const TUI_CLEAR = "\u001b[2J\u001b[H";
const MAX_RAW_LOG_CHARS = 20_000;
const MOUSE_EVENT = new RegExp(`${String.fromCharCode(27)}\\[<(\\d+);\\d+;\\d+[Mm]`, "g");
const MOUSE_SCROLL_LINES = 3;

export class LoopKilledError extends Error {
  constructor() {
    super("Loop killed by user");
  }
}

function terminalColorsEnabled() {
  if (process.env.FORCE_COLOR !== undefined) return process.env.FORCE_COLOR !== "0";
  return Boolean(
    process.stdout.isTTY && process.env.TERM !== "dumb" && process.env.NO_COLOR === undefined,
  );
}

function styleInlineMarkdown(text) {
  return text
    .replace(
      /\[([^\]]+)]\(([^)]+)\)/g,
      `${ANSI.underlineCyan}$1${ANSI.reset} ${ANSI.dim}($2)${ANSI.reset}`,
    )
    .replace(/\*\*([^*]+)\*\*/g, `\u001b[1m$1${ANSI.reset}`)
    .replace(/`([^`]+)`/g, `${ANSI.yellow}$1${ANSI.reset}`);
}

function renderTerminalMarkdown(markdown) {
  let inCodeBlock = false;

  return markdown
    .split("\n")
    .map((line) => {
      const fence = /^```\s*(.*)$/.exec(line);
      if (fence) {
        inCodeBlock = !inCodeBlock;
        const language = fence[1] ? ` ${fence[1]}` : "";
        const border = inCodeBlock ? `┌─${language}` : "└─";
        return `${ANSI.cyan}${border}${ANSI.reset}`;
      }
      if (inCodeBlock)
        return `${ANSI.dim}${ANSI.cyan}│${ANSI.reset} ${ANSI.dim}${line}${ANSI.reset}`;

      const heading = /^#{1,6}\s+(.+)$/.exec(line);
      if (heading) return `${ANSI.boldCyan}${heading[1]}${ANSI.reset}`;

      const bullet = /^(\s*)[-*+]\s+(.+)$/.exec(line);
      if (bullet) {
        return `${bullet[1]}${ANSI.cyan}•${ANSI.reset} ${styleInlineMarkdown(bullet[2])}`;
      }

      const numbered = /^(\s*)(\d+)\.\s+(.+)$/.exec(line);
      if (numbered) {
        return `${numbered[1]}${ANSI.boldCyan}${numbered[2]}.${ANSI.reset} ${styleInlineMarkdown(numbered[3])}`;
      }

      const quote = /^>\s?(.*)$/.exec(line);
      if (quote)
        return `${ANSI.cyan}│${ANSI.reset} ${ANSI.dim}${styleInlineMarkdown(quote[1])}${ANSI.reset}`;

      if (/^\s*(?:---+|___+|\*\*\*+)\s*$/.test(line)) {
        return `${ANSI.dim}${"─".repeat(48)}${ANSI.reset}`;
      }
      return styleInlineMarkdown(line);
    })
    .join("\n");
}

export function printCodexOutput(title, message) {
  if (!message) return;

  if (!terminalColorsEnabled()) {
    console.log(`\n--- ${title} ---\n${message}`);
    return;
  }

  const width = Math.max(48, Math.min(process.stdout.columns ?? 80, 100));
  const prefix = `── ${title} `;
  const divider = prefix + "─".repeat(Math.max(2, width - prefix.length));
  console.log(`\n${ANSI.dim}${ANSI.cyan}${divider}${ANSI.reset}`);
  console.log(renderTerminalMarkdown(message));
}

export function shouldUseTui(options) {
  if (options.dryRun || options.noTui) return false;
  if (process.env.ZDLOOP_TUI === "1") return true;
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export function shorten(text, width) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= width) return normalized;
  return `${normalized.slice(0, Math.max(1, width - 1))}…`;
}

function formatDuration(milliseconds) {
  if (milliseconds < 1_000) return `${Math.max(0, Math.ceil(milliseconds))}ms`;
  return `${Math.max(0, Math.ceil(milliseconds / 1_000))}s`;
}

function signalChild(child, signal) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;

  try {
    if (process.platform !== "win32" && child.pid) process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
}

export function createLoopControl() {
  let activeChild;
  let wakeWait;

  return {
    killRequested: false,
    stopRequested: false,
    attachChild(child) {
      activeChild = child;
      if (this.killRequested) signalChild(activeChild, "SIGTERM");
    },
    detachChild(child) {
      if (activeChild === child) activeChild = undefined;
    },
    requestKill() {
      if (this.killRequested) return;
      this.killRequested = true;
      if (wakeWait) wakeWait();
      signalChild(activeChild, "SIGTERM");
      const killTimer = setTimeout(() => signalChild(activeChild, "SIGKILL"), 600);
      killTimer.unref?.();
    },
    requestStop() {
      this.stopRequested = true;
      if (wakeWait) wakeWait();
    },
    resetStop() {
      this.stopRequested = false;
    },
    async wait(milliseconds, onTick) {
      const startedAt = Date.now();
      while (!this.stopRequested && !this.killRequested) {
        const remaining = milliseconds - (Date.now() - startedAt);
        if (remaining <= 0) return;
        onTick(remaining);
        await new Promise((resolvePromise) => {
          const timer = setTimeout(resolvePromise, Math.min(remaining, 250));
          wakeWait = () => {
            clearTimeout(timer);
            resolvePromise();
          };
        });
        wakeWait = undefined;
      }
    },
  };
}

export function createTui(control) {
  const input = process.stdin;
  const output = process.stdout;
  const state = {
    activity: [],
    currentTask: "Reading the work queue",
    decisionAnswer: "",
    decisionNotice: "",
    decisionTask: "",
    feedbackProcessed: 0,
    loopState: undefined,
    notice: "",
    phase: "starting",
    rawActivity: [],
    sessionCount: 0,
    streamScroll: 0,
    streamView: "summary",
    streamStatus: "Starting Gemma…",
    summary: "",
    summaryNotice: "",
    summaryScroll: 0,
    waitRemaining: 0,
  };
  let previousRawMode = false;
  let decisionAction;
  let summaryAction;

  function color(value, code) {
    return terminalColorsEnabled() ? `\u001b[${code}m${value}${ANSI.reset}` : value;
  }

  function summaryLines() {
    if (!state.summary) return [color("No recap message was returned.", "2")];
    const rendered = terminalColorsEnabled()
      ? renderTerminalMarkdown(state.summary)
      : state.summary;
    return rendered.split("\n");
  }

  function activityLines(width) {
    return state.activity.flatMap((entry) => {
      if (entry.kind === "markdown") {
        const boundedMarkdown = entry.text
          .split("\n")
          .map((line) => shorten(line, width))
          .join("\n");
        const rendered = terminalColorsEnabled()
          ? renderTerminalMarkdown(boundedMarkdown)
          : boundedMarkdown;
        return rendered.split("\n");
      }

      const pipeIndex = entry.text.indexOf("|");
      if (pipeIndex === -1) return [shorten(entry.text, width)];
      const action = entry.text.slice(0, pipeIndex).trim();
      const description = entry.text.slice(pipeIndex + 1).trim();
      return [
        `${color(action, "1;35")} ${color("|", "2")} ${shorten(description, Math.max(10, width - action.length - 3))}`,
      ];
    });
  }

  function rawActivityLines(width) {
    return state.rawActivity.map((line) => shorten(line, width));
  }

  function renderDashboard(width, height) {
    const plan = state.loopState?.plan;
    const feedback = state.loopState?.feedback;
    const taskWidth = Math.max(20, width - 4);
    const phase =
      state.phase === "waiting" ? `waiting ${formatDuration(state.waitRemaining)}` : state.phase;
    const lines = [
      `${color("zdloop", "1;36")}  ${color(phase, "2")}  ${color(`${state.sessionCount} completed`, "2")}`,
      color("─".repeat(Math.min(width, 100)), "36"),
      `${color("Todos", "1")}    ${plan?.done.length ?? 0} done • ${plan?.tasks.length ?? 0} open • ${plan?.blocked.length ?? 0} blocked before checkpoint`,
      `${color("Feedback", "1")} ${feedback?.entries.length ?? 0} pending • ${feedback?.urgent ?? 0} urgent`,
      `${color("Feedback sent", "1")} ${state.feedbackProcessed} inbox ${state.feedbackProcessed === 1 ? "item" : "items"} processed this run`,
      `${color("Stream AI", "1")} ${shorten(state.streamStatus, taskWidth)}`,
      `${color("Stop at", "1")}  ${shorten(plan?.checkpoint ?? "unknown checkpoint", taskWidth)}`,
      "",
      color("Todo queue", "1;36"),
      ...((plan?.tasks.length ?? 0) > 0
        ? plan.tasks.slice(0, 2).map((task) => `  ${shorten(task, taskWidth)}`)
        : [color("  none", "2")]),
      color("Recently done", "1;36"),
      ...((plan?.done.length ?? 0) > 0
        ? plan.done.slice(-2).map((task) => `  ${shorten(task, taskWidth)}`)
        : [color("  none", "2")]),
      "",
      color("Current work", "1;36"),
      `  ${shorten(state.currentTask, taskWidth)}`,
    ];
    if (state.notice) lines.push("", color(state.notice, "33"));
    const streamTitle = state.streamView === "raw" ? "Agent log (raw)" : "Agent stream (summary)";
    lines.push("", color(streamTitle, "1;36"));

    const fixedLines = lines.length + 3;
    const activityHeight = Math.max(3, height - fixedLines);
    const allActivity =
      state.streamView === "raw" ? rawActivityLines(taskWidth) : activityLines(taskWidth);
    const maxScroll = Math.max(0, allActivity.length - activityHeight);
    state.streamScroll = Math.min(state.streamScroll, maxScroll);
    const activityEnd = allActivity.length - state.streamScroll;
    const activityStart = Math.max(0, activityEnd - activityHeight);
    const activity = allActivity.slice(activityStart, activityEnd);
    if (activity.length === 0) lines.push(color("  Waiting for Codex output…", "2"));
    else for (const entry of activity) lines.push(`  ${entry}`);

    const streamToggle = state.streamView === "raw" ? "summaries" : "raw logs";
    lines.push(
      "",
      color(
        `[mouse] scroll   [l] ${streamToggle}   [s] graceful stop   [x] kill now / Ctrl+C`,
        "2",
      ),
    );
    return lines;
  }

  function renderSummary(width, height) {
    const taskWidth = Math.max(20, width - 4);
    const lines = [
      `${color("zdloop", "1;36")}  ${color("Summary ready", "1;32")}`,
      color("─".repeat(Math.min(width, 100)), "36"),
      shorten(state.summaryNotice, taskWidth),
      "",
    ];
    const available = Math.max(4, height - 8);
    const recapLines = summaryLines();
    const maxScroll = Math.max(0, recapLines.length - available);
    state.summaryScroll = Math.min(state.summaryScroll, maxScroll);
    lines.push(...recapLines.slice(state.summaryScroll, state.summaryScroll + available));
    if (recapLines.length > available) {
      lines.push(
        color(
          `Showing lines ${state.summaryScroll + 1}-${Math.min(recapLines.length, state.summaryScroll + available)} of ${recapLines.length} • mouse or j/k scroll`,
          "2",
        ),
      );
    }
    lines.push("", color("[c] continue   [q] quit   [x] quit", "2"));
    return lines;
  }

  function render() {
    const width = Math.max(50, Math.min(output.columns ?? 90, 120));
    const height = Math.max(20, output.rows ?? 30);
    const lines =
      state.phase === "summary"
        ? renderSummary(width, height)
        : state.phase === "decision"
          ? renderDecision(
              {
                answer: state.decisionAnswer,
                color,
                notice: state.decisionNotice,
                shorten,
                task: state.decisionTask,
              },
              width,
              height,
            )
          : renderDashboard(width, height);
    output.write(`${TUI_CLEAR}${lines.slice(0, height).join("\n")}`);
  }

  function handleInput(chunk) {
    if (chunk.includes("\u0003")) {
      if (state.phase === "summary") summaryAction?.("quit");
      else {
        control.requestKill();
        if (state.phase === "decision") decisionAction?.("");
      }
      return;
    }

    let sawMouseEvent = false;
    const keyboardInput = chunk.replace(MOUSE_EVENT, (_event, button) => {
      if (button === "64") {
        if (state.phase === "summary") {
          state.summaryScroll = Math.max(0, state.summaryScroll - MOUSE_SCROLL_LINES);
        } else {
          state.streamScroll += MOUSE_SCROLL_LINES;
        }
        sawMouseEvent = true;
      } else if (button === "65") {
        if (state.phase === "summary") {
          state.summaryScroll += MOUSE_SCROLL_LINES;
        } else {
          state.streamScroll = Math.max(0, state.streamScroll - MOUSE_SCROLL_LINES);
        }
        sawMouseEvent = true;
      }
      return "";
    });
    if (sawMouseEvent) render();

    for (const key of keyboardInput) {
      if (state.phase === "decision") {
        if (key === "\r" || key === "\n") {
          const answer = state.decisionAnswer.trim();
          if (!answer) {
            state.decisionNotice = "Type a decision before submitting.";
            render();
          } else {
            const resolveDecision = decisionAction;
            decisionAction = undefined;
            resolveDecision?.(answer);
          }
        } else if (key === "\u007f" || key === "\b") {
          state.decisionAnswer = [...state.decisionAnswer].slice(0, -1).join("");
          state.decisionNotice = "";
          render();
        } else if (key >= " ") {
          state.decisionAnswer += key;
          state.decisionNotice = "";
          render();
        }
        continue;
      }

      if (state.phase === "summary") {
        if (key === "c") summaryAction?.("continue");
        else if (key === "q" || key === "x") summaryAction?.("quit");
        else if (key === "j") {
          state.summaryScroll += 1;
          render();
        } else if (key === "k") {
          state.summaryScroll = Math.max(0, state.summaryScroll - 1);
          render();
        }
        continue;
      }

      if (key === "s") {
        control.requestStop();
        state.notice = "Graceful stop requested — finishing current session, then recap.";
        render();
      } else if (key === "x") {
        control.requestKill();
      } else if (key === "l" || key === "L") {
        state.streamView = state.streamView === "raw" ? "summary" : "raw";
        state.streamScroll = 0;
        render();
      }
    }
  }

  return {
    addActivity(message) {
      if (!message) return;
      state.activity.push({ kind: "summary", text: message });
      state.activity = state.activity.slice(-80);
      render();
    },
    addMarkdown(message) {
      if (!message) return;
      state.activity.push({ kind: "markdown", text: message });
      state.activity = state.activity.slice(-80);
      render();
    },
    addRawLog(message) {
      if (!message) return;
      const bounded =
        message.length <= MAX_RAW_LOG_CHARS
          ? message
          : `${message.slice(0, MAX_RAW_LOG_CHARS)}…[raw log truncated]`;
      state.rawActivity.push(bounded);
      state.rawActivity = state.rawActivity.slice(-80);
      if (state.streamView === "raw") render();
    },
    close() {
      input.off("data", handleInput);
      output.off("resize", render);
      if (input.setRawMode) input.setRawMode(previousRawMode);
      input.pause();
      output.write(`${TUI_EXIT}\n`);
    },
    render,
    setFeedbackProcessed(count) {
      state.feedbackProcessed = count;
      render();
    },
    setLoopState(loopState) {
      state.loopState = loopState;
      render();
    },
    setPhase(phase, currentTask) {
      state.phase = phase;
      if (currentTask) state.currentTask = currentTask;
      if (phase === "running") {
        state.activity = [];
        state.rawActivity = [];
        state.streamScroll = 0;
      }
      render();
    },
    setSessionCount(count) {
      state.sessionCount = count;
      render();
    },
    setStreamStatus(status) {
      state.streamStatus = status;
      render();
    },
    setWaitRemaining(milliseconds) {
      state.waitRemaining = milliseconds;
      render();
    },
    showSummary(summary, notice) {
      state.phase = "summary";
      state.summary = summary;
      state.summaryNotice = notice;
      state.summaryScroll = 0;
      state.notice = "";
      render();
    },
    start() {
      previousRawMode = Boolean(input.isRaw);
      output.write(TUI_ENTER);
      if (input.setRawMode) input.setRawMode(true);
      input.setEncoding("utf8");
      input.resume();
      input.on("data", handleInput);
      output.on("resize", render);
      render();
    },
    waitForSummaryAction() {
      return new Promise((resolvePromise) => {
        summaryAction = (action) => {
          summaryAction = undefined;
          resolvePromise(action);
        };
      });
    },
    waitForDecision(task) {
      state.phase = "decision";
      state.decisionAnswer = "";
      state.decisionNotice = "";
      state.decisionTask = task;
      render();
      return new Promise((resolvePromise) => {
        decisionAction = resolvePromise;
      });
    },
  };
}
