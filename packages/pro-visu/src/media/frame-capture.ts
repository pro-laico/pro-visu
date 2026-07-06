import os from "node:os";
import path from "node:path";
import type { Browser, Page } from "playwright-core";
import { concatMp4, startFrameEncoder } from "@/media/ffmpeg";
import { Semaphore } from "@/utils/concurrency";
import { ensureDir } from "@/utils/fs";
import type { Logger } from "@/utils/logger";

/**
 * Deterministic frame-stepped video capture, shared by every "step a clock and screenshot" path
 * (the `scene` subsystem and site recording). The only per-path differences are two callbacks:
 *   - `prepare`   — runs once per worker context (navigate, wait for readiness/warm-up); returns
 *                   opaque per-page state passed back to `seekToFrame`.
 *   - `seekToFrame` — advance the page to clip-time `t` (seconds) before the screenshot.
 *
 * Everything else (frame timing, parallel workers, supersample-then-encode, lossless concat) is the
 * machine-independent core: frame N is a pure function of `t`, so splitting the range across worker
 * contexts and concatenating is safe. Frames never touch disk — they pipe straight into ffmpeg.
 */
export interface FrameStepArgs<S = unknown> {
  browser: Browser;
  /** Viewport + screenshot size; supersampled by `deviceScaleFactor`, downscaled in ffmpeg. */
  width: number;
  height: number;
  deviceScaleFactor: number;
  fps: number;
  durationSeconds: number;
  crf: number;
  /** Absolute mp4 path to write. */
  outPath: string;
  /** "ultrafast" in draft, "medium" otherwise. */
  preset?: string;
  /** Intermediate frame format; "png" is lossless into the encoder. Default "jpeg". */
  frameFormat?: "jpeg" | "png";
  /** JPEG quality for intermediate frames (perf vs fidelity; ignored for png). */
  jpegQuality?: number;
  /** Parallel render workers (each its own browser context). Default 1. */
  workers?: number;
  /** Scratch dir for per-worker segments. */
  tmpDir: string;
  logger: Logger;
  /** Runs once per worker context (after newContext/newPage). Returns opaque per-page state. */
  prepare: (page: Page, helpers: { logger: Logger }) => Promise<S>;
  /** Advance the page to clip-time `t` (seconds) before the screenshot. */
  seekToFrame: (page: Page, t: number, state: S) => Promise<void>;
  /** Called with fractional progress (0–1) as frames complete (aggregated across workers). */
  onProgress?: (fraction: number) => void;
  /** Cancels the capture: the frame loop stops at the next boundary and the encoder is killed. */
  signal?: AbortSignal;
}

/**
 * Rough per-worker memory footprint: a supersampled Chromium context (its renderer + raster
 * buffers on a warmed page) plus that worker's ffmpeg/x264 encoder. Deliberately conservative —
 * workers only trade wall-clock speed, while overshooting memory swap-thrashes the whole machine.
 */
const WORKER_FOOTPRINT_BYTES = 1.25 * 1024 * 1024 * 1024;

/**
 * Default parallel workers: about half the cores, capped at 6 (each is a browser context) — and
 * bounded by what the machine can actually hold RIGHT NOW. Cores alone routinely over-provisions:
 * a 24-thread machine picks 6 workers even with 3 GB free, and the resulting contexts + encoders
 * exhaust system memory (Node can't see that in its own heap). Workers only affect speed, never
 * output, so scaling down under memory pressure is always safe.
 */
export function autoWorkers(): number {
  const cores = os.cpus()?.length ?? 2;
  const byCores = Math.min(6, Math.floor(cores / 2));
  const byMemory = Math.floor(os.freemem() / WORKER_FOOTPRINT_BYTES);
  return Math.max(1, Math.min(byCores, byMemory));
}

/**
 * Run-wide budget on concurrent render contexts. `autoWorkers()` sizes ONE capture as if it owned
 * the machine, but the pipeline runs `settings.concurrency` assets at once — without a shared cap,
 * two frame-stepped assets each spawn their own full worker set (e.g. 2 × 6 supersampled contexts
 * plus their encoders), which is what exhausts machine memory in practice. Chunks past the budget
 * simply queue for a free slot; frame ranges are independent, so waiting is always deadlock-free.
 * An explicit per-asset `workers` still tiles the frames into that many segments — this only limits
 * how many render at the same instant, not the output.
 */
