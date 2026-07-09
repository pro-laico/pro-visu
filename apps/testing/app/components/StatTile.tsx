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
            style={{ ["--to" as string]: value }} //TODO: replace `as` cast with proper typing
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
