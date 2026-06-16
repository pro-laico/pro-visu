// The in-page capture contract. The Node capture engine drives a scene through this object
// (via page.evaluate). Realtime capture calls ready()+play(); the deterministic frame-stepper
// calls ready() then seek(t) per frame. Kept framework-agnostic: it just operates on the
// <video> elements the scene rendered.

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

const nextFrame = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => resolve()));

function setup(v: HTMLVideoElement): void {
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.pause();
}

function whenLoaded(v: HTMLVideoElement): Promise<void> {
  if (v.readyState >= 2 /* HAVE_CURRENT_DATA */) return Promise.resolve();
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout>;
    const done = (): void => {
      v.removeEventListener("loadeddata", done);
      v.removeEventListener("error", done);
      clearTimeout(timer);
      resolve();
    };
    // Resolve on success OR error (a failed video must not hang readiness), with a hard cap.
    v.addEventListener("loadeddata", done);
    v.addEventListener("error", done);
    timer = setTimeout(done, 15_000);
    v.load();
  });
}

/**
 * Resolve once the video has actually PRESENTED a frame to the compositor — not merely fired
 * `seeked` (which only means currentTime updated). Without this, a screenshot taken right after a
 * seek on a cold context captures a blank/black tile because the decoded frame hasn't painted yet
 * (every parallel frame-worker's first frame hit this). `requestVideoFrameCallback` fires on the
 * next presented frame; fall back to a rAF + timeout where it's unavailable or doesn't fire.
 */
function presented(v: HTMLVideoElement): Promise<void> {
  const rvfc = (
    v as unknown as { requestVideoFrameCallback?: (cb: () => void) => number }
  ).requestVideoFrameCallback?.bind(v);
  if (!rvfc) return nextFrame();
  return new Promise((resolve) => {
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      resolve();
    };
    rvfc(() => finish());
    // Safety net: a paused, already-decoded video may not always schedule the callback promptly.
    setTimeout(finish, 250);
  });
}

function seekTo(v: HTMLVideoElement, t: number): Promise<void> {
  // Loop short videos across a longer clip (e.g. tiles in the media wall) instead of freezing on
  // the last frame. For existing scenes the input reel ≈ the clip length, so t < duration and the
  // wrap is a no-op (t % duration === t) — non-breaking.
  const dur = v.duration;
  const target =
    Number.isFinite(dur) && dur > 0 ? Math.min(loopTime(t, dur), dur - 1e-3) : t;
  // Already at the target: still ensure a frame is presented (a cold context may not have painted).
  if (Math.abs(v.currentTime - target) < 1e-4 && v.readyState >= 2) return presented(v);
  return new Promise((resolve) => {
    const onSeeked = (): void => {
      v.removeEventListener("seeked", onSeeked);
      // Wait for the seeked frame to be presented before resolving, so the screenshot isn't blank.
      void presented(v).then(resolve);
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
    await nextFrame(); // let late-mounted videos attach (and the scene publish __sceneReady)
    scan();
    const fontsReady = document.fonts?.ready ?? Promise.resolve(undefined);
    // A scene can gate capture on its own first paint (e.g. the specimen, which seeds its glyphs
    // asynchronously after the font loads). React's first render may not have run yet when this
    // starts, so poll a few frames for the gate before proceeding without it (absent → no-op).
    const read = (): Promise<void> | undefined =>
      (globalThis as { __sceneReady?: Promise<void> }).__sceneReady;
    let sceneReady = read();
    for (let i = 0; !sceneReady && i < 10; i++) {
      await nextFrame();
      sceneReady = read();
    }
    await Promise.all([fontsReady, sceneReady ?? Promise.resolve(), ...videos.map(whenLoaded)]);
    await nextFrame(); // ensure a first paint
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
      await Promise.all([
        ...videos.map((v) => seekTo(v, t)),
        Promise.resolve(window.__sceneSeek?.(t)),
      ]);
      await nextFrame();
    },
    get duration() {
      return videos.reduce(
        (m, v) => Math.max(m, Number.isFinite(v.duration) ? v.duration : 0),
        0,
      );
    },
  };
}
