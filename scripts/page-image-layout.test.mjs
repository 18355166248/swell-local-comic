import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/utils/pageImageLayout.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
const { getPageImageLayout } = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);

test("height mode fills the canvas height without distorting the image", () => {
  const layout = getPageImageLayout({ width: 1920, height: 1080 }, { width: 1800, height: 1200 }, "height", 1);
  assert.equal(layout.height, 1200);
  assert.equal(layout.width, 1920 * 1200 / 1080);
  assert.ok(layout.width > 1800);
});

test("complete mode keeps the whole image visible and original mode keeps native dimensions", () => {
  const viewport = { width: 1800, height: 1200 };
  assert.deepEqual(getPageImageLayout({ width: 1920, height: 1080 }, viewport, "contain", 1), { width: 1800, height: 1012.5 });
  assert.deepEqual(getPageImageLayout({ width: 1920, height: 1080 }, viewport, "original", 1), { width: 1920, height: 1080 });
});

test("height mode follows fullscreen viewport changes and zoom", () => {
  const image = { width: 1920, height: 1080 };
  assert.equal(getPageImageLayout(image, { width: 1800, height: 1200 }, "height", 1).height, 1200);
  assert.equal(getPageImageLayout(image, { width: 2200, height: 1389 }, "height", 1).height, 1389);
  assert.equal(getPageImageLayout(image, { width: 2200, height: 1389 }, "height", 1.5).height, Math.floor(1389 * 1.5));
  assert.deepEqual(getPageImageLayout(null, { width: 2200, height: 1389 }, "height", 1), { width: 0, height: 0 });
});
