import { TONES, type Tone } from "@/app/lib/catalog";

interface PlaceholderProps {
  tone: Tone;
  /** CSS aspect-ratio, e.g. "3 / 4" (portrait) or "16 / 9". */
  ratio?: string;
  label?: string;
  className?: string;
  /** When set, a real photo is rendered instead of the tonal placeholder. */
  src?: string;
  alt?: string;
}

/**
 * A tasteful tonal stand-in for art-directed photography. Reads as an intentional
 * brand image now; pass `src` (and drop the file in public/img/) to swap in a real photo.
 */
export function Placeholder({ tone, ratio = "3 / 4", label, className, src, alt }: PlaceholderProps) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={["ph-img", className].filter(Boolean).join(" ")}
        src={src}
        alt={alt ?? ""}
        style={{ aspectRatio: ratio }}
      />
    );
  }

  const t = TONES[tone];
  return (
    <div
      className={["ph", className].filter(Boolean).join(" ")}
      style={{
        aspectRatio: ratio,
        background: `linear-gradient(155deg, ${t.from}, ${t.to})`,
        color: t.ink,
      }}
      aria-hidden="true"
    >
      <span className="ph-mark">FASHION</span>
      {label ? <span className="ph-label">{label}</span> : null}
    </div>
  );
}
