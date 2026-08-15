import { describe, it, expect } from "vitest";
import {
  appendTerminalBuffer,
  createTerminalBuffer,
  terminalBufferSlice
} from "../src/terminal-buffer.js";

/**
 * The terminal output ring keeps the last N bytes plus an absolute stream
 * cursor. These specs pin the contract the Web UI poll relies on: `after` is
 * an absolute byte offset, and once the ring drops old bytes the slice still
 * returns everything the client has not seen (or the retained tail when the
 * client offset predates the window).
 */
describe("terminal output ring buffer", () => {
  it("slices incrementally while output stays under the limit", () => {
    const state = createTerminalBuffer();
    appendTerminalBuffer(state, "hello", 16);
    appendTerminalBuffer(state, " world", 16);
    const first = terminalBufferSlice(state, 0);
    expect(first).toEqual({ text: "hello world", cursor: 11 });
    const second = terminalBufferSlice(state, first.cursor);
    expect(second).toEqual({ text: "", cursor: 11 });
  });

  it("drops the oldest bytes but still serves output after the drop point", () => {
    const state = createTerminalBuffer();
    appendTerminalBuffer(state, "abcd", 8);
    appendTerminalBuffer(state, "efghij", 8); // 10 bytes total, first 2 drop
    expect(state.start).toBe(2);
    expect(state.buffer.toString("utf8")).toBe("cdefghij");
    // The client already saw the first 4 bytes; it must get exactly the tail.
    const slice = terminalBufferSlice(state, 4);
    expect(slice).toEqual({ text: "efghij", cursor: 10 });
  });

  it("re-serves the retained window when the client offset predates it", () => {
    const state = createTerminalBuffer();
    appendTerminalBuffer(state, "abcdefghij", 8);
    const slice = terminalBufferSlice(state, 0);
    expect(slice).toEqual({ text: "cdefghij", cursor: 10 });
    // A stale client asking from offset 1 still gets the whole retained window.
    expect(terminalBufferSlice(state, 1)).toEqual({ text: "cdefghij", cursor: 10 });
  });

  it("aligns the retained window to a UTF-8 character boundary", () => {
    const state = createTerminalBuffer();
    // "😀" is 4 bytes; with a 4-byte limit the emoji cannot fit and only "a"
    // must remain — never a replacement character from a mid-codepoint cut.
    appendTerminalBuffer(state, "😀a", 4);
    const slice = terminalBufferSlice(state, 0);
    expect(slice.text).toBe("a");
    expect(slice.cursor).toBe(5);
    expect(slice.text).not.toContain("\ufffd");
  });

  it("returns an empty slice for offsets beyond the stream cursor", () => {
    const state = createTerminalBuffer();
    appendTerminalBuffer(state, "abc", 16);
    expect(terminalBufferSlice(state, 99)).toEqual({ text: "", cursor: 3 });
  });

  it("treats negative or non-numeric offsets as 'from the start'", () => {
    const state = createTerminalBuffer();
    appendTerminalBuffer(state, "abc", 16);
    expect(terminalBufferSlice(state, Number.NaN)).toEqual({ text: "abc", cursor: 3 });
    expect(terminalBufferSlice(state, -5)).toEqual({ text: "abc", cursor: 3 });
  });
});
