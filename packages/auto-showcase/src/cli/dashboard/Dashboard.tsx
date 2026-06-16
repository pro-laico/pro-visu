import { useEffect, useState, useSyncExternalStore, type ReactElement } from "react";
import { Box, Static, Text, useInput, useStdin, useWindowSize } from "ink";
import type { DashboardStore } from "./store";
import { buildView, type DashboardVM, type RowVM, type TallyCell } from "./view-model";

/** Spinner / progress animation cadence. */
const TICK_MS = 90;
/** Don't let the dashboard box grow wider than this even on very wide terminals. */
const MAX_WIDTH = 100;

function Row({ row, vm }: { row: RowVM; vm: DashboardVM }): ReactElement {
  // Fixed columns are flexShrink={0} so only the step (flexGrow) absorbs overflow and truncates —
  // otherwise Ink's flexbox shrinks the name/detail columns under a long step and they misalign.
  return (
    <Box paddingLeft={1}>
      <Box flexShrink={0} marginRight={1}>
        <Text color={row.glyph.color} dimColor={row.glyph.dim}>
          {row.glyph.text}
        </Text>
      </Box>
      <Box flexShrink={0} width={vm.nameWidth} marginRight={1}>
        <Text bold wrap="truncate-end">
          {row.name}
        </Text>
      </Box>
      {vm.showDetail ? (
        <Box flexShrink={0} width={vm.detailWidth} marginRight={1}>
          <Text dimColor wrap="truncate-end">
            {row.detail}
          </Text>
        </Box>
      ) : null}
      {vm.showProgress ? (
        <Box flexShrink={0} marginRight={1}>
          <Text color={row.progress.color} dimColor={row.progress.dim}>
            {row.progress.text}
          </Text>
        </Box>
      ) : null}
      <Box flexGrow={1} flexShrink={1}>
        <Text color={row.step.color} dimColor={row.step.dim} wrap="truncate-end">
          {row.step.text}
        </Text>
      </Box>
      {row.elapsed ? (
        <Box flexShrink={0} marginLeft={1}>
          <Text dimColor>{row.elapsed}</Text>
        </Box>
      ) : null}
    </Box>
  );
}

function Tally({ cells }: { cells: TallyCell[] }): ReactElement {
  return (
    <Box>
      {cells.map((c, i) => (
        <Box key={c.text}>
          {i > 0 ? <Text dimColor> · </Text> : null}
          <Text color={c.color}>{c.text}</Text>
        </Box>
      ))}
    </Box>
  );
}

function Section({
  label,
  rows,
  vm,
  tally,
}: {
  label: string;
  rows: RowVM[];
  vm: DashboardVM;
  tally?: TallyCell[];
}): ReactElement {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box justifyContent="space-between">
        <Text bold dimColor>
          {label}
        </Text>
        {tally && tally.length > 0 ? <Tally cells={tally} /> : null}
      </Box>
      {rows.map((r) => (
        <Row key={r.id} row={r} vm={vm} />
      ))}
    </Box>
  );
}

function Header({ vm }: { vm: DashboardVM }): ReactElement {
  const { done, total, cached } = vm.overall;
  return (
    <Box justifyContent="space-between">
      <Text bold>auto-showcase</Text>
      <Box>
        <Text dimColor>{`${done}/${total} done`}</Text>
        {cached > 0 ? <Text dimColor>{` · ${cached} cached`}</Text> : null}
        <Text dimColor>{`  ${vm.elapsed}`}</Text>
      </Box>
    </Box>
  );
}

/** The live run dashboard. Reads run state from the store; animates a spinner/bar on a timer. */
export function Dashboard({
  store,
  onInterrupt,
}: {
  store: DashboardStore;
  onInterrupt?: () => void;
}): ReactElement {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setFrame((f) => f + 1), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  // Ink owns keyboard input while live (one keypress owner), so the caller's watcher handles only
  // signals. Gate on raw-mode support so a forced dashboard on a non-TTY doesn't throw.
  const { isRawModeSupported } = useStdin();
  useInput(
    (input, key) => {
      if (key.escape || (key.ctrl && input === "c")) onInterrupt?.();
    },
    { isActive: isRawModeSupported },
  );

  const { columns } = useWindowSize();
  const width = columns > 0 ? Math.min(columns, MAX_WIDTH) : undefined;
  const vm = buildView(snapshot, frame, Date.now(), columns > 0 ? width : undefined);

  return (
    <>
      {/* Committed above the live box, in scrollback — completed logs that won't change. */}
      <Static items={vm.logs}>
        {(line) => (
          <Text key={line.key} color={line.color} dimColor={line.dim}>
            {line.text}
          </Text>
        )}
      </Static>

      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={vm.cancelling ? "yellow" : "gray"}
        borderDimColor={!vm.cancelling}
        paddingX={1}
        width={width}
      >
        <Header vm={vm} />

        {vm.setup.length > 0 ? <Section label="SETUP" rows={vm.setup} vm={vm} /> : null}

        <Section label="ASSETS" rows={vm.assets} vm={vm} tally={vm.tally} />

        <Box marginTop={1}>
          <Text color={vm.footer.tone === "warn" ? "yellow" : undefined} dimColor={vm.footer.tone === "dim"}>
            {vm.footer.text}
          </Text>
        </Box>
      </Box>
    </>
  );
}
