import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/utils/readerImageResources.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { createReaderImageResources, createReaderResourceLifecycle, getReaderImageLoadOrder, StaleReaderImageRequest } = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
const files = Array.from({ length: 30 }, (_, index) => ({ name: `${index}.png`, path: `/chapter/${index}.png` }));
const resource = (index) => ({ url: `blob:${index}`, size: { width: 800, height: 1200 + index } });
const tick = () => new Promise((resolve) => setImmediate(resolve));

function controlledLoader() {
  const started = [];
  const pending = new Map();
  let active = 0;
  let peak = 0;
  return {
    started,
    get peak() { return peak; },
    load(file) {
      started.push(file.path);
      active++;
      peak = Math.max(peak, active);
      return new Promise((resolve, reject) => pending.set(file.path, { resolve, reject })).finally(() => active--);
    },
    resolve(index) { pending.get(files[index].path).resolve(resource(index)); },
    reject(index) { pending.get(files[index].path).reject(new Error("read failed")); },
  };
}

test("the restored target starts first and three images unlock without waiting for the chapter", async () => {
  const loader = controlledLoader();
  const store = createReaderImageResources(loader.load, () => {});
  const order = getReaderImageLoadOrder(files.length, 12);
  assert.deepEqual(order.slice(0, 3), [12, 13, 11]);
  assert.equal(new Set(order).size, files.length);
  const requests = order.map((index) => store.load(files[index]));
  const done = Promise.allSettled(requests);
  let firstScreenReady = false;
  void Promise.allSettled(requests.slice(0, 3)).then(() => { firstScreenReady = true; });
  await tick();
  assert.deepEqual(loader.started, [files[12].path, files[13].path, files[11].path]);
  loader.resolve(12); loader.resolve(13); loader.resolve(11);
  await tick();
  assert.equal(firstScreenReady, true);
  assert.equal(store.snapshot(files).states.filter((state) => state === "ready").length, 3);
  assert.equal(loader.peak, 3);
  assert.ok(loader.started.length < files.length);
  store.reset();
  await done;
});

test("a session reset rejects old work, skips its queued reads and releases its late result", async () => {
  const loader = controlledLoader();
  const released = [];
  const store = createReaderImageResources(loader.load, (url) => released.push(url), 1);
  const oldFirst = store.load(files[0]);
  assert.equal(store.load(files[0]), oldFirst);
  const oldQueued = store.load(files[1]);
  const oldDone = Promise.allSettled([oldFirst, oldQueued]);
  await tick();
  store.reset();
  const fresh = store.load(files[2]);
  loader.resolve(0);
  await tick();
  assert.deepEqual(loader.started, [files[0].path, files[2].path]);
  assert.deepEqual(released, ["blob:0"]);
  assert.equal(store.get(files[0].path), undefined);
  const oldResults = await oldDone;
  assert.ok(oldResults.every((result) => result.status === "rejected" && result.reason instanceof StaleReaderImageRequest));
  loader.resolve(2);
  assert.equal((await fresh).url, "blob:2");
  store.reset();
  assert.deepEqual(released, ["blob:0", "blob:2"]);
});

test("switching modes reuses the current URL while one owner releases every other URL once", async () => {
  const reads = [];
  const released = [];
  const store = createReaderImageResources(async (file) => {
    reads.push(file.path);
    return resource(files.indexOf(file));
  }, (url) => released.push(url));
  await Promise.all([0, 1, 2].map((index) => store.load(files[index])));
  const generation = store.generation;
  store.reset([files[1].path]);
  assert.equal(store.generation, generation + 1);
  assert.equal((await store.load(files[1])).url, "blob:1");
  assert.equal(reads.filter((path) => path === files[1].path).length, 1);
  assert.deepEqual(released.sort(), ["blob:0", "blob:2"]);
  store.reset(); store.reset();
  assert.deepEqual(released.sort(), ["blob:0", "blob:1", "blob:2"]);
});

