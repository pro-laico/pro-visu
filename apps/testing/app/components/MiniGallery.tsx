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
