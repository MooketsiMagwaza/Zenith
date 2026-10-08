// Captures the real Zenith app with invented sample data, for the marketing site's images.
// Build the app (npm run build -w @zenith/app), serve apps/app/dist on any local port, then:
//   ZEN_LABEL="禅 zen" node apps/marketing/scripts/capture-app.mjs http://127.0.0.1:4173/ apps/marketing/public/shots
// It drives headless Microsoft Edge over the DevTools protocol (Windows path below), seeds the
// app's storage, and saves decks, journal, history and zen as WebP at 1440 x 900.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [appUrl, outDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const port = 9333;
const profile = join(tmpdir(), "zenith-capture-profile");
const edge = spawn(EDGE, [
  "--headless=new",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "--disable-extensions",
  "--hide-scrollbars",
  "--window-size=1440,900",
  "about:blank",
]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let targets;
for (let i = 0; i < 50; i++) {
  try {
    targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    if (targets.some((t) => t.type === "page")) break;
  } catch {}
  await sleep(200);
}
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let seq = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
};
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const id = ++seq;
    pending.set(id, (m) => (m.error ? rej(new Error(`${method}: ${JSON.stringify(m.error)}`)) : res(m.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
};

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

// ---- sample data (plausible, invented, nothing personal) ----
const now = Date.now();
const H = 3600, M = 60;
const id = (s) => `sample-${s}`;
const decks = [
  {
    id: id("thesis"), name: "Thesis", color: "#c9a84c",
    tasks: [
      { id: id("lit"), deckId: id("thesis"), name: "Literature review", tag: "read", totalSeconds: 14 * H + 12 * M, createdAt: now - 40 * 86400e3, mode: "stopwatch" },
      { id: id("ch3"), deckId: id("thesis"), name: "Chapter 3 draft", tag: "write", totalSeconds: 9 * H + 20 * M, createdAt: now - 30 * 86400e3, mode: "stopwatch",
        checklist: [
          { id: id("c1"), text: "Rewrite the sampling section", done: true },
          { id: id("c2"), text: "Add the pilot study table", done: true },
          { id: id("c3"), text: "Tighten the threats to validity", done: false },
        ] },
      { id: id("data"), deckId: id("thesis"), name: "Data analysis", tag: "code", totalSeconds: 6 * H + 5 * M, createdAt: now - 20 * 86400e3, mode: "stopwatch" },
    ],
  },
  {
    id: id("piano"), name: "Piano", color: "#3aa6a0",
    tasks: [
      { id: id("scales"), deckId: id("piano"), name: "Scales and arpeggios", tag: "drill", totalSeconds: 5 * H + 25 * M, createdAt: now - 50 * 86400e3, mode: "countdown", targetSeconds: 25 * M },
      { id: id("nocturne"), deckId: id("piano"), name: "Nocturne in E-flat", tag: "piece", totalSeconds: 7 * H + 40 * M, createdAt: now - 45 * 86400e3, mode: "stopwatch" },
      { id: id("sight"), deckId: id("piano"), name: "Sight-reading", tag: "read", totalSeconds: 2 * H + 10 * M, createdAt: now - 10 * 86400e3, mode: "countdown", targetSeconds: 15 * M },
    ],
  },
  {
    id: id("rust"), name: "Learning Rust", color: "#8a7fb8",
    tasks: [
      { id: id("book"), deckId: id("rust"), name: "The Book, chapter 10", tag: "read", totalSeconds: 3 * H + 30 * M, createdAt: now - 12 * 86400e3, mode: "stopwatch" },
      { id: id("cli"), deckId: id("rust"), name: "Small CLI project", tag: "build", totalSeconds: 4 * H + 15 * M, createdAt: now - 8 * 86400e3, mode: "stopwatch" },
    ],
  },
];
const byId = Object.fromEntries(decks.flatMap((d) => d.tasks.map((t) => [t.id, { t, d }])));
const plan = [
  // [days ago, hour, minute, task, minutes]
  [0, 7, 40, "scales", 25], [0, 9, 10, "lit", 70],
  [1, 8, 0, "ch3", 95], [1, 13, 30, "data", 55], [1, 20, 15, "nocturne", 40],
  [2, 9, 0, "lit", 80], [2, 18, 45, "book", 45],
  [3, 7, 30, "scales", 25], [3, 10, 0, "ch3", 110], [3, 21, 0, "cli", 60],
  [4, 9, 15, "data", 65], [4, 19, 30, "nocturne", 35], [4, 20, 10, "sight", 15],
  [5, 8, 45, "lit", 90], [5, 14, 0, "ch3", 75],
  [6, 10, 0, "cli", 50], [6, 17, 20, "scales", 25],
];
const logs = plan.map(([ago, h, m, tid, mins], i) => {
  const d = new Date(now);
  d.setDate(d.getDate() - ago);
  d.setHours(h, m, 0, 0);
  const { t, d: deck } = byId[id(tid)];
  const startedAt = d.getTime();
  return { id: id(`log${i}`), taskId: t.id, taskName: t.name, deckName: deck.name, deckColor: deck.color,
    duration: mins * 60, startedAt, endedAt: startedAt + mins * 60e3, hasJournal: tid === "ch3" };
}).filter((l) => l.endedAt < now).sort((a, b) => b.startedAt - a.startedAt);
const body = [
  "# Chapter 3: Methods",
  "",
  "## Where it stands",
  "",
  "The sampling section reads cleanly now. Moving the pilot study **before** the main design made the argument easier to follow.",
  "",
  "## Next session",
  "",
  "- [x] Rewrite the sampling section",
  "- [x] Add the pilot study table",
  "- [ ] Tighten the threats to validity",
  "",
  "> Write the hard paragraph first, while the coffee is still warm.",
  "",
  "| Part | Words | State |",
  "| --- | --- | --- |",
  "| 3.1 Design | 1,240 | done |",
  "| 3.2 Sampling | 980 | revised |",
  "| 3.3 Validity | 410 | rough |",
].join("\n");
const journals = [
  { id: id("j-ch3"), taskId: id("ch3"), taskName: "Chapter 3 draft", deckId: id("thesis"), deckName: "Thesis", deckColor: "#c9a84c",
    logId: null, body, wordCount: body.split(/\s+/).filter(Boolean).length, createdAt: now - 9 * 86400e3, updatedAt: now - 3600e3 },
  { id: id("j-piano"), taskId: null, taskName: "", deckId: id("piano"), deckName: "Piano", deckColor: "#3aa6a0",
    logId: null, body: "# Piano\n\nSlow practice on the left hand. Bars 13 to 16 are finally even at 60.", wordCount: 15, createdAt: now - 6 * 86400e3, updatedAt: now - 2 * 86400e3 },
];
const active = { taskIds: [id("ch3")], deckIds: [id("thesis")], startedAt: now - (47 * 60 + 12) * 1000 };
const seed = {
  toggl_zen_decks: JSON.stringify(decks),
  toggl_zen_logs: JSON.stringify(logs),
  toggl_zen_journals: JSON.stringify(journals),
  toggl_zen_active: JSON.stringify(active),
  toggl_zen_reminders: "[]",
  "zenith.tutorial.seen": "1",
  "zenith.zen.pack": "musashi",
  "zenith.zen.wallIdx": "9",
  "zenith.zen.intervalSec": "0",
};

await send("Page.navigate", { url: appUrl });
await sleep(1500);
await evaluate(`(() => { localStorage.clear(); const s = ${JSON.stringify(seed)}; for (const k in s) localStorage.setItem(k, s[k]); return true; })()`);
await send("Page.navigate", { url: appUrl });
await sleep(2500);

const clickText = (text, nth = 0) =>
  evaluate(`(() => {
    const want = ${JSON.stringify(text)}.toLowerCase();
    const els = [...document.querySelectorAll("button, a, [role=button], [role=tab], [role=menuitem]")]
      .filter((e) => (e.innerText || e.getAttribute("aria-label") || "").trim().split(/[\\n\\t ]+/).join(" ").toLowerCase() === want && e.offsetParent !== null);
    if (!els[${nth}]) return "missing: " + want + " (" + els.length + ")";
    els[${nth}].click();
    return "clicked " + want;
  })()`);
const shot = async (name) => {
  await sleep(900);
  const { data } = await send("Page.captureScreenshot", { format: "webp", quality: 92 });
  writeFileSync(join(outDir, `${name}.webp`), Buffer.from(data, "base64"));
  console.log("saved", name);
};
const list = () => evaluate(`[...document.querySelectorAll("button, [role=button], [role=tab]")].filter(e => e.offsetParent !== null).map(e => (e.innerText || e.getAttribute("aria-label") || "").trim().replace(/\\s+/g, " ")).filter(Boolean).slice(0, 80)`);

const step = process.env.STEP || "all";
if (step === "list") {
  console.log(JSON.stringify(await list()));
} else {
  await shot("decks");
  console.log(await clickText("Journal"));
  await sleep(800);
  if (process.env.JOURNAL_CLICK) console.log(await clickText(process.env.JOURNAL_CLICK));
  if (process.env.LIST_AFTER_JOURNAL) console.log(JSON.stringify(await list()));
  await shot("journal");
  console.log(await clickText("History"));
  await shot("history");
  console.log(await clickText(process.env.ZEN_LABEL || "Zen"));
  await sleep(1500);
  await shot("zen");
}
ws.close();
edge.kill();
process.exit(0);
