import readline from "node:readline";

/**
 * Watch for a stop request — Esc or Ctrl+C on a TTY, plus SIGINT/SIGTERM as a fallback.
 * The first request calls `onStop()` (graceful: finish in-flight, then tear down); a second
 * request calls `onForce()` (bail now). Returns a disposer that restores the terminal.
 *
 * Note: enabling raw mode is what lets us read Esc, but it also suppresses the terminal's own
 * Ctrl+C → SIGINT, so we detect Ctrl+C as a keypress instead.
 */
export function watchForInterrupt(onStop: () => void, onForce: () => void): () => void {
  let count = 0;
  const trigger = (): void => {
    count += 1;
    if (count === 1) onStop();
    else onForce();
  };

  const stdin = process.stdin;
  const tty = Boolean(stdin.isTTY);
  let onKey: ((str: string, key: readline.Key) => void) | undefined;

  if (tty) {
    readline.emitKeypressEvents(stdin);
    try {
      stdin.setRawMode(true);
    } catch {
      /* some pseudo-TTYs reject raw mode — fall back to signals only */
    }
    onKey = (_str, key) => {
      if (!key) return;
      if (key.name === "escape" || (key.ctrl && key.name === "c")) trigger();
    };
    stdin.on("keypress", onKey);
    stdin.resume();
  }

  const onSignal = (): void => trigger();
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  return () => {
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
    if (tty && onKey) {
      stdin.off("keypress", onKey);
      try {
        stdin.setRawMode(false);
      } catch {
        /* ignore */
      }
      stdin.pause();
    }
  };
}
