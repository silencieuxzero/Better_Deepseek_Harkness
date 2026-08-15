import { describe, it, expect } from "vitest";
import { stripAnsiChunk } from "../src/ansi.js";

describe("stripAnsiChunk", () => {
  it("strips CSI color and cursor sequences", () => {
    expect(stripAnsiChunk("\x1b[32mok\x1b[0m")).toEqual({ text: "ok", tail: "" });
    expect(stripAnsiChunk("a\x1b[1;31mb\x1b[0m")).toEqual({ text: "ab", tail: "" });
    expect(stripAnsiChunk("x\x1b[2J\x1b[H")).toEqual({ text: "x", tail: "" });
  });

  it("strips OSC title sequences", () => {
    expect(stripAnsiChunk("\x1b]0;title\x07ok")).toEqual({ text: "ok", tail: "" });
  });

  it("carries an incomplete CSI sequence across chunks", () => {
    expect(stripAnsiChunk("\x1b[3")).toEqual({ text: "", tail: "\x1b[3" });
    expect(stripAnsiChunk("2mok", "\x1b[3")).toEqual({ text: "ok", tail: "" });
  });

  it("carries a lone ESC across chunks", () => {
    expect(stripAnsiChunk("\x1b")).toEqual({ text: "", tail: "\x1b" });
    expect(stripAnsiChunk("[34mok", "\x1b")).toEqual({ text: "ok", tail: "" });
  });

  it("keeps plain text untouched", () => {
    expect(stripAnsiChunk("中文 echo ok")).toEqual({ text: "中文 echo ok", tail: "" });
  });
});
