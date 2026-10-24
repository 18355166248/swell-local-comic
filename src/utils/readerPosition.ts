export interface ReadingGroupBounds {
  index: number;
  top: number;
  bottom: number;
}

export interface ReadingViewport {
  top: number;
  height: number;
  scrollTop: number;
  scrollHeight: number;
}

export interface ScrollPositionSnapshot {
  position: number;
  height: number;
}

/** Pick the image crossing the reading line, rather than favoring shorter images. */
export function pickReadingGroupIndex(
  groups: ReadingGroupBounds[],
  viewport: ReadingViewport,
  anchorRatio = 0.25,
): number | null {
  const visible = groups.filter((group) =>
    group.bottom > viewport.top && group.top < viewport.top + viewport.height,
  );
  if (visible.length === 0 || viewport.height <= 0) return null;

  const maxScroll = Math.max(0, viewport.scrollHeight - viewport.height);
  if (viewport.scrollTop <= 1) {
    return visible.reduce((first, group) => group.index < first.index ? group : first).index;
  }
  if (maxScroll > 1 && viewport.scrollTop >= maxScroll - 2) {
    return visible.reduce((last, group) => group.index > last.index ? group : last).index;
  }

  const anchor = viewport.top + viewport.height * Math.max(0, Math.min(1, anchorRatio));
  let selected: ReadingGroupBounds | null = null;
  let nearestDistance = Infinity;
  for (const group of visible) {
    const distance = anchor < group.top
      ? group.top - anchor
      : anchor >= group.bottom ? anchor - group.bottom : 0;
    // At a shared edge, prefer the group that begins at the reading line.
    if (distance < nearestDistance || (distance === nearestDistance && group.top <= anchor && (!selected || group.top > selected.top))) {
      selected = group;
      nearestDistance = distance;
    }
  }
  return selected?.index ?? null;
}

/** Capture DOM scroll values immediately, before a debounce or route change. */
export function getScrollPositionSnapshot(container: {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}): ScrollPositionSnapshot {
  const height = Math.max(0, container.scrollHeight - container.clientHeight);
  return { position: Math.max(0, Math.min(container.scrollTop, height)), height };
}

/** Keep the last scroll event available even when its trailing timer is cancelled. */
export function createScrollPositionReporter(report: (snapshot: ScrollPositionSnapshot) => void) {
  let pending: ScrollPositionSnapshot | null = null;
  let reported: ScrollPositionSnapshot | null = null;
  return {
    capture(snapshot: ScrollPositionSnapshot) {
      pending = snapshot;
    },
    flush(): ScrollPositionSnapshot | null {
      const snapshot = pending;
      pending = null;
      if (snapshot && (!reported || snapshot.position !== reported.position || snapshot.height !== reported.height)) {
        reported = snapshot;
        report(snapshot);
      }
      return snapshot;
    },
  };
}

/** A cancelled effect is still pending; only completion or user intent consumes a restore. */
export function createScrollRestorationScheduler(timers = {
  set: (callback: () => void, milliseconds: number) => setTimeout(callback, milliseconds),
  clear: (handle: ReturnType<typeof setTimeout>) => clearTimeout(handle),
}) {
  let completedKey: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let request = 0;
  const stop = () => {
    request++;
    if (timer !== null) timers.clear(timer);
    timer = null;
  };
  return {
    reset() {
      stop();
      completedKey = null;
    },
    cancel(key: string) {
      stop();
      completedKey = key;
    },
    schedule(key: string, restore: () => boolean, onComplete?: () => void) {
      stop();
      if (completedKey === key) return () => {};
      const currentRequest = request;
      let attempts = 0;
      const run = () => {
        if (currentRequest !== request) return;
        timer = null;
        if (restore() || attempts++ >= 20) {
          completedKey = key;
          onComplete?.();
        } else {
          timer = timers.set(run, 100);
        }
      };
      timer = timers.set(run, 100);
      return () => { if (currentRequest === request) stop(); };
    },
  };
}