test("a reset in the same event prevents even the scheduled old reads from starting", async () => {
  const reads = [];
  const store = createReaderImageResources(async (file) => {
    reads.push(file.path);
    return resource(files.indexOf(file));
  }, () => {});
  const old = store.load(files[0]);
  const oldDone = Promise.allSettled([old]);
  store.reset();
  await store.load(files[1]);
  assert.deepEqual(reads, [files[1].path]);
  assert.equal((await oldDone)[0].status, "rejected");
  store.reset();
});

test("jumping ahead promotes a queued target and a failed preload can be retried", async () => {
  const loader = controlledLoader();
  const store = createReaderImageResources(loader.load, () => {}, 1);
  const requests = [0, 1, 2, 3].map((index) => store.load(files[index]));
  const done = Promise.allSettled(requests);
  await tick();
  store.prioritize([files[3].path]);
  loader.resolve(0);
  await tick();
  assert.equal(loader.started[1], files[3].path);
  loader.reject(3);
  await tick();
  assert.equal(store.snapshot(files).states[3], "error");
  const retry = store.load(files[3]);
  const retryDone = Promise.allSettled([retry]);
  store.prioritize([files[3].path]);
  loader.resolve(1);
  await tick();
  assert.equal(loader.started[3], files[3].path);
  loader.resolve(3);
  assert.equal((await retry).url, "blob:3");
  store.reset();
  await Promise.all([done, retryDone]);
});

test("StrictMode and refresh replay preserve the same owner until its final unmount", () => {
  const deferred = [];
  const lifecycle = createReaderResourceLifecycle((cleanup) => deferred.push(cleanup));
  let resets = 0;
  let cancellations = 0;
  const owner = { reset() { resets++; } };
  const cancelRequests = () => cancellations++;
  const firstCleanup = lifecycle.mount(owner, cancelRequests);
  firstCleanup();
  const refreshedCleanup = lifecycle.mount(owner, cancelRequests);
  deferred.splice(0).forEach((cleanup) => cleanup());
  assert.equal(resets, 0);
  assert.equal(cancellations, 0);
  refreshedCleanup();
  deferred.splice(0).forEach((cleanup) => cleanup());
  assert.equal(resets, 1);
  assert.equal(cancellations, 1);
});

test("replacing an owner releases its held reads without draining the old thirty-page queue", async () => {
  const deferred = [];
  const lifecycle = createReaderResourceLifecycle((cleanup) => deferred.push(cleanup));
  const loader = controlledLoader();
  const oldReleased = [];
  const oldOwner = createReaderImageResources(loader.load, (url) => oldReleased.push(url));
  const oldCleanup = lifecycle.mount(oldOwner, () => assert.fail("replacement must not cancel the new owner's requests"));
  const oldRequests = files.map((file) => oldOwner.load(file));
  const oldDone = Promise.allSettled(oldRequests);
  await tick();
  assert.equal(loader.started.length, 3);
  oldCleanup();
  let newCancellations = 0;
  let newResets = 0;
  const newCleanup = lifecycle.mount({ reset() { newResets++; } }, () => newCancellations++);
  deferred.splice(0).forEach((cleanup) => cleanup());
  loader.resolve(0); loader.resolve(1); loader.resolve(2);
  await tick();
  assert.equal(loader.started.length, 3);
  assert.deepEqual(oldReleased.sort(), ["blob:0", "blob:1", "blob:2"]);
  assert.equal(oldOwner.snapshot(files).urls.filter(Boolean).length, 0);
  assert.ok((await oldDone).every((result) => result.status === "rejected"));
  assert.equal(newCancellations, 0);
  assert.equal(newResets, 0);
  newCleanup();
  deferred.splice(0).forEach((cleanup) => cleanup());
  assert.equal(newCancellations, 1);
  assert.equal(newResets, 1);
});
