/** Coalesce frequent updates, but flush the previous item before switching keys. */
export function createBufferedWriter<T>(
  write: (value: T) => void,
  delay = 250,
  timers = {
    set: (callback: () => void, milliseconds: number) => setTimeout(callback, milliseconds),
    clear: (handle: ReturnType<typeof setTimeout>) => clearTimeout(handle),
  },
) {
  let pending: { key: string; value: T } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer !== null) timers.clear(timer);
    timer = null;
    const entry = pending;
    pending = null;
    if (entry) write(entry.value);
  };

  const schedule = (key: string, value: T) => {
    if (pending && pending.key !== key) flush();
    pending = { key, value };
    // A fixed interval also persists progress during continuous scrolling/zooming.
    if (timer === null) timer = timers.set(flush, delay);
  };

  return { schedule, flush };
}
