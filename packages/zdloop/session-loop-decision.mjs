function wrapText(text, width, shorten) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= width) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = word.length <= width ? word : shorten(word, width);
  }
  if (line) lines.push(line);
  return lines;
}

export function renderDecision({ answer, color, notice, shorten, task }, width, height) {
  const taskWidth = Math.max(20, width - 4);
  const taskLines = wrapText(task, taskWidth, shorten);
  const availableTaskLines = Math.max(3, height - 13);
  const visibleTaskLines = taskLines.slice(0, availableTaskLines);
  if (taskLines.length > visibleTaskLines.length) {
    visibleTaskLines[visibleTaskLines.length - 1] = shorten(
      visibleTaskLines.at(-1) ?? "",
      Math.max(1, taskWidth - 1),
    );
  }
  const answerWidth = Math.max(10, taskWidth - 2);
  const visibleAnswer =
    answer.length <= answerWidth ? answer : `…${answer.slice(-(answerWidth - 1))}`;
  const lines = [
    `${color("zdloop", "1;36")}  ${color("Decision required", "1;33")}`,
    color("─".repeat(Math.min(width, 100)), "36"),
    "Review the preceding COMPARE artifact, then answer the decision below.",
    "",
    ...visibleTaskLines,
    "",
    `${color(">", "1;36")} ${visibleAnswer}${color("▌", "36")}`,
  ];
  if (notice) lines.push("", color(notice, "33"));
  lines.push("", color("[Enter] submit   [Backspace] edit   [Ctrl+C] quit", "2"));
  return lines;
}
