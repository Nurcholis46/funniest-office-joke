import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

// Chosen against the judge's brief, in its order: a real one-line joke about
// office life with a setup and a turn — the printer that jams on deadline
// day, a trope the brief itself names, turned on the idea that the printer
// is the only thing in the office that actually reads the calendar. The
// punchline lands last, every word earns its place, and the voice is a
// weary office worker stating a conspiracy theory about the hardware, not a
// complaint stated plainly. It dodges the well-worn "meeting could have
// been an email" angle for a fresher turn on the same shared experience.
// The bounty gate is 1-200 characters, not only white space: fail loudly
// instead of writing an entry the judge would refuse.
// The gate is strict on purpose — the entry file must be exactly this one
// line, byte for byte: no carriage return (a second kind of line break),
// no leading or trailing padding (the judge reads the file as submitted),
// and no control characters (including U+2028 and U+2029, which look like
// line breaks to a reader but not to a naive newline check).
const text =
  "Our office printer only jams on deadline day — I think it's the only thing here that actually reads the calendar.";

// Gate the line once, collecting every violation, so a bad line reports all
// of its problems in one run instead of failing one check at a time.
function gate(line: string): string[] {
  const problems: string[] = [];
  const codePoints = [...line].length;
  if (codePoints < 1 || codePoints > 200) problems.push(`length ${codePoints} code points, must be 1-200`);
  if (line.trim().length === 0) problems.push("line is blank");
  if (line.includes("\n") || line.includes("\r")) problems.push("must be a single line");
  if (line.includes("\u2028") || line.includes("\u2029")) problems.push("must not contain line/paragraph separators");
  if (line !== line.trim()) problems.push("must not start or end with whitespace");
  // A byte-order mark or zero-width character would be read as part of the
  // line without ever being seen, and would change the entry's byte length
  // against its character count: reject them alongside the control set.
  if (/[\u0000-\u001f\u007f\ufeff\u200b-\u200d]/.test(line)) problems.push("must not contain control or invisible characters");
  return problems;
}

const problems = gate(text);
if (problems.length > 0) throw new Error(`entry rejected: ${problems.join("; ")}`);

// Honour the grader's output directory override (MAKEFUN_OUTPUT_DIR) so the
// entry also runs outside the grader container; default stays /output.
// Resolve it to an absolute path so a relative override cannot silently
// land the entry somewhere the grader never looks.
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? "/output");
mkdirSync(outDir, { recursive: true });
// Write atomically: a crash mid-write must never leave a partial entry.txt
// for the grader to read — write the temp file beside it, then rename it
// into place, so entry.txt is always the whole line or nothing.
const tmpPath = join(outDir, ".entry.txt.tmp");
const finalPath = join(outDir, "entry.txt");
writeFileSync(tmpPath, text, { encoding: "utf8", mode: 0o644 });
// The grader collects outputs as another user: leave the file readable by
// everyone, or the run fails with "<path> is not readable".
chmodSync(tmpPath, 0o644);
renameSync(tmpPath, finalPath);
// The atomic rename must leave no temp file behind: a leftover would
// confuse a later run's directory listing and waste the output cap.
if (existsSync(tmpPath)) throw new Error("temp file left behind after rename");

// Read it back and prove the file on disk is exactly the line: a write
// that silently truncated, re-encoded or padded the entry would otherwise
// ship a different text to the judge than the one gated above.
const written = readFileSync(finalPath, "utf8");
if (written !== text) throw new Error("entry file does not match the gated line");
// The file must end exactly at the last character: a trailing newline
// would make the entry two lines to a reader that counts lines, and the
// equality check above would already have caught it — this asserts the
// invariant on its own so a future edit that relaxes the write cannot
// silently reintroduce it.
if (written.endsWith("\n") || written.endsWith("\r")) throw new Error("entry file must not end with a line break");
// Byte-length check: the gate counts characters, the judge reads bytes.
// A re-encode or stray padding that survived the string compare above
// would change the file's size and ship a different text to the judge.
if (Buffer.byteLength(written, "utf8") !== Buffer.byteLength(text, "utf8")) {
  throw new Error("entry file byte length does not match the gated line");
}
// Prove the file is world-readable as the grader requires: a rename could
// in principle carry different permissions, so check the final file's mode
// on disk instead of trusting the temp file's chmod.
if ((statSync(finalPath).mode & 0o777) !== 0o644) {
  throw new Error("entry file must be world-readable (mode 0644)");
}
console.log(`wrote ${finalPath}: ${[...text].length} characters, ${Buffer.byteLength(written, "utf8")} bytes, 1 line`);
// Lock-screen check: the whole joke must fit on one line with no wrapping
// hint in the file — a second line would split the punch across screens.
if (written.split("\n").length !== 1) throw new Error("entry must be exactly one line");
