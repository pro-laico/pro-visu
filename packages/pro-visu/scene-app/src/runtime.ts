import { loopTime } from "./scenes/wall-motion";

export interface ShowcaseRuntime {
  /** Resolves once every scene video can render/seek. */
  ready(): Promise<void>;
  /** Realtime: start all videos from 0. */
  play(): void;
  pause(): void;
  /** Deterministic: position every video at t seconds and resolve after a paint. */
  seek(t: number): Promise<void>;
  /** Longest input video duration (seconds), for length inference. */
  readonly duration: number;
}

declare global {
  interface Window {
    __showcase?: ShowcaseRuntime;
    __showcaseReady?: boolean;
    /**
     * Optional readiness gate a scene can publish to hold capture until it has actually painted its
     * content (not just until fonts/videos load). The runtime awaits it before flipping
     * `__showcaseReady`, so the first recorded frame is never an un-seeded/blank state.
     */
    __sceneReady?: Promise<void>;
    /**
     * Optional scene timeline hook: render the scene's own animation state for absolute time `t`
     * (seconds). When present, `__showcase.seek(t)` awaits it (deterministic frame-stepping) and
     * `play()` drives it from a rAF wall clock (realtime preview/recording). Scenes whose content
     * is only <video> elements don't need it.
     */
    __sceneSeek?: (t: number) => void | Promise<void>;
  }
}

const nextFrame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()));

function setup(v: HTMLVideoElement): void {
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.pause();
}

function whenLoaded(v: HTMLVideoElement): Promise<void> {
  if (v.readyState >= 2) return Promise.resolve();
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout>;
    const done = (): void => {
      v.removeEventListener("loadeddata", done);
      v.removeEventListener("error", done);
      clearTimeout(timer);
      resolve();
    };
    v.addEventListener("loadeddata", done);
    v.addEventListener("error", done);
    timer = setTimeout(done, 15_000);
    v.load();
  });
}

/** Videos that have delivered at least one REAL `requestVideoFrameCallback` presentation. */
const everPresented = new WeakSet<HTMLVideoElement>();
/** Videos whose last presentation wait ended on the safety net (they aren't presenting). */
const netResolved = new WeakSet<HTMLVideoElement>();

/**
 * Generous budget for a presentation we genuinely expect (a new frame after a seek, or a video's
 * very first paint). It only ever delays things when presentation truly stalls — when rVFC fires
 * the promise resolves immediately — so being generous here is free in the common case. The OLD
 * 250ms net was the black-tile bug: on a cold decoder under parallel-worker CPU load, the first
 * decode+present takes longer than that, the net fired first, and the screenshot caught a black
 * tile at every worker's range start.
 */
const FIRST_PRESENT_NET_MS = 3000;
/** Short budget for videos that have shown they don't present (offscreen/broken) — don't stall every frame on them. */
const NON_PRESENTING_NET_MS = 250;

/**
 * Resolve once the video has actually PRESENTED a frame to the compositor — not merely fired
 * `seeked` (which only means currentTime updated). `requestVideoFrameCallback` fires on the next
 * presented frame; the safety-net timeout is adaptive: full budget while the video is presenting
 * normally, short once a video has demonstrated it doesn't present (so a single offscreen/broken
 * video can't add seconds to every frame).
 */
function presented(v: HTMLVideoElement, expectNewFrame: boolean): Promise<void> {
  //EXCUSE: requestVideoFrameCallback is an optional API absent from this project's DOM lib types
  const rvfc = (v as unknown as { requestVideoFrameCallback?: (cb: () => void) => number }).requestVideoFrameCallback?.bind(v);
  if (!rvfc) return nextFrame();
  if (!expectNewFrame && everPresented.has(v)) return nextFrame();
  return new Promise((resolve) => {
    let done = false;
    const finish = (real: boolean): void => {
      if (done) return;
      done = true;
      if (real) {
        everPresented.add(v);
        netResolved.delete(v);
      } else {
        netResolved.add(v);
      }
      resolve();
    };
    rvfc(() => finish(true));
    setTimeout(() => finish(false), netResolved.has(v) ? NON_PRESENTING_NET_MS : FIRST_PRESENT_NET_MS);
  });
}

function seekTo(v: HTMLVideoElement, t: number): Promise<void> {
  const dur = v.duration;
  const target = Number.isFinite(dur) && dur > 0 ? Math.min(loopTime(t, dur), dur - 1e-3) : t;
  if (Math.abs(v.currentTime - target) < 1e-4 && v.readyState >= 2) {
    return presented(v, false);
  }
  return new Promise((resolve) => {
    const onSeeked = (): void => {
      v.removeEventListener("seeked", onSeeked);
      void presented(v, true).then(resolve);
    };
    v.addEventListener("seeked", onSeeked);
    v.currentTime = target;
  });
}

/** Find the scene's videos and publish window.__showcase. Call after the scene mounts. */
export function initRuntime(): void {
  let videos: HTMLVideoElement[] = [];
  const scan = (): void => {
    videos = Array.from(document.querySelectorAll("video"));
    videos.forEach(setup);
  };
  scan();

  const readyPromise = (async () => {
    await nextFrame();
    scan();
    const fontsReady = document.fonts?.ready ?? Promise.resolve(undefined);
    const read = (): Promise<void> | undefined => window.__sceneReady;
    let sceneReady = read();
    for (let i = 0; !sceneReady && i < 10; i++) {
      await nextFrame();
      sceneReady = read();
    }
    await Promise.all([fontsReady, sceneReady ?? Promise.resolve(), ...videos.map(whenLoaded)]);
    await Promise.all(videos.map((v) => seekTo(v, 0.001)));
    await nextFrame();
  })();
  void readyPromise.then(() => {
    window.__showcaseReady = true;
  });

  // Realtime driver for a scene timeline (__sceneSeek): a rAF wall clock from play() to pause().
  let rafId: number | null = null;

  window.__showcase = {
    ready: () => readyPromise,
    play: () => {
      for (const v of videos) {
        v.currentTime = 0;
        void v.play().catch(() => {});
      }
      const sceneSeek = window.__sceneSeek;
      if (sceneSeek) {
        const t0 = performance.now();
        const tick = (): void => {
          void sceneSeek((performance.now() - t0) / 1000);
          rafId = requestAnimationFrame(tick);
        };
        void sceneSeek(0);
        rafId = requestAnimationFrame(tick);
      }
    },
    pause: () => {
      for (const v of videos) v.pause();
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
    seek: async (t: number) => {
      await Promise.all([...videos.map((v) => seekTo(v, t)), Promise.resolve(window.__sceneSeek?.(t))]);
      await nextFrame();
    },
    get duration() {
      return videos.reduce((m, v) => Math.max(m, Number.isFinite(v.duration) ? v.duration : 0), 0);
    },
  };
}
