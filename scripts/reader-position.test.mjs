import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/utils/readerPosition.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
const { pickReadingGroupIndex, getScrollPositionSnapshot, createScrollPositionReporter, createScrollRestorationScheduler } = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);

test("a long image crossing the reading line wins over a fully visible short image", () => {
  assert.equal(pickReadingGroupIndex([
    { index: 3, top: -3300, bottom: 500 },
    { index: 4, top: 500, bottom: 600 },
  ], { top: 0, height: 800, scrollTop: 3300, scrollHeight: 6000 }), 3);
});

test("the reading line follows the viewport offset and prefers the next image at a shared edge", () => {
  const groups = [
    { index: 3, top: -1000, bottom: 300 },
    { index: 4, top: 300, bottom: 900 },
  ];
  assert.equal(pickReadingGroupIndex(groups, { top: 100, height: 800, scrollTop: 1500, scrollHeight: 4000 }), 4);
  assert.equal(pickReadingGroupIndex([...groups].reverse(), { top: 100, height: 800, scrollTop: 1500, scrollHeight: 4000 }), 4);
});

test("chapter edges choose the first and final visible pages, including a short last page", () => {
  const groups = [{ index: 0, top: 0, bottom: 100 }, { index: 1, top: 100, bottom: 4000 }];
  assert.equal(pickReadingGroupIndex(groups, { top: 0, height: 800, scrollTop: 0, scrollHeight: 4000 }), 0);
  assert.equal(pickReadingGroupIndex([
    { index: 8, top: -1000, bottom: 700 }, { index: 9, top: 700, bottom: 800 },
  ], { top: 0, height: 800, scrollTop: 3200, scrollHeight: 4000 }), 9);
  assert.equal(pickReadingGroupIndex([], { top: 0, height: 800, scrollTop: 0, scrollHeight: 0 }), null);
});

test("scroll snapshots clamp overscroll and capture the scrollable distance", () => {
  assert.deepEqual(getScrollPositionSnapshot({ scrollTop: 320, scrollHeight: 2000, clientHeight: 800 }), { position: 320, height: 1200 });
  assert.deepEqual(getScrollPositionSnapshot({ scrollTop: -5, scrollHeight: 200, clientHeight: 800 }), { position: 0, height: 0 });
  assert.deepEqual(getScrollPositionSnapshot({ scrollTop: 1500, scrollHeight: 2000, clientHeight: 800 }), { position: 1200, height: 1200 });
});

test("leaving before the trailing timer reports the latest captured position exactly once", () => {
  const reports = [];
  const reporter = createScrollPositionReporter((snapshot) => reports.push(snapshot));
  reporter.capture({ position: 100, height: 1200 });
  reporter.capture({ position: 360, height: 1200 });
  assert.deepEqual(reports, []);
  assert.deepEqual(reporter.flush(), { position: 360, height: 1200 });
  assert.equal(reporter.flush(), null);
  reporter.capture({ position: 360, height: 1200 });
  reporter.flush();
  assert.deepEqual(reports, [{ position: 360, height: 1200 }]);
  reporter.capture({ position: 360, height: 1600 });
  reporter.flush();
  assert.equal(reports.length, 2);
});

function fakeTimers() {
  const callbacks = new Map();
  let nextId = 0;
  return {
    set(callback) { callbacks.set(++nextId, callback); return nextId; },
    clear(id) { callbacks.delete(id); },
    run() { const pending = [...callbacks.values()]; callbacks.clear(); pending.forEach((callback) => callback()); },
    get size() { return callbacks.size; },
  };
}

test("StrictMode effect replay can reschedule a restore cancelled before its timer runs", () => {
  const timers = fakeTimers();
  const scheduler = createScrollRestorationScheduler(timers);
  let position = 0;
  let completed = 0;
  const restore = () => { position = 735; return true; };
  const firstCleanup = scheduler.schedule("chapter", restore, () => completed++);
  firstCleanup();
  scheduler.schedule("chapter", restore, () => completed++);
  timers.run();
  assert.equal(position, 735);
  assert.equal(completed, 1);
  scheduler.schedule("chapter", restore, () => completed++);
  assert.equal(timers.size, 0);
});

test("a new visit to the same chapter resets the completed key and can restore a new location", () => {
  const timers = fakeTimers();
  const scheduler = createScrollRestorationScheduler(timers);
  let position = 0;
  scheduler.schedule("chapter", () => { position = 100; return true; });
  timers.run();
  scheduler.reset();
  scheduler.schedule("chapter", () => { position = 735; return true; });
  timers.run();
  assert.equal(position, 735);
});

test("explicit scroll intent cancels layout retries while effect cleanup permits another setup", () => {
  const timers = fakeTimers();
  const scheduler = createScrollRestorationScheduler(timers);
  let attempts = 0;
  let completed = 0;
  const cleanup = scheduler.schedule("chapter", () => { attempts++; return false; }, () => completed++);
  timers.run();
  assert.equal(attempts, 1);
  assert.equal(timers.size, 1);
  cleanup();
  scheduler.schedule("chapter", () => { attempts++; return false; }, () => completed++);
  scheduler.cancel("chapter");
  timers.run();
  assert.equal(attempts, 1);
  assert.equal(completed, 0);
  assert.equal(timers.size, 0);
});
