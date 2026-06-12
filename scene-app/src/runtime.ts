// The in-page capture contract. The Node capture engine drives a scene through this object
// (via page.evaluate). Realtime capture calls ready()+play(); the deterministic frame-stepper
// calls ready() then seek(t) per frame. Kept framework-agnostic: it just operates on the
// <video> elements the scene rendered.

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

function seekTo(v: HTMLVideoElement, t: number): Promise<void> {
  const max = Number.isFinite(v.duration) ? Math.max(0, v.duration - 1e-3) : t;
  const target = Math.min(t, max);
  if (Math.abs(v.currentTime - target) < 1e-4 && v.readyState >= 2) return Promise.resolve();
  return new Promise((resolve) => {
    const done = (): void => {
      v.removeEventListener("seeked", done);
      resolve();
    };
    v.addEventListener("seeked", done);
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
    // asynchronously after the font loads). Absent that, this is a no-op.
    const sceneReady = (globalThis as { __sceneReady?: Promise<void> }).__sceneReady ?? Promise.resolve();
    await Promise.all([fontsReady, sceneReady, ...videos.map(whenLoaded)]);
    await nextFrame(); // ensure a first paint
  })();
  void readyPromise.then(() => {
    window.__showcaseReady = true;
  });

  window.__showcase = {
    ready: () => readyPromise,
    play: () => {
      for (const v of videos) {
        v.currentTime = 0;
        void v.play().catch(() => {});
      }
    },
    pause: () => {
      for (const v of videos) v.pause();
    },
    seek: async (t: number) => {
      await Promise.all(videos.map((v) => seekTo(v, t)));
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
