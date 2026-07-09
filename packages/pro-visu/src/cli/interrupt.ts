import readline from "node:readline";

export interface InterruptWatch {
  /** Tear down listeners and restore the terminal. */
  dispose: () => void;
  /** Fire a stop request programmatically (1st → onStop, 2nd → onForce). The live dashboard,
   *  which owns the keyboard itself, calls this from its own Esc/Ctrl+C handler. */
  trigger: () => void;
}

/**
 * Watch for a stop request — Esc or Ctrl+C on a TTY, plus SIGINT/SIGTERM. The first request calls
 * `onStop()` (graceful: finish in-flight, then tear down); a second calls `onForce()` (bail now).
 *
 * Set `keyboard: false` to watch only signals and leave the keyboard alone — used when the live
 * dashboard owns input (Ink raw mode): it calls the returned `trigger` so there's a single keypress
 * owner. (Enabling raw mode here ourselves would also suppress the terminal's Ctrl+C → SIGINT, which
 * is why on the keyboard path we detect Ctrl+C as a keypress.)
 */
export function watchForInterrupt(
  onStop: () => void,
  onForce: () => void,
  opts: { keyboard?: boolean } = {},
): InterruptWatch {
  const keyboard = opts.keyboard ?? true;
  let count = 0;
  const trigger = (): void => {
    count += 1;
    if (count === 1) onStop();
    else onForce();
  };

  const stdin = process.stdin;
  const useKeys = keyboard && Boolean(stdin.isTTY);
  let onKey: ((str: string, key: readline.Key) => void) | undefined;

  if (useKeys) {
    readline.emitKeypressEvents(stdin);
    try {
      stdin.setRawMode(true);
    } catch {}
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

  const dispose = (): void => {
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
    if (useKeys && onKey) {
      stdin.off("keypress", onKey);
      try {
        stdin.setRawMode(false);
      } catch {}
      stdin.pause();
    }
  };

  return { dispose, trigger };
}
