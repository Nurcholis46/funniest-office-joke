// funniest-office-joke — writes the entry line to /output/entry.txt.
//
// The joke itself: a printer that only jams on deadline day. The setup is
// a shared office frustration (the printer always breaks at the worst
// moment) and the turn is that the printer must actually be reading the
// calendar — the only thing in the office that does. Punchline last,
// one line, weary-worker voice.

import { chmodSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// The entry. Fixed by the bounty brief: exactly this line, no trailing
// newline, no leading/trailing spaces. 113 characters, well inside 1-200.
const JOKE =
  "Our office printer only jams on deadline day — I think it's the only thing here that actually reads the calendar.";

const OUTPUT_FILE = "entry.txt";

// Small helpers so each gate rule reads as one plain sentence.
function countChars(s: string): number {
  return [...s].length;
}

function hasLineBreak(s: string): boolean {
  return s.includes("\n") || s.includes("\r") || s.includes("\u2028") || s.includes("\u2029");
}

function hasInvisible(s: string): boolean {
  // Control characters, BOM and zero-width marks would silently change
  // the bytes the judge reads, so they are rejected outright.
  return /[\u0000-\u001f\u007f\ufeff\u200b-\u200d]/.test(s);
}

// Check the line against the bounty gate and stop with a clear message
// on the first problem found, instead of writing a file the judge
// would throw out.
function checkEntry(line: string): void {
  const n = countChars(line);
  if (n < 1 || n > 200) {
    throw new Error(`entry is ${n} characters, must be 1-200`);
  }
  if (line.trim().length === 0) {
    throw new Error("entry is only whitespace");
  }
  if (hasLineBreak(line)) {
    throw new Error("entry must be a single line");
  }
  if (line !== line.trim()) {
    throw new Error("entry must not start or end with whitespace");
  }
  if (hasInvisible(line)) {
    throw new Error("entry must not contain control or invisible characters");
  }
}

// Where the grader looks: MAKEFUN_OUTPUT_DIR when set, /output otherwise.
function outputDir(): string {
  return process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
}

function main(): void {
  checkEntry(JOKE);

  const dir = outputDir();
  mkdirSync(dir, { recursive: true });

  const path = join(dir, OUTPUT_FILE);
  // No trailing newline: the file is exactly the joke line, nothing more.
  // writeFileSync writes the string as-is, so no newline is added here.
  writeFileSync(path, JOKE, { encoding: "utf8", mode: 0o644 });

  // The grader collects the output as a different user, so the file has
  // to be world-readable. Set the mode explicitly rather than trusting
  // the process umask — and set it on the file only, never on /output.
  chmodSync(path, 0o644);

  // Read the file back and confirm it is byte-for-byte the gated line:
  // a truncated write or a re-encode would otherwise ship a different
  // joke to the judge than the one checked above.
  const back = readFileSync(path, "utf8");
  if (back !== JOKE) {
    throw new Error("entry.txt does not match the gated joke line");
  }
  if (back.split("\n").length !== 1) {
    throw new Error("entry.txt must be exactly one line");
  }
  if (Buffer.byteLength(back, "utf8") !== Buffer.byteLength(JOKE, "utf8")) {
    throw new Error("entry.txt byte length does not match the joke line");
  }
  const mode = statSync(path).mode & 0o777;
  if (mode !== 0o644) {
    throw new Error(`entry.txt mode is ${mode.toString(8)}, expected 0644`);
  }

  console.log(
    `wrote ${path}: ${countChars(JOKE)} characters, ${Buffer.byteLength(back, "utf8")} bytes, 1 line, mode 0644`,
  );
}

main();
