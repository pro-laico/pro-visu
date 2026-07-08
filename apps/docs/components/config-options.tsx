import type { ReactNode } from "react";

/**
 * Display for config options — name, type, default, description, and a collapsible drill-in
 * for nested options. Recurses with no depth limit (a nested option that itself has options just
 * keeps nesting). Native `<details>`-based — no client JS, server-renderable, accessible.
 *
 * For a field that is an array of *unique* object shapes (a discriminated union, e.g. an
 * interaction's `actions: Action[]`, where the `do` value picks the shape), set `variants` instead
 * of `options`: each variant renders as its own collapsible group showing only its fields, so the
 * shapes don't collapse into one jumbled field list. Set `variantKey` to the discriminant field
 * name (e.g. `"do"`) and each variant chip reads `do: "click"`.
 *
 * Pass the options as a plain array; in MDX define it with `export const options = [...]` and render
 * `<ConfigOptions items={options} />`. Keep every field a plain string literal (no JSX) — the
 * `.md` / llms.txt export evaluates the array at build time to emit a markdown table
 * (see `lib/llm-markdown.ts`).
 */
export interface ConfigOption {
  name: string;
  type?: string;
  default?: string;
  required?: boolean;
  description?: ReactNode;
  options?: ConfigOption[];
  /** Distinct object shapes for an array-of-union field (e.g. `Action[]`). Mutually exclusive with `options`. */
  variants?: ConfigVariant[];
  /** Discriminant field name that selects the variant (e.g. `"do"`). Chips then read `do: "click"`. */
  variantKey?: string;
}

/** One shape of an array-of-union field — its discriminant value plus the fields that shape carries. */
export interface ConfigVariant {
  /** The discriminant value / shape label, e.g. `"click"`. */
  name: string;
  /** Short gloss of what this shape does. */
  description?: ReactNode;
  /** Fields this shape carries. */
  options: ConfigOption[];
}

export interface ConfigOptionsProps {
  items: ConfigOption[];
}

// A single fixed surface, a touch off the page background (mixed slightly toward the text colour so
// it lifts subtly in both light and dark). Same shade at every level.
const SURFACE = "color-mix(in oklab, var(--color-fd-background), var(--color-fd-foreground) 4%)";

const Name = ({ o }: { o: ConfigOption }) => <code className="font-semibold text-fd-foreground">{o.name}</code>;

const Type = ({ o }: { o: ConfigOption }) => (o.type ? <code className="text-[0.85em] text-fd-muted-foreground">{o.type}</code> : null);

const Default = ({ o }: { o: ConfigOption }) =>
  o.default !== undefined ? (
    <span className="text-[0.85em] text-fd-muted-foreground">
      default <code className="rounded bg-fd-muted px-1 py-0.5 text-fd-foreground">{o.default}</code>
    </span>
  ) : null;

const Required = ({ o }: { o: ConfigOption }) =>
  o.required ? <span className="text-[0.7em] font-medium uppercase tracking-wide text-fd-primary">required</span> : null;

const Chevron = () => (
  <svg
    className="size-4 shrink-0 text-fd-muted-foreground transition-transform duration-200 group-open:rotate-90"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const Meta = ({ o }: { o: ConfigOption }) => (
  <>
    <Name o={o} />
    <Type o={o} />
    <Required o={o} />
    <span className="sm:ml-auto">
      <Default o={o} />
    </span>
  </>
);

const metaRow = "flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 [overflow-wrap:anywhere]";
const summaryRow = "flex cursor-pointer list-none items-start gap-2 px-3 py-2 hover:bg-fd-foreground/5";
const panel = "not-prose divide-y divide-fd-border overflow-hidden rounded-lg border border-fd-border";

// The discriminant chip for a variant, e.g. `do: "click"` (or just `click` when there's no key).
const VariantChip = ({ name, variantKey }: { name: string; variantKey?: string }) => (
  <code className="font-semibold text-fd-foreground">
    {variantKey ? (
      <>
        <span className="font-normal text-fd-muted-foreground">{variantKey}: </span>
        {`"${name}"`}
      </>
    ) : (
      name
    )}
  </code>
);

// The variant shapes of an array-of-union field: one collapsible group each, showing only its fields.
function Variants({ variants, variantKey }: { variants: ConfigVariant[]; variantKey?: string }) {
  return (
    <div className={panel} style={{ backgroundColor: SURFACE }}>
      {variants.map((v) => (
        <details key={v.name} className="group">
          <summary className={summaryRow}>
            <span className="mt-0.5 shrink-0">
              <Chevron />
            </span>
            <span className={`flex-1 ${metaRow}`}>
              <VariantChip name={v.name} variantKey={variantKey} />
              {v.description ? <span className="text-[0.85em] text-fd-muted-foreground">{v.description}</span> : null}
            </span>
          </summary>
          <div className="px-3 pb-3 pl-6 sm:pl-9">
            <Options items={v.options} />
          </div>
        </details>
      ))}
    </div>
  );
}

function Options({ items }: { items: ConfigOption[] }) {
  return (
    <div className={panel} style={{ backgroundColor: SURFACE }}>
      {items.map((o) =>
        o.variants?.length ? (
          <details key={o.name} className="group">
            <summary className={summaryRow}>
              <span className="mt-0.5 shrink-0">
                <Chevron />
              </span>
              <span className={`flex-1 ${metaRow}`}>
                <Meta o={o} />
              </span>
            </summary>
            <div className="px-3 pb-3 pl-6 sm:pl-9">
              {o.description ? <p className="mb-3 text-sm text-fd-muted-foreground">{o.description}</p> : null}
              <p className="mb-2 text-[0.7em] font-medium uppercase tracking-wide text-fd-muted-foreground">
                Each item is one of these shapes
                {o.variantKey ? (
                  <>
                    {" "}
                    (its <code className="normal-case">{o.variantKey}</code> picks which)
                  </>
                ) : null}
                :
              </p>
              <Variants variants={o.variants} variantKey={o.variantKey} />
            </div>
          </details>
        ) : o.options?.length ? (
          <details key={o.name} className="group">
            <summary className={summaryRow}>
              <span className="mt-0.5 shrink-0">
                <Chevron />
              </span>
              <span className={`flex-1 ${metaRow}`}>
                <Meta o={o} />
              </span>
            </summary>
            <div className="px-3 pb-3 pl-6 sm:pl-9">
              {o.description ? <p className="mb-3 text-sm text-fd-muted-foreground">{o.description}</p> : null}
              <Options items={o.options} />
            </div>
          </details>
        ) : (
          <div key={o.name} className="px-3 py-2 pl-9">
            <div className={metaRow}>
              <Meta o={o} />
            </div>
            {o.description ? <p className="mt-1 text-sm text-fd-muted-foreground">{o.description}</p> : null}
          </div>
        ),
      )}
    </div>
  );
}

export function ConfigOptions({ items }: ConfigOptionsProps) {
  return <Options items={items} />;
}