let contextBudget: Semaphore | null = null;
function acquireContextSlot(): { wait: Promise<void> | null; release: () => void } {
  const budget = (contextBudget ??= new Semaphore(autoWorkers()));
  return {
    wait: budget.tryAcquire() ? null : budget.acquire(),
    release: () => budget.release(),
  };
}

/**
 * Pure: split `totalFrames` into at most `workers` contiguous, non-overlapping [start, end) ranges
 * that exactly tile [0, totalFrames). Unit-tested (the I/O loop around it is exercised elsewhere).
 */
export function planFrames(totalFrames: number, workers: number): Array<{ start: number; end: number }> {
  const w = Math.max(1, Math.min(workers, totalFrames));
  const chunk = Math.ceil(totalFrames / w);
  const ranges: Array<{ start: number; end: number }> = [];
  for (let i = 0; i < w; i++) {
    const start = i * chunk;
    const end = Math.min(totalFrames, start + chunk);
    if (start >= end) break;
    ranges.push({ start, end });
  }
  return ranges;
}

interface ChunkArgs<S> {
  browser: Browser;
  width: number;
  height: number;
  deviceScaleFactor: number;
  fps: number;
  crf: number;
  preset?: string;
  frameFormat: "jpeg" | "png";
  jpegQuality: number;
  /** x264 thread cap for THIS chunk's encoder (parallel encoders share the cores). */
  encoderThreads?: number;
  /** Seconds advanced per frame (duration / totalFrames) — see captureFramedVideo. */
  timeStep: number;
  /** Inclusive start frame, exclusive end frame. */
  frameStart: number;
  frameEnd: number;
  outPath: string;
  logger: Logger;
  prepare: (page: Page, helpers: { logger: Logger }) => Promise<S>;
  seekToFrame: (page: Page, t: number, state: S) => Promise<void>;
  /** Called once per encoded frame (for aggregated progress). */
  onFrame?: () => void;
  signal?: AbortSignal;
}

/** Render a contiguous frame range in its own browser context, encoding to one mp4 segment. */
async function renderChunk<S>(a: ChunkArgs<S>): Promise<void> {
  // Respect the run-wide context budget BEFORE creating the (supersampled, warmed) context.
  const slot = acquireContextSlot();
  if (slot.wait) {
    a.logger.debug("waiting for a free render slot (run-wide context budget)");
    await slot.wait;
  }
  try {
    a.signal?.throwIfAborted(); // the run may have been cancelled while queued for a slot
    const context = await a.browser.newContext({
      viewport: { width: a.width, height: a.height },
      deviceScaleFactor: a.deviceScaleFactor,
    });
    const page = await context.newPage();
    page.on("console", (m) => a.logger.debug(`[capture] ${m.text()}`));
    page.on("pageerror", (e) => a.logger.debug(`[capture error] ${e.message}`));

    try {
      const state = await a.prepare(page, { logger: a.logger });
      a.signal?.throwIfAborted(); // bail before spawning the encoder if we were cancelled during prepare

      const encoder = startFrameEncoder(
        {
          fps: a.fps,
          width: a.width,
          height: a.height,
          crf: a.crf,
          outPath: a.outPath,
          preset: a.preset,
          inputFormat: a.frameFormat,
          threads: a.encoderThreads,
        },
        a.logger,
        a.signal,
      );
      let finished = false;
      try {
        // Playwright rejects `quality` for png screenshots, so only pass it on the jpeg path.
        const shotOptions =
          a.frameFormat === "png"
            ? ({ type: "png" } as const)
            : ({ type: "jpeg", quality: a.jpegQuality } as const);
        for (let frame = a.frameStart; frame < a.frameEnd; frame++) {
          a.signal?.throwIfAborted(); // a cancelled run stops here, not after every frame is rendered
          const t = frame * a.timeStep;
          await a.seekToFrame(page, t, state);
          const buf = await page.screenshot(shotOptions);
          await encoder.write(buf);
          a.onFrame?.();
        }
        await encoder.done();
        finished = true;
      } finally {
        // A throw mid-loop (nav flake, screenshot timeout) must not leave the encoder blocked on
        // its stdin pipe forever — the pipeline isolates asset failures, so orphans would pile up.
        if (!finished) encoder.kill();
      }
    } finally {
      await context.close();
    }
  } finally {
    slot.release();
  }
}

