import { z } from "zod";
import { scrollReelOptionsSchema } from "@/generators/scroll-reel/options";

/**
 * Device-frame reuses the scroll-reel capture options (it records the site the same way),
 * then adds the framing controls. The captured video is composited into a browser mockup.
 */
export const deviceFrameOptionsSchema = scrollReelOptionsSchema
  .extend({
    /** Backdrop color behind the browser mockup. */
    background: z.string().default("#0b0b0f"),
    /** Width of the framed viewport inside the render canvas (px). */
    frameWidth: z.number().int().positive().default(1280),
  })
  .strict();

export type DeviceFrameOptions = z.input<typeof deviceFrameOptionsSchema>;
export type ResolvedDeviceFrameOptions = z.infer<typeof deviceFrameOptionsSchema>;
