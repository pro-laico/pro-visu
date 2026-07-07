import { describe, expect, it } from "vitest";
import { parseByteRange } from "@/scene-engine/serve";

describe("parseByteRange", () => {
  const SIZE = 1000;

  it("returns null when there is no Range header", () => {
    expect(parseByteRange(undefined, SIZE)).toBeNull();
    expect(parseByteRange("", SIZE)).toBeNull();
  });

  it("parses a closed range", () => {
    expect(parseByteRange("bytes=0-99", SIZE)).toEqual({ start: 0, end: 99 });
    expect(parseByteRange("bytes=200-299", SIZE)).toEqual({ start: 200, end: 299 });
  });

  it("parses an open-ended range to the last byte", () => {
    expect(parseByteRange("bytes=500-", SIZE)).toEqual({ start: 500, end: 999 });
  });

  it("parses a suffix range (last N bytes) — the case the old regex got wrong", () => {
    expect(parseByteRange("bytes=-300", SIZE)).toEqual({ start: 700, end: 999 });
    // suffix larger than the file clamps to the whole body
    expect(parseByteRange("bytes=-99999", SIZE)).toEqual({ start: 0, end: 999 });
  });

  it("clamps an end past EOF", () => {
    expect(parseByteRange("bytes=900-5000", SIZE)).toEqual({ start: 900, end: 999 });
  });

  it("returns null for unsatisfiable or malformed ranges (caller serves full 200)", () => {
    expect(parseByteRange("bytes=5000-6000", SIZE)).toBeNull(); // start past EOF
    expect(parseByteRange("bytes=0-99,200-299", SIZE)).toBeNull(); // multi-range
    expect(parseByteRange("bytes=-", SIZE)).toBeNull();
    expect(parseByteRange("kbytes=0-1", SIZE)).toBeNull();
    expect(parseByteRange("bytes=abc-def", SIZE)).toBeNull();
  });
});