/**
 * Step each frame to its exact time via `seekToFrame`, screenshot, and pipe straight into ffmpeg —
 * frame-accurate and machine-independent, no frames touch disk. With `workers > 1`, the frame range is
 * split into contiguous segments rendered in parallel contexts, then losslessly concatenated (the
 * determinism is what makes this safe).
 */
export async function captureFramedVideo<S>(args: FrameStepArgs<S>): Promise<void> {
  await ensureDir(path.dirname(args.outPath));
  const totalFrames = Math.max(1, Math.round(args.durationSeconds * args.fps));
  // Step time as duration/totalFrames (≈ 1/fps) so the N frames evenly tile [0, duration). The frame
  // that would sit at t=duration is the loop point — which equals t=0 for a seamless clip — so omitting
  // it (we render 0..N-1) makes the last→first wrap exactly one step: no seam hitch.
  const timeStep = args.durationSeconds / totalFrames;
  const frameFormat = args.frameFormat ?? "jpeg";
  const jpegQuality = args.jpegQuality ?? 90;
  const ranges = planFrames(totalFrames, Math.max(1, args.workers ?? 1));
  // Parallel encoders split the cores between them — x264's default (~1.5× cores PER encoder)
  // would otherwise oversubscribe threads and their per-thread buffers `ranges.length` times over.
  const encoderThreads =
    ranges.length > 1
      ? Math.max(2, Math.floor((os.cpus()?.length ?? 2) / ranges.length))
      : undefined;
  // Aggregate frame completions across parallel workers into a single 0–1 fraction.
  let completed = 0;
  const onFrame = args.onProgress
    ? () => {
        completed += 1;
        args.onProgress?.(completed / totalFrames);
      }
    : undefined;
  const common = {
    browser: args.browser,
    width: args.width,
    height: args.height,
    deviceScaleFactor: args.deviceScaleFactor,
    fps: args.fps,
    crf: args.crf,
    preset: args.preset,
    frameFormat,
    jpegQuality,
    encoderThreads,
    timeStep,
    logger: args.logger,
    prepare: args.prepare,
    seekToFrame: args.seekToFrame,
    onFrame,
    signal: args.signal,
  };

  if (ranges.length === 1) {
    args.logger.debug(`stepping ${totalFrames} frames @ ${args.fps}fps`);
    await renderChunk({ ...common, frameStart: 0, frameEnd: totalFrames, outPath: args.outPath });
    return;
  }

  const segs = ranges.map((r, i) => ({
    ...r,
    seg: path.join(args.tmpDir, `seg-${i}-${path.basename(args.outPath)}`),
  }));
  args.logger.debug(`stepping ${totalFrames} frames across ${segs.length} workers`);
  // One failed chunk fails the whole capture, so stop the sibling chunks at their next frame
  // boundary instead of letting them render segments that will be thrown away (they'd keep
  // burning contexts/CPU concurrently with the next scheduled assets). The internal controller
  // also mirrors the caller's signal so an external cancel still reaches every chunk.
  const outer = args.signal;
  const chunkAbort = new AbortController();
  const onOuterAbort = (): void => chunkAbort.abort(outer?.reason);
  if (outer?.aborted) chunkAbort.abort(outer.reason);
  else outer?.addEventListener("abort", onOuterAbort, { once: true });
  try {
    await Promise.all(
      segs.map((r) =>
        renderChunk({
          ...common,
          frameStart: r.start,
          frameEnd: r.end,
          outPath: r.seg,
          signal: chunkAbort.signal,
        }).catch((err) => {
          chunkAbort.abort();
          throw err; // rejects first, so Promise.all surfaces the real error, not a sibling's abort
        }),
      ),
    );
  } finally {
    outer?.removeEventListener("abort", onOuterAbort);
  }
  await concatMp4(
    segs.map((r) => r.seg),
    args.outPath,
    args.logger,
    args.signal,
  );
}
