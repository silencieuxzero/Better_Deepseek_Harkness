/**
 * Streaming ANSI escape stripper for terminal output.
 *
 * PTY streams (node-pty / ConPTY) emit CSI and OSC escape sequences for
 * colors, cursor movement, and window titles. The Web UI terminal renders
 * plain text in a <pre>, so those sequences must be removed before they are
 * appended to a session's output ring buffer.
 *
 * Chunks may split an escape sequence in half, so the host keeps the trailing
 * incomplete bytes in `tail` and prepends them to the next chunk. The
 * functions here are pure: they never touch a session or the filesystem.
 */
const CSI = /^\x1b\[[0-9;?]*[ -/]*[@-~]/;
const OSC = /^\x1b\][^\x07]*(?:\x07|\x1b\\)/;
const TWO_CHAR = /^\x1b[()][A-Za-z0-9]/;
/** True when the rest of a chunk could still grow into a complete escape sequence. */
function isPartialEscape(rest) {
    if (rest === "\x1b")
        return true;
    if (rest.startsWith("\x1b["))
        return !CSI.test(rest);
    if (rest.startsWith("\x1b]"))
        return true; // OSC runs until BEL or ST
    if (rest.startsWith("\x1b(") || rest.startsWith("\x1b)"))
        return rest.length < 3;
    return false;
}
/**
 * Strip complete ANSI escape sequences from one chunk.
 * @param chunk - the newly received terminal text.
 * @param tail - trailing incomplete escape bytes from the previous chunk.
 * @returns the visible text and the new tail to carry into the next chunk.
 */
export function stripAnsiChunk(chunk, tail = "") {
    const input = tail + chunk;
    let text = "";
    let at = 0;
    while (at < input.length) {
        if (input.charCodeAt(at) !== 0x1b) {
            text += input[at];
            at += 1;
            continue;
        }
        const rest = input.slice(at);
        const match = CSI.exec(rest) ?? OSC.exec(rest) ?? TWO_CHAR.exec(rest);
        if (match) {
            at += match[0].length;
            continue;
        }
        if (isPartialEscape(rest))
            return { text, tail: rest };
        text += input[at];
        at += 1;
    }
    return { text, tail: "" };
}
