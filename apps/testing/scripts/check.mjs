// Validate the generated showcase: every manifest asset has a real file with sane metadata.
import { access, readFile } from "node:fs/promises";
import path from "node:path";

const outDir = path.join(process.cwd(), "public", "showcase");
const manifestPath = path.join(outDir, "manifest.json");

let manifest;
try {
  manifest = JSON.parse(await readFile(manifestPath, "utf8"));
} catch {
  console.error(`No manifest at ${manifestPath} — run \`pnpm generate\` first.`);
  process.exit(1);
}

const raw = manifest.assets ?? manifest;
const assets = Array.isArray(raw) ? raw : Object.values(raw);

let failed = 0;
for (const a of assets) {
  const full = path.join(outDir, a.file);
  try {
    await access(full);
  } catch {
    console.error(`✗ ${a.id}: missing file ${a.file}`);
    failed++;
    continue;
  }
  const isImage = a.format === "png" || a.format === "jpeg" || a.format === "jpg";
  if (!a.width || !a.height || !a.format) {
    console.error(`✗ ${a.id}: missing width/height/format`);
    failed++;
    continue;
  }
  if (!isImage && !a.durationMs) {
    console.error(`✗ ${a.id}: video without durationMs`);
    failed++;
    continue;
  }
  const dur = a.durationMs ? ` ${(a.durationMs / 1000).toFixed(1)}s` : "";
  console.log(`✓ ${a.id}  ${a.format} ${a.width}×${a.height}${dur}`);
}

if (failed) {
  console.error(`\n${failed} of ${assets.length} checks failed.`);
  process.exit(1);
}
console.log(`\nAll ${assets.length} assets OK.`);
