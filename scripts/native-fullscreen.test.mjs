import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/utils/nativeFullscreen.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
const { transitionNativeFullscreen } = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);

function createWindow({ maximized = false, reject = false, confirm = true } = {}) {
  let fullscreen = false;
  const calls = [];
  return {
    calls,
    async isFullscreen() { calls.push("isFullscreen"); return fullscreen; },
    async isMaximized() { calls.push("isMaximized"); return maximized; },
    async unmaximize() { calls.push("unmaximize"); maximized = false; },
    async maximize() { calls.push("maximize"); maximized = true; },
    async setFullscreen(value) {
      calls.push(`setFullscreen:${value}`);
      if (reject) throw new Error("denied");
      if (confirm) fullscreen = value;
    },
  };
}

test("maximized windows leave work-area sizing before entering native fullscreen", async () => {
  const window = createWindow({ maximized: true });
  const entered = await transitionNativeFullscreen(window, false);
  assert.deepEqual(entered, { fullscreen: true, restoreMaximized: true });
  assert.ok(window.calls.indexOf("unmaximize") < window.calls.indexOf("setFullscreen:true"));
  const exited = await transitionNativeFullscreen(window, entered.restoreMaximized);
  assert.deepEqual(exited, { fullscreen: false, restoreMaximized: false });
  assert.equal(window.calls.at(-1), "maximize");
});

test("failed native fullscreen cannot be reported as active and restores maximized state", async () => {
  const window = createWindow({ maximized: true, reject: true });
  await assert.rejects(transitionNativeFullscreen(window, false), /denied/);
  assert.equal(window.calls.at(-1), "maximize");
});

test("a resolved command without a native state change is rejected", async () => {
  const window = createWindow({ confirm: false });
  await assert.rejects(transitionNativeFullscreen(window, false), /未进入全屏/);
});
