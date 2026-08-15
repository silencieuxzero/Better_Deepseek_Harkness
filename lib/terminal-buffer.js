/**
 * Byte-bounded output ring for one terminal session.
 *
 * The Web UI polls terminal output with an absolute byte offset (`after`), so
 * the ring keeps both the retained bytes and the absolute byte count of the
 * whole stream. Once output exceeds the configured limit the oldest bytes
 * drop, and the retained window's absolute start moves forward; slices are
 * computed against that window instead of against the trimmed buffer, so a
 * client whose offset predates the window simply re-receives the retained
 * tail with the authoritative cursor. This module is pure: it never touches
 * a session, the filesystem, or a process.
 */
/** Create an empty terminal output ring. */
export function createTerminalBuffer() {
    return { buffer: Buffer.alloc(0), bytes: 0, start: 0 };
}
/**
 * Append one stripped text chunk, dropping the oldest bytes when the ring
 * exceeds `limit` bytes. The retained window is aligned to a UTF-8 character
 * boundary so `buffer.toString("utf8")` never starts with a replacement
 * character.
 */
export function appendTerminalBuffer(state, chunk, limit) {
    if (typeof chunk !== "string" || chunk.length === 0)
        return;
    const data = Buffer.from(chunk, "utf8");
    state.buffer = Buffer.concat([state.buffer, data]);
    state.bytes += data.length;
    let start = Math.max(0, state.buffer.length - limit);
    while (start < state.buffer.length && (state.buffer[start] & 0xc0) === 0x80)
        start += 1;
    if (start > 0)
        state.buffer = state.buffer.subarray(start);
    state.start = state.bytes - state.buffer.length;
}
/**
 * Slice the text that lies after the absolute byte offset `after`, plus the
 * authoritative stream cursor. Offsets before the retained window fall back
 * to the start of the window (the earliest bytes still available).
 */
export function terminalBufferSlice(state, after) {
    const relative = Number.isFinite(after) && after > 0
        ? Math.max(0, Math.min(after, state.bytes) - state.start)
        : 0;
    return {
        text: state.buffer.subarray(Math.min(relative, state.buffer.length)).toString("utf8"),
        cursor: state.bytes
    };
}
