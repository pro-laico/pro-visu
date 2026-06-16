// A living product gallery: three framings of the same photo (top / center / bottom) crossfading on
// a pure-CSS 4s loop — an ambient "multiple views" hero. Replaces the PDP's placeholder thumbnails
// with something real, and (because it self-loops in 4s, which divides the 16s wall) makes a clean
// animated media-wall tile. CSS-only so it bakes into a capture with no JS state.

interface MiniGalleryProps {
  src: string;
  alt: string;
  /** CSS aspect-ratio for the frame. Default 3 / 4 (tile-friendly). */
  ratio?: string;
}

const VIEWS = ["50% 18%", "50% 50%", "50% 82%"];

export function MiniGallery({ src, alt, ratio = "3 / 4" }: MiniGalleryProps) {
  return (
    <div className="mini-gallery" style={{ aspectRatio: ratio }} aria-label={alt}>
      {VIEWS.map((pos, i) => (
        <img
          // eslint-disable-next-line @next/next/no-img-element
          key={pos}
          className={`mg-frame mg-${i + 1}`}
          src={src}
          alt={i === 0 ? alt : ""}
          aria-hidden={i !== 0}
          style={{ objectPosition: pos }}
        />
      ))}
    </div>
  );
}
