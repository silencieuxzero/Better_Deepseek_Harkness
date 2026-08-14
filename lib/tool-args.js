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
 *
 * The fill string and the on/off switch come from the plugin config
 * (`cfg.toolRepair`), so deployments change them in cordis.patch.yml instead
 * of editing this module.
 */
/**
 * Try to parse a JSON object out of a possibly-malformed argument string.
 * @param text - the raw argument string as dispatched by the agent loop.
 * @returns the parsed object, or `undefined` when no recovery succeeds.
 */
export function tryParseJsonObject(text) {
    if (typeof text !== "string" || text.trim() === "")
        return undefined;
    // fast path: it is already valid JSON
    try {
        const value = JSON.parse(text);
        return value !== null && typeof value === "object" && !Array.isArray(value) ? value : undefined;
    }
    catch { /* fall through to recovery */ }
    const first = text.indexOf("{");
    if (first === -1)
        return undefined;
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
            if (value !== null && typeof value === "object" && !Array.isArray(value))
                return value;
        }
        catch { /* keep trying */ }
    }
    return undefined;
}
/**
 * Repair one execution's arguments.
 * @param parameters - the tool's compiled parameter schema; `null`/absent
 *   means no schema to consult and only JSON recovery applies.
 * @param args - `exec.arguments` as dispatched by the agent loop (a plain
 *   object, or a raw string when the model's JSON did not parse).
 * @param policy - the repair policy from the plugin config. When `enabled`
 *   is false the arguments pass through untouched.
 * @returns the arguments to dispatch and whether they changed. The registry
 *   freezes arguments at prepare time, so a changed result is always a fresh
 *   object — the caller must reassign `exec.arguments`.
 */
export function repairToolArguments(parameters, args, policy) {
    if (!policy || policy.enabled === false)
        return { arguments: args, changed: false };
    let current = args;
    let changed = false;
    if (typeof current === "string") {
        const recovered = tryParseJsonObject(current);
        if (recovered !== undefined) {
            current = recovered;
            changed = true;
        }
    }
    if (current === null || typeof current !== "object" || Array.isArray(current)) {
        return { arguments: current, changed };
    }
    const object = current;
    const properties = parameters?.properties;
    if (properties !== null && typeof properties === "object" && Object.hasOwn(properties, "description")) {
        const description = object.description;
        if (typeof description !== "string" || description.trim() === "") {
            current = { ...object, description: policy.descriptionFill };
            changed = true;
        }
    }
    return { arguments: current, changed };
}
