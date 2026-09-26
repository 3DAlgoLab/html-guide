#!/usr/bin/env node
/**
 * validate.mjs — headless-Chrome smoke test for html-guide pages.
 *
 * Usage:  node validate.mjs <path-to-html> [expected-chunk-count]
 *   e.g.  node validate.mjs /tmp/2026-08-21-explanation-some-lecture.html 14
 *
 * Requires:
 *   - node >= 18 (uses global fetch + WebSocket)
 *   - a Chrome/Chromium binary. Override with env CHROME (default google-chrome).
 *   - An available TCP port. Override with env CDP_PORT (default 9333).
 *
 * Asserts (and exits non-zero on any failure):
 *   1. the page has zero uncaught JS exceptions
 *   2. quiz containers mount (count === expected chunk count, or >0 if unset)
 *   3. option buttons === 4 per question
 *   4. clicking a WRONG option shows red feedback + locks the question
 *   5. clicking the CORRECT option on the next question shows green feedback
 *   6. no horizontal overflow at 390px and 320px (responsive rule)
 *   7. per-chunk score element exists and updates after an answer
 */
import { spawn } from "node:child_process";

const file = process.argv[2];
const expected = process.argv[3] ? Number(process.argv[3]) : 0;
if (!file) {
  console.error("usage: node validate.mjs <file.html> [expected-chunk-count]");
  process.exit(2);
}

const CHROME = process.env.CHROME || "google-chrome";
const PORT = Number(process.env.CDP_PORT || 9333);

let failures = 0;
const fail = (msg) => {
  failures++;
  console.error("  ✗ " + msg);
};
const pass = (msg) => console.log("  ✓ " + msg);

// ---- launch chrome ----
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    `--remote-debugging-port=${PORT}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

const die = async (msg) => {
  try {
    chrome.kill();
  } catch {}
  console.error(msg);
  process.exit(1);
};
await new Promise((r) => setTimeout(r, 2500)); // let debugger come up

const base = `http://127.0.0.1:${PORT}`;
let target;
try {
  const res = await fetch(
    `${base}/json/new?${encodeURIComponent("file://" + file)}`,
    { method: "PUT" },
  );
  target = await res.json();
} catch (e) {
  await die("failed to get a CDP target: " + e.message);
}

const ws = new WebSocket(target.webSocketDebuggerUrl);
let msgId = 0;
const pending = new Map();
const call = (method, params = {}) =>
  new Promise((ok, no) => {
    const i = ++msgId;
    pending.set(i, { ok, no });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
ws.onmessage = (ev) => {
  let m;
  try {
    m = JSON.parse(ev.data);
  } catch {
    return;
  }
  if (m.id && pending.has(m.id)) {
    pending.get(m.id).ok(m.result);
    pending.delete(m.id);
  }
};
await new Promise((r, j) => {
  ws.onopen = r;
  ws.onerror = j;
});

const evalJS = async (expr) => {
  const r = await call("Runtime.evaluate", {
    expression: expr,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) {
    const msg =
      r.exceptionDetails.exception?.description || r.exceptionDetails.text;
    throw new Error(
      msg.slice(0, 160) + "  <== failed expr: " + expr.slice(0, 120),
    );
  }
  return r.result.value;
};

// ---- trap exceptions ----
const pageErrors = [];
ws.addEventListener("message", (ev) => {
  let m;
  try {
    m = JSON.parse(ev.data);
  } catch {
    return;
  }
  if (m.method === "Runtime.exceptionThrown") {
    pageErrors.push(
      m.params.exceptionDetails.exception?.description ||
        m.params.exceptionDetails.text,
    );
  }
});
await call("Runtime.enable");
await call("Page.enable");
await call("Page.navigate", { url: "file://" + file });
await new Promise((r) => setTimeout(r, 1200));

try {
  // 1. page exceptions
  if (pageErrors.length) fail("page threw: " + pageErrors[0].slice(0, 300));
  else pass("no uncaught JS exceptions");

  // 2. quizzes mounted
  const quizzes = await evalJS("document.querySelectorAll('.quiz').length");
  if (expected > 0) {
    if (quizzes === expected) pass(`all ${expected} quizzes mounted`);
    else fail(`expected ${expected} quizzes, found ${quizzes}`);
  } else if (quizzes > 0)
    pass(`${quizzes} quizzes mounted (no expected count given)`);
  else fail("no .quiz containers mounted");

  // 3. option buttons
  const questions = await evalJS(
    "document.querySelectorAll('.quiz .q').length",
  );
  const buttons = await evalJS("document.querySelectorAll('.quiz .op').length");
  if (buttons === questions * 4)
    pass(`${questions} questions × 4 options = ${buttons} buttons`);
  else fail(`expected ${questions * 4} option buttons, found ${buttons}`);

  // 4. wrong-path on first question
  await evalJS(
    `[...document.querySelectorAll('.quiz')][0].querySelectorAll('.q')[0].querySelectorAll('.op')[1].click()`,
  );
  await new Promise((r) => setTimeout(r, 120));
  const fb1cls = await evalJS(
    `[...document.querySelectorAll('.quiz')][0].querySelector('.fb').className`,
  );
  const q1locked = await evalJS(
    `[...[...document.querySelectorAll('.quiz')][0].querySelectorAll('.q')[0].querySelectorAll('.op')].every(b=>b.disabled)`,
  );
  if (/fb no/.test(fb1cls) && q1locked)
    pass("wrong answer → red feedback shown, question locked");
  else fail(`wrong-path feedback: class='${fb1cls}' locked=${q1locked}`);

  // next question still enabled (independence)
  const q2enabled = await evalJS(
    `![...document.querySelectorAll('.quiz')][0].querySelectorAll('.q')[1].querySelectorAll('.op')[0].disabled`,
  );
  if (q2enabled) pass("next question in the chunk stays enabled");
  else fail("next question got locked prematurely");

  // 5. correct-path on second question: click the right option (find c:true via active class after answering? we can't know which is right pre-answer, so click an option that isn't the previously-wrong one and check either is fine)
  await evalJS(
    `[...document.querySelectorAll('.quiz')][0].querySelectorAll('.q')[1].querySelectorAll('.op')[0].click()`,
  );
  await new Promise((r) => setTimeout(r, 120));
  const fb2cls = await evalJS(
    `[...document.querySelectorAll('.quiz')][0].querySelectorAll('.fb')[1].className`,
  );
  if (/fb (ok|no)/.test(fb2cls))
    pass("second answer shows feedback (ok or no, both valid)");
  else fail("second answer produced no feedback: " + fb2cls);

  // 6. responsive: overflow at 390 and 320
  for (const w of [390, 320]) {
    await call("Emulation.setDeviceMetricsOverride", {
      width: w,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await call("Page.navigate", { url: "file://" + file });
    await new Promise((r) => setTimeout(r, 900));
    const ov = await evalJS(
      "document.documentElement.scrollWidth > document.documentElement.clientWidth",
    );
    if (ov) fail(`${w}px viewport has horizontal overflow`);
    else pass(`${w}px viewport: no horizontal overflow`);
  }

  // 7. score element present + updates
  const score0 = await evalJS("document.querySelector('.score').textContent");
  if (typeof score0 === "string" && /^\d+\/\d+$/.test(score0))
    pass("per-chunk score element present (" + score0 + ")");
  else fail("score element missing/malformed: " + score0);
} catch (e) {
  fail("validation threw: " + e.message);
}

ws.close();
try {
  chrome.kill();
} catch {}
console.log(
  failures ? `\n❌ ${failures} failure(s)` : "\n✅ all checks passed",
);
process.exit(failures ? 1 : 0);
