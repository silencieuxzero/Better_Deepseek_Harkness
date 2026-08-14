/**
 * Tool-call argument repair for the `tools/execute` wrapper.
 *
 * The model occasionally emits a tool call whose `arguments` fail the
 * registry's pre-execute validation (INVALID_ARGS): either the arguments
 * arrived as a raw string (the agent loop's JSON.parse failed on truncated or
 * prose-wrapped JSON), or a required field was dropped — most often
 * `description`, which is pure UI metadata and never changes what a tool does.
 *
 * This module repairs those two common, safe cases *before* validation runs:
 *   - recover a JSON object from a malformed string (strip prose, close a
 *     truncated object, drop trailing commas)
 *   - replace a missing / empty / wrongly-typed `description` with a neutral
 *     placeholder when the tool's parameter schema declares one
 *
 * It never invents *content* fields (e.g. `code` / `command`): a call that
 * genuinely lacks the program or command still fails validation, the harness
 * reports INVALID_ARGS, and the model is asked to re-emit it — as before.
 */

/** Neutral label used when the model dropped the required `description`. */
export const FILLED_DESCRIPTION = "Execute tool";

/** Try to parse a JSON object out of a possibly-malformed argument string. */
export function tryParseJsonObject(text) {
  if (typeof text !== "string" || text.trim() === "") return void 0;
  // fast path: it is already valid JSON
  try {
    const value = JSON.parse(text);
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
  } catch { /* fall through to recovery */ }
  const first = text.indexOf("{");
  if (first === -1) return void 0;
  const last = text.lastIndexOf("}");
  const candidate = last >= first ? text.slice(first, last + 1) : text.slice(first);
  const closed = candidate + "}"; // truncated object missing its closing brace
  const attempts = [
    candidate,
    closed,
    candidate.replace(/,\s*([}\]])/g, "$1"), // trailing commas before } or ]
    closed.replace(/,\s*([}\]])/g, "$1")
  ];
  for (const chunk of attempts) {
    try {
      const value = JSON.parse(chunk);
      if (value !== null && typeof value === "object" && !Array.isArray(value)) return value;
    } catch { /* keep trying */ }
  }
  return void 0;
}

/**
 * Repair one execution's arguments.
 * @param parameters - the tool's compiled parameter schema
 *   (`ToolDefinition.parameters`, e.g. `{type:"object", properties, required}`).
 * @param args - `exec.arguments` as dispatched by the agent loop (a plain
 *   object, or a raw string when the model's JSON did not parse).
 * @returns the arguments to dispatch and whether they changed. The registry
 *   freezes arguments at prepare time, so a changed result is always a fresh
 *   object — the caller must reassign `exec.arguments`.
 */
export function repairToolArguments(parameters, args) {
  let current = args;
  let changed = false;
  if (typeof current === "string") {
    const recovered = tryParseJsonObject(current);
    if (recovered !== void 0) {
      current = recovered;
      changed = true;
    }
  }
  if (current === null || typeof current !== "object" || Array.isArray(current)) {
    return { arguments: current, changed };
  }
  const properties = parameters !== null && typeof parameters === "object"
    ? parameters.properties
    : void 0;
  if (properties !== null && typeof properties === "object" && Object.hasOwn(properties, "description")) {
    const description = current.description;
    if (typeof description !== "string" || description.trim() === "") {
      current = { ...current, description: FILLED_DESCRIPTION };
      changed = true;
    }
  }
  return { arguments: current, changed };
}
