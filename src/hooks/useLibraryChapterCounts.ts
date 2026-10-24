import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LibraryItem } from "../types";
import { scanComicLibrary } from "../utils/fileUtils";

export interface LibraryChapterCount {
  status: "loading" | "ready" | "error";
  count?: number;
  error?: string;
}

interface ScanTask {
  id: string;
  rootPath: string;
  status: "queued" | "running" | "settled";
  result?: LibraryChapterCount;
}

interface CountSnapshot extends LibraryChapterCount {
  rootPath: string;
}

const MAX_CONCURRENT_SCANS = 2;
const taskKey = (id: string, rootPath: string) => `${id}\0${rootPath}`;

/** Scan each work once per mounted library, sharing tasks across StrictMode effects. */
export function useLibraryChapterCounts(items: LibraryItem[]) {
  const [snapshots, setSnapshots] = useState<Record<string, CountSnapshot>>({});
  const activeRoots = useRef(new Map<string, string>());
  const tasks = useRef(new Map<string, ScanTask>());
  const inFlight = useRef(new Map<string, Promise<void>>());
  const mounted = useRef(false);

  const publish = useCallback((task: ScanTask, result: LibraryChapterCount) => {
    task.status = "settled";
    task.result = result;
    if (!mounted.current || activeRoots.current.get(task.id) !== task.rootPath || tasks.current.get(taskKey(task.id, task.rootPath)) !== task) return;
    setSnapshots((current) => {
      if (!mounted.current || activeRoots.current.get(task.id) !== task.rootPath || tasks.current.get(taskKey(task.id, task.rootPath)) !== task) return current;
      const previous = current[task.id];
      if (previous?.rootPath === task.rootPath && previous.status === result.status && previous.count === result.count && previous.error === result.error) return current;
      return { ...current, [task.id]: { rootPath: task.rootPath, ...result } };
    });
  }, []);

  const pump = useCallback(function runPendingScans() {
    if (!mounted.current) return;
    for (const [id, rootPath] of activeRoots.current) {
      if (inFlight.current.size >= MAX_CONCURRENT_SCANS) break;
      const key = taskKey(id, rootPath);
      const task = tasks.current.get(key);
      if (!task || task.status !== "queued") continue;
      task.status = "running";

      // Start in a microtask so the promise is registered before StrictMode replays effects.
      const promise = Promise.resolve()
        .then(() => scanComicLibrary(rootPath))
        .then((scan) => publish(task, { status: "ready", count: scan.chapters.length }))
        .catch((scanError: unknown) => {
          const message = scanError instanceof Error ? scanError.message : typeof scanError === "string" ? scanError : "目录暂时无法访问，请重试。";
          publish(task, { status: "error", error: message || "目录暂时无法访问，请重试。" });
        });
      inFlight.current.set(key, promise);
      void promise.finally(() => {
        inFlight.current.delete(key);
        runPendingScans();
      });
    }
  }, [publish]);

  useEffect(() => {
    mounted.current = true;
    activeRoots.current = new Map(items.map((item) => [item.id, item.rootPath]));
    for (const item of items) {
      const key = taskKey(item.id, item.rootPath);
      const cached = tasks.current.get(key);
      if (!cached) tasks.current.set(key, { id: item.id, rootPath: item.rootPath, status: "queued" });
      else if (cached.result) {
        const result = cached.result;
        // An item removed while a scan finished may be added again in this same session.
        void Promise.resolve().then(() => publish(cached, result));
      }
    }
    pump();
    return () => { mounted.current = false; };
  }, [items, pump, publish]);

  const retry = useCallback((id: string) => {
    const rootPath = activeRoots.current.get(id);
    if (!rootPath || !mounted.current) return;
    const key = taskKey(id, rootPath);
    const previous = tasks.current.get(key);
    if (previous?.status === "running" || previous?.status === "queued") return;
    tasks.current.set(key, { id, rootPath, status: "queued" });
    setSnapshots((current) => ({ ...current, [id]: { rootPath, status: "loading" } }));
    pump();
  }, [pump]);

  const counts = useMemo<Record<string, LibraryChapterCount>>(() => Object.fromEntries(items.map((item) => {
    const snapshot = snapshots[item.id];
    const state: LibraryChapterCount = snapshot?.rootPath === item.rootPath
      ? { status: snapshot.status, count: snapshot.count, error: snapshot.error }
      : { status: "loading" };
    return [item.id, state];
  })), [items, snapshots]);

  return { counts, retry };
}
