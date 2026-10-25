import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/utils/readerUtils.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
const { parsePageNumber, getPageRange, normalizeImagesPerGroup } = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);

test("saved image grouping accepts supported counts and safely defaults legacy or invalid values", () => {
  for (const count of [1, 2, 3, 5, 20]) assert.equal(normalizeImagesPerGroup(count), count);
  for (const value of [undefined, null, 0, -1, 21, 1.5, NaN, Infinity, "2"]) {
    assert.equal(normalizeImagesPerGroup(value), 1, String(value));
  }
});

test("page input accepts only in-range whole page numbers", () => {
  assert.equal(parsePageNumber(" 12 ", 25), 11);
  assert.equal(parsePageNumber("1", 25), 0);
  assert.equal(parsePageNumber("25", 25), 24);
  for (const input of ["", " ", "0", "-1", "26", "1.5", "1e1", "Infinity", "NaN", "abc"]) {
    assert.equal(parsePageNumber(input, 25), null, input);
  }
  assert.equal(parsePageNumber("1", 0), null);
});

test("overview groups stay bounded and include the current page", () => {
  assert.deepEqual(getPageRange(0, 25), { start: 0, end: 12 });
  assert.deepEqual(getPageRange(11, 25), { start: 0, end: 12 });
  assert.deepEqual(getPageRange(12, 25), { start: 12, end: 24 });
  assert.deepEqual(getPageRange(24, 25), { start: 24, end: 25 });
  assert.deepEqual(getPageRange(100, 25), { start: 24, end: 25 });
  assert.deepEqual(getPageRange(0, 0), { start: 0, end: 0 });
  for (let index = 0; index < 1000; index++) {
    const {start, end} = getPageRange(index, 1000);
    assert.ok(start <= index && end > index && end <= 1000 && end - start <= 12);
  }
});

const writerSource = await readFile(new URL("../src/utils/bufferedWriter.ts", import.meta.url), "utf8");
const writerOutput = ts.transpileModule(writerSource, { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
const { createBufferedWriter } = await import(`data:text/javascript;base64,${Buffer.from(writerOutput).toString("base64")}`);

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

test("frequent reader updates persist latest progress at a fixed interval", () => {
  const timers = fakeTimers();
  const writes = [];
  const writer = createBufferedWriter((value) => writes.push(value), 250, timers);
  for (let page = 1; page <= 100; page++) writer.schedule("chapter-a", { page });
  assert.equal(timers.size, 1);
  assert.deepEqual(writes, []);
  timers.run();
  assert.deepEqual(writes, [{page:100}]);
  writer.schedule("chapter-a", {page:101});
  timers.run();
  assert.deepEqual(writes, [{page:100}, {page:101}]);
});

test("switching chapters saves old progress and leaving flushes final progress exactly once", () => {
  const timers = fakeTimers();
  const writes = [];
  const writer = createBufferedWriter((value) => writes.push(value), 250, timers);
  writer.schedule("chapter-a", {chapter:"a", page:12});
  writer.schedule("chapter-b", {chapter:"b", page:1});
  assert.deepEqual(writes, [{chapter:"a",page:12}]);
  writer.schedule("chapter-b", {chapter:"b", page:4});
  writer.flush();
  writer.flush();
  timers.run();
  assert.deepEqual(writes, [{chapter:"a",page:12}, {chapter:"b",page:4}]);
  assert.equal(timers.size, 0);
});
