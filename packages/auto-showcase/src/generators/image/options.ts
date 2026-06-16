import { z } from "zod";

/**
 * Author-facing options for the `image` generator — a passthrough that records an existing image
 * file as an asset so it can feed a scene (e.g. high-resolution photos as media-wall tiles) or be
 * tracked in the manifest. Only `src` is required.
 */
export interface ImageOptions {
  /** Path to the source image (relative to the cwd, or absolute). */
  src: string;
  /** Output filename; defaults to "<slug(asset name)><ext of src>". */
  fileName?: string;
}

export const imageOptionsSchema = z
  .object({
    src: z.string().min(1),
    fileName: z.string().optional(),
  })
  .strict();

export type ResolvedImageOptions = z.infer<typeof imageOptionsSchema>;
