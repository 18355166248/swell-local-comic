import type { ComicFile } from "../types";

export type ReaderImageState = "idle" | "loading" | "ready" | "error";
export interface ReaderImageSize { width: number; height: number }
export interface ReaderImageResource { url: string; size: ReaderImageSize }

export class StaleReaderImageRequest extends Error {
  constructor() { super("Reader image request belongs to an inactive session"); }
}

/** Preserve a replayed owner, but always release an owner replaced during refresh. */
export function createReaderResourceLifecycle(defer: (cleanup: () => void) => void = queueMicrotask) {
  type Owner = { reset: () => unknown };
  let current: { owner: Owner; lease: number } | null = null;
  let nextLease = 0;
  return {
    mount(owner: Owner, onFinalUnmount: () => void) {
      const lease = ++nextLease;
      current = { owner, lease };
      return () => defer(() => {
        if (current?.lease === lease) {
          current = null;
          onFinalUnmount();
          owner.reset();
        } else if (current?.owner !== owner) {
          // Fast Refresh may replay effects after replacing a memoized owner.
          // Its queue is independent of the new owner's active requests.
          owner.reset();
        }
      });
    },
  };
}

interface Entry {
  state: ReaderImageState;
  resource?: ReaderImageResource;
  promise: Promise<ReaderImageResource>;
  resolve: (resource: ReaderImageResource) => void;
  reject: (error: unknown) => void;
  file: ComicFile;
}

/** A single owner for reader URLs, with bounded I/O and invalidatable sessions. */
export function createReaderImageResources(
  load: (file: ComicFile) => Promise<ReaderImageResource>,
  release: (url: string) => void,
  concurrency = 3,
) {
  const entries = new Map<string, Entry>();
  let queue: Entry[] = [];
  let active = 0;
  let generation = 0;

  const discard = (entry: Entry) => {
    if (entry.resource) release(entry.resource.url);
    if (entry.state === "loading") entry.reject(new StaleReaderImageRequest());
  };
  const pump = () => {
    while (active < Math.max(1, concurrency) && queue.length) {
      const entry = queue.shift()!;
      if (entries.get(entry.file.path) !== entry) continue;
      active++;
      void Promise.resolve().then(() => {
        if (entries.get(entry.file.path) !== entry) throw new StaleReaderImageRequest();
        return load(entry.file);
      }).then((resource) => {
        if (entries.get(entry.file.path) !== entry) {
          release(resource.url);
          entry.reject(new StaleReaderImageRequest());
          return;
        }
        entry.state = "ready";
        entry.resource = resource;
        entry.resolve(resource);
      }, (error: unknown) => {
        if (entries.get(entry.file.path) === entry) entry.state = "error";
        entry.reject(error);
      }).finally(() => {
        active--;
        pump();
      });
    }
  };

  const reset = (preservePaths: string[] = []) => {
    generation++;
    const preserved = new Set(preservePaths);
    for (const [path, entry] of entries) {
      if (preserved.has(path) && entry.state === "ready") continue;
      entries.delete(path);
      discard(entry);
    }
    queue = [];
    return generation;
  };

  return {
    get generation() { return generation; },
    get(path: string) { return entries.get(path)?.resource; },
    reset,
    retain(paths: string[]) {
      const wanted = new Set(paths);
      for (const [path, entry] of entries) {
        if (wanted.has(path)) continue;
        entries.delete(path);
        discard(entry);
      }
    },
    remove(path: string) {
      const entry = entries.get(path);
      if (!entry) return;
      entries.delete(path);
      discard(entry);
    },
    prioritize(paths: string[]) {
      const priority = new Map(paths.map((path, index) => [path, index]));
      queue.sort((a, b) => (priority.get(a.file.path) ?? Infinity) - (priority.get(b.file.path) ?? Infinity));
      pump();
    },
    load(file: ComicFile): Promise<ReaderImageResource> {
      const existing = entries.get(file.path);
      if (existing && existing.state !== "error") return existing.promise;
      let resolve!: Entry["resolve"];
      let reject!: Entry["reject"];
      const promise = new Promise<ReaderImageResource>((onResolve, onReject) => { resolve = onResolve; reject = onReject; });
      const entry: Entry = { file, state: "loading", promise, resolve, reject };
      entries.set(file.path, entry);
      queue.push(entry);
      pump();
      return promise;
    },
    snapshot(files: ComicFile[]) {
      return {
        urls: files.map((file) => entries.get(file.path)?.resource?.url ?? ""),
        states: files.map((file) => entries.get(file.path)?.state ?? "idle"),
        sizes: files.map((file) => entries.get(file.path)?.resource?.size ?? null),
      };
    },
  };
}

/** Start the restored/current page and neighbors before scanning the remaining chapter. */
export function getReaderImageLoadOrder(total: number, target: number): number[] {
  if (total <= 0) return [];
  const index = Math.max(0, Math.min(total - 1, target));
  return [...new Set([index, index + 1, index - 1, ...Array.from({ length: total }, (_, page) => page)])]
    .filter((page) => page >= 0 && page < total);
}
