import path from "node:path";
import type { ReactElement } from "react";
import { Box, Text, renderToString } from "ink";

import { formatBytes } from "@/utils/format";
import type { AssetOutcome } from "@/pipeline/runner";

/** A flattened summary line — one per produced record, or one per failed asset. */
interface Line {
  key: string;
  glyph: { text: string; color: string };
  name: string;
  /** dimensions / format / size, or the error message for failures. */
  meta: string;
  metaDim: boolean;
}

function toLines(outcomes: AssetOutcome[]): Line[] {
  const lines: Line[] = [];
  for (const o of outcomes) {
    if (o.status === "failed") {
      lines.push({
        key: o.name,
        glyph: { text: "✗", color: "red" },
        name: o.name,
        meta: o.error?.message ?? "failed",
        metaDim: false,
      });
      continue;
    }
    const glyph = o.cached ? { text: "⊙", color: "blue" } : { text: "✓", color: "green" };
    for (const r of o.records) {
      lines.push({
        key: `${o.name}:${r.file}`,
        glyph,
        name: o.name,
        meta: o.cached
          ? `${r.width}×${r.height}  ${r.format}  cached`
          : `${r.width}×${r.height}  ${r.format}  ${formatBytes(r.bytes)}`,
        metaDim: true,
      });
    }
  }
  return lines;
}

function Summary({ outcomes, outDir }: { outcomes: AssetOutcome[]; outDir: string }): ReactElement {
  const lines = toLines(outcomes);
  const nameWidth = Math.min(28, Math.max(4, ...lines.map((l) => l.name.length)));

  const ok = outcomes.filter((o) => o.status === "ok");
  const generated = ok.filter((o) => !o.cached).length;
  const cached = ok.filter((o) => o.cached).length;
  const failed = outcomes.length - ok.length;
  const totalBytes = ok.reduce((sum, o) => sum + o.records.reduce((s, r) => s + r.bytes, 0), 0);

  const totals: { text: string; color?: string }[] = [{ text: `${generated} generated`, color: "green" }];
  if (cached) totals.push({ text: `${cached} cached`, color: "blue" });
  totals.push({ text: `${failed} failed`, color: failed ? "red" : undefined });
  totals.push({ text: formatBytes(totalBytes), color: undefined });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={failed ? "yellow" : "green"} borderDimColor paddingX={1}>
      <Box justifyContent="space-between">
        <Text bold>{failed ? "done with failures" : "done"}</Text>
        <Text dimColor>{outDir}</Text>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        {lines.map((l) => (
          <Box key={l.key}>
            <Box flexShrink={0} marginRight={1}>
              <Text color={l.glyph.color}>{l.glyph.text}</Text>
            </Box>
            <Box flexShrink={0} width={nameWidth} marginRight={1}>
              <Text bold wrap="truncate-end">
                {l.name}
              </Text>
            </Box>
            <Box flexGrow={1}>
              <Text color={l.metaDim ? undefined : "red"} dimColor={l.metaDim} wrap="truncate-end">
                {l.meta}
              </Text>
            </Box>
          </Box>
        ))}
      </Box>
      <Box marginTop={1}>
        {totals.map((c, i) => (
          <Box key={c.text}>
            {i > 0 ? <Text dimColor> · </Text> : null}
            <Text color={c.color}>{c.text}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/** Render the final results panel to a string (static — safe to print after the live dashboard stops). */
export function renderSummary(outcomes: AssetOutcome[], outDir: string, columns = 80): string {
  const display = path.isAbsolute(outDir) ? path.relative(process.cwd(), outDir) || outDir : outDir;
  return renderToString(<Summary outcomes={outcomes} outDir={display} />, {
    columns: Math.max(40, Math.min(columns, 100)),
  });
}
