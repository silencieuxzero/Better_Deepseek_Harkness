/**
 * Tavily web search — pure logic (defaults, validation, request building,
 * response mapping, formatting). No I/O: the host half wires this module to
 * `fetch` and the tool registry; the tests cover behavior here.
 * @module better-deepseek-harness/tavily
 */

export type TavilySearchDepth = "basic" | "advanced";

export interface TavilySettings {
  enabled: boolean;
  apiKey: string;
  searchDepth: TavilySearchDepth;
  maxResults: number;
  includeRaw: boolean;
}

/** The settings a fresh deployment starts from; every field owns its default. */
export const TAVILY_DEFAULTS: Readonly<TavilySettings> = Object.freeze({
  enabled: false,
  apiKey: "",
  searchDepth: "basic",
  maxResults: 5,
  includeRaw: false
});

/** Tavily search endpoint (POST /search). */
export const TAVILY_API_URL = "https://api.tavily.com/search";
/** Accepted range for `max_results` (mirrors the UI bounds). */
export const TAVILY_MAX_RESULTS_MIN = 1;
export const TAVILY_MAX_RESULTS_MAX = 10;
/** Tavily keys look like `tvly-` plus a long token; anything shorter is a typo. */
export const TAVILY_API_KEY_MIN_LENGTH = 20;
export const TAVILY_API_KEY_RE = /^tvly-[A-Za-z0-9_-]+$/;
/** Per-source raw-content cap (chars) when `include_raw_content` is on. */
export const TAVILY_RAW_CONTENT_CAP = 4000;

/**
 * Resolve the stored `tavily` settings section with explicit defaults. Invalid
 * stored values fall back to defaults instead of throwing — the settings
 * schema already rejects bad writes, so this only guards hand-edited files.
 *
 * @param value - the raw `tavily` section (any JSON value).
 * @returns the fully-defaulted settings.
 */
export function resolveTavilySettings(value: unknown): TavilySettings {
  const stored = typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const maxResults = Number.isInteger(stored.maxResults)
    && Number(stored.maxResults) >= TAVILY_MAX_RESULTS_MIN
    && Number(stored.maxResults) <= TAVILY_MAX_RESULTS_MAX
    ? Number(stored.maxResults)
    : TAVILY_DEFAULTS.maxResults;
  return {
    enabled: stored.enabled === true,
    apiKey: typeof stored.apiKey === "string" ? stored.apiKey : "",
    searchDepth: stored.searchDepth === "advanced" ? "advanced" : "basic",
    maxResults,
    includeRaw: stored.includeRaw === true
  };
}

/**
 * Validate a candidate API key. Returns an error message when the key is
 * rejected, or `null` when it is accepted.
 *
 * @param key - the trimmed candidate key.
 * @returns a human-readable problem, or `null` when the key is well-formed.
 */
export function validateTavilyApiKey(key: string): string | null {
  if (key.length < TAVILY_API_KEY_MIN_LENGTH) {
    return `Tavily API key is too short (${key.length} chars; expected at least ${TAVILY_API_KEY_MIN_LENGTH}, starting with "tvly-")`;
  }
  if (!TAVILY_API_KEY_RE.test(key)) {
    return 'Tavily API key format is invalid (must start with "tvly-" and contain only letters, digits, "-" or "_")';
  }
  return null;
}

/**
 * Build the POST body for `api.tavily.com/search` from one query and the
 * current settings.
 *
 * @param query - the non-empty search query.
 * @param settings - the resolved settings.
 * @returns the JSON-serializable request body.
 */
export function buildTavilyRequestBody(query: string, settings: TavilySettings): Record<string, unknown> {
  return {
    api_key: settings.apiKey,
    query,
    search_depth: settings.searchDepth,
    max_results: settings.maxResults,
    include_raw_content: settings.includeRaw,
    include_answer: true
  };
}

/** One normalized source: the URL plus every present optional field. */
export interface TavilySource {
  url: string;
  title?: string;
  snippet?: string;
  rawContent?: string;
}

/** The normalized search outcome the tool returns and renders. */
export interface TavilySearchResult {
  content?: string;
  sources: TavilySource[];
  truncated: boolean;
}

/** Project one Tavily result item into the normalized shape (null when unuseable). */
function projectTavilySource(item: Record<string, unknown>, includeRaw: boolean): TavilySource | null {
  const url = typeof item.url === "string" ? item.url : "";
  if (url.length === 0) return null;
  const source: TavilySource = { url };
  if (typeof item.title === "string" && item.title.length > 0) source.title = item.title;
  if (typeof item.content === "string" && item.content.length > 0) source.snippet = item.content;
  if (includeRaw && typeof item.raw_content === "string" && item.raw_content.length > 0) {
    source.rawContent = item.raw_content.slice(0, TAVILY_RAW_CONTENT_CAP);
  }
  return source;
}

/**
 * Map a Tavily `/search` response body to the normalized result. The response
 * may carry an `answer` (the model-facing summary), a `results` list, or
 * neither; malformed bodies degrade to an empty source list so the caller
 * reports "no results" instead of crashing the conversation.
 *
 * @param json - the parsed response body.
 * @param includeRaw - whether raw content was requested (controls projection).
 * @returns the normalized result with URL-deduped sources.
 */
export function mapTavilyResponse(json: unknown, includeRaw: boolean): TavilySearchResult {
  const body = typeof json === "object" && json !== null ? json as Record<string, unknown> : {};
  const content = typeof body.answer === "string" && body.answer.length > 0 ? body.answer : void 0;
  const rawResults = Array.isArray(body.results) ? body.results : [];
  const seen = new Set<string>();
  const sources: TavilySource[] = [];
  for (const entry of rawResults) {
    if (typeof entry !== "object" || entry === null) continue;
    const source = projectTavilySource(entry as Record<string, unknown>, includeRaw);
    if (source === null || seen.has(source.url)) continue;
    seen.add(source.url);
    sources.push(source);
  }
  return {
    ...(content !== void 0 ? { content } : {}),
    sources,
    truncated: false
  };
}

/** Display label for a source: its title, else its hostname. */
function sourceLabel(url: string, title: string | undefined): string {
  if (title !== void 0 && title.length > 0) return title;
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * Format one search outcome as the model-facing text block: the summary (when
 * any), a markdown source list with snippet, the raw-content dump when
 * requested, a no-results notice, and a standing cite-your-sources
 * instruction.
 *
 * @param result - the normalized search outcome.
 * @returns the complete text block.
 */
export function formatTavilyOutput(result: TavilySearchResult): string {
  const parts: string[] = [];
  if (result.content !== void 0 && result.content.length > 0) parts.push(result.content);
  if (result.sources.length > 0) {
    const lines = result.sources.map((source) => {
      const label = sourceLabel(source.url, source.title);
      const suffix = source.snippet !== void 0 && source.snippet.length > 0 ? ` — ${source.snippet}` : "";
      return `- [${label}](${source.url})${suffix}`;
    });
    parts.push(`Sources:\n${lines.join("\n")}`);
    const raw = result.sources.filter((source) => source.rawContent !== void 0 && source.rawContent.length > 0);
    if (raw.length > 0) {
      parts.push(`Raw content:\n${raw.map((source) => `--- ${source.title ?? source.url} ---\n${source.rawContent}`).join("\n\n")}`);
    }
  } else if (result.content === void 0) {
    parts.push("No results found.");
  }
  parts.push("Cite the relevant URLs above as markdown links in your answer.");
  return parts.join("\n\n");
}
