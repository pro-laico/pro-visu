export interface DeviceFrameCompositeArgs {
  /** Captured site video (mp4). */
  videoPath: string;
  /** Full-frame chrome PNG (device px). */
  framePng: string;
  /** Viewport corner mask PNG. */
  maskPng: string;
  outPath: string;
  frameWidth: number;
  frameHeight: number;
  viewport: { x: number; y: number; w: number; h: number };
  background: string;
  fps: number;
  crf: number;
  durationSeconds: number;
}

/**
 * Build the ffmpeg filtergraph that composites the device frame in a single pass:
 *   backdrop color → opaque window chrome → corner-masked capture in the viewport.
 * Pure (no I/O) so it can be unit-tested.
 */
export function buildDeviceFrameArgs(args: DeviceFrameCompositeArgs): string[] {
  const { viewport: v } = args;
  const filter = [
    `color=c=${args.background}:s=${args.frameWidth}x${args.frameHeight}:r=${args.fps}:d=${args.durationSeconds},format=rgba[bg]`,
    `[2:v]scale=${v.w}:${v.h},format=rgba,alphaextract[ma]`,
    `[0:v]fps=${args.fps},scale=${v.w}:${v.h}:flags=lanczos,format=rgba[vs]`,
    `[vs][ma]alphamerge[vr]`,
    `[bg][1:v]overlay=0:0[wc]`,
    `[wc][vr]overlay=${v.x}:${v.y}:format=auto,format=yuv420p[out]`,
  ].join(";");

  return [
    "-y",
    "-i",
    args.videoPath,
    "-i",
    args.framePng,
    "-i",
    args.maskPng,
    "-filter_complex",
    filter,
    "-map",
    "[out]",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    String(args.crf),
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-an",
    args.outPath,
  ];
}
