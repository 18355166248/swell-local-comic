import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/utils/readerUtils.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
const { parsePageNumber, getPageRange } = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);

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
