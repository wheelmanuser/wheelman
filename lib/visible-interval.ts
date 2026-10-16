type VisibilityDocument = Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;

// Calls `callback` every `intervalMs` while the page is visible. It stops while hidden and, when the page
// becomes visible again, calls `callback` immediately and restarts the interval. Returns a cleanup function.
export function startVisibleInterval(
  doc: VisibilityDocument,
  callback: () => void,
  intervalMs: number,
): () => void {
  let timer: ReturnType<typeof setInterval> | null = null;

  const stop = () => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
  const start = () => {
    stop();
    timer = setInterval(callback, intervalMs);
  };
  const onVisibilityChange = () => {
    if (doc.visibilityState === "visible") {
      callback();
      start();
    } else {
      stop();
    }
  };

  if (doc.visibilityState === "visible") start();
  doc.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    doc.removeEventListener("visibilitychange", onVisibilityChange);
    stop();
  };
}
