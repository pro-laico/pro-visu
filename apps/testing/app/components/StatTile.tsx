// A brand proof-point tile — a big figure with a unit + caption. Reusable on the lookbook,
// the About "by the numbers" band, PDP, footer trust strips, and email modules. When `animate`
// is set on a numeric value it counts up via a pure-CSS @property counter (no JS state), so it
// records cleanly and loops seamlessly when captured as a media-wall tile.

interface StatTileProps {
  /** The headline figure. A number + `animate` enables the count-up; strings render as-is. */
  value: number | string;
  /** Short unit/word beside the figure, e.g. "Years". */
  unit?: string;
  /** Eyebrow label above the figure, e.g. "The House". */
  label?: string;
  /** Caption line below, e.g. "Considered since 1994". */
  caption?: string;
  /** Count up to `value` (numbers only). */
  animate?: boolean;
}

export function StatTile({ value, unit, label, caption, animate = false }: StatTileProps) {
  const isCount = animate && typeof value === "number";
  return (
    <div className="stat-tile">
      {label ? <span className="stat-tile-label eyebrow">{label}</span> : null}
      <p className="stat-figure">
        {isCount ? (
          <span
            className="stat-count"
            // `--to` is the count-up target read by the @property keyframe in globals.css.
            style={{ ["--to" as string]: value }}
            role="img"
            aria-label={`${value}${unit ? ` ${unit}` : ""}`}
          />
        ) : (
          <span>{value}</span>
        )}
        {unit ? <span className="stat-unit">{unit}</span> : null}
      </p>
      {caption ? <span className="stat-caption">{caption}</span> : null}
    </div>
  );
}
