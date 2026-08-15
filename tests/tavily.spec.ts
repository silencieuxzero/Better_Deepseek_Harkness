import { describe, it, expect } from "vitest";
import {
  TAVILY_DEFAULTS,
  TAVILY_RAW_CONTENT_CAP,
  buildTavilyRequestBody,
  formatTavilyOutput,
  mapTavilyResponse,
  resolveTavilySettings,
  validateTavilyApiKey
} from "../src/tavily.js";

describe("resolveTavilySettings", () => {
  it("defaults every field for an absent or empty section", () => {
    expect(resolveTavilySettings(undefined)).toEqual(TAVILY_DEFAULTS);
    expect(resolveTavilySettings({})).toEqual(TAVILY_DEFAULTS);
    expect(resolveTavilySettings(null)).toEqual(TAVILY_DEFAULTS);
    expect(resolveTavilySettings("nope")).toEqual(TAVILY_DEFAULTS);
  });

  it("keeps explicit valid values", () => {
    const settings = resolveTavilySettings({
      enabled: true,
      apiKey: "tvly-12345678901234567890",
      searchDepth: "advanced",
      maxResults: 7,
      includeRaw: true
    });
    expect(settings).toEqual({
      enabled: true,
      apiKey: "tvly-12345678901234567890",
      searchDepth: "advanced",
      maxResults: 7,
      includeRaw: true
    });
  });

  it("falls back to defaults for invalid depth and out-of-range maxResults", () => {
    expect(resolveTavilySettings({ searchDepth: "ultra", maxResults: 99 }).searchDepth).toBe("basic");
    expect(resolveTavilySettings({ maxResults: 99 }).maxResults).toBe(TAVILY_DEFAULTS.maxResults);
    expect(resolveTavilySettings({ maxResults: "5" }).maxResults).toBe(TAVILY_DEFAULTS.maxResults);
  });
});

describe("validateTavilyApiKey", () => {
  it("accepts a well-formed tvly- key", () => {
    expect(validateTavilyApiKey("tvly-" + "a".repeat(32))).toBeNull();
    expect(validateTavilyApiKey("tvly-abcDEF0123456789_-XYZ")).toBeNull();
  });

  it("rejects keys without the tvly- prefix", () => {
    expect(validateTavilyApiKey("sk-" + "a".repeat(32))).toMatch(/format is invalid/);
    expect(validateTavilyApiKey("TVLY-" + "a".repeat(32))).toMatch(/format is invalid/);
  });

  it("rejects short keys", () => {
    expect(validateTavilyApiKey("tvly-abc")).toMatch(/too short/);
    expect(validateTavilyApiKey("tvly-" + "a".repeat(14))).toMatch(/too short/);
    expect(validateTavilyApiKey("tvly-" + "a".repeat(15))).toBeNull();
  });
});

describe("buildTavilyRequestBody", () => {
  it("carries the query, depth, result bound, raw flag, and answer request", () => {
    const body = buildTavilyRequestBody("deepseek news", {
      enabled: true,
      apiKey: "tvly-secret",
      searchDepth: "advanced",
      maxResults: 3,
      includeRaw: true
    });
    expect(body).toEqual({
      api_key: "tvly-secret",
      query: "deepseek news",
      search_depth: "advanced",
      max_results: 3,
      include_raw_content: true,
      include_answer: true
    });
  });
});

describe("mapTavilyResponse", () => {
  it("maps the answer and results into the normalized shape", () => {
    const result = mapTavilyResponse({
      answer: "DeepSeek released a new model.",
      results: [
        { title: "A", url: "https://a.example", content: "snippet a", score: 0.9 },
        { title: "B", url: "https://b.example", content: "snippet b", raw_content: "<html>raw b</html>" }
      ]
    }, false);
    expect(result.content).toBe("DeepSeek released a new model.");
    expect(result.sources).toEqual([
      { url: "https://a.example", title: "A", snippet: "snippet a" },
      { url: "https://b.example", title: "B", snippet: "snippet b" }
    ]);
    expect(result.truncated).toBe(false);
  });

  it("dedupes repeated URLs and skips unusable entries", () => {
    const result = mapTavilyResponse({
      results: [
        { title: "A", url: "https://a.example", content: "first" },
        { title: "A2", url: "https://a.example", content: "second" },
        { title: "", url: "", content: "no url" },
        "junk"
      ]
    }, false);
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].url).toBe("https://a.example");
    expect(result.sources[0].snippet).toBe("first");
  });

  it("includes capped raw content only when requested", () => {
    const long = "<html>" + "x".repeat(TAVILY_RAW_CONTENT_CAP + 500) + "</html>";
    const off = mapTavilyResponse({ results: [{ url: "https://a.example", raw_content: long }] }, false);
    expect(off.sources[0]).not.toHaveProperty("rawContent");
    const on = mapTavilyResponse({ results: [{ url: "https://a.example", raw_content: long }] }, true);
    expect(on.sources[0].rawContent).toHaveLength(TAVILY_RAW_CONTENT_CAP);
  });

  it("degrades malformed bodies to an empty source list", () => {
    expect(mapTavilyResponse(null, false).sources).toEqual([]);
    expect(mapTavilyResponse({}, false).sources).toEqual([]);
    expect(mapTavilyResponse("junk", false).sources).toEqual([]);
  });
});

describe("formatTavilyOutput", () => {
  it("renders the answer, a source list, and the cite instruction", () => {
    const text = formatTavilyOutput({
      content: "Summary.",
      sources: [{ url: "https://a.example", title: "A", snippet: "s" }],
      truncated: false
    });
    expect(text).toContain("Summary.");
    expect(text).toContain("[A](https://a.example)");
    expect(text).toContain("— s");
    expect(text).toContain("Cite the relevant URLs");
  });

  it("reports no results when nothing came back", () => {
    const text = formatTavilyOutput({ sources: [], truncated: false });
    expect(text).toContain("No results found.");
  });

  it("appends raw content when present", () => {
    const text = formatTavilyOutput({
      sources: [{ url: "https://a.example", title: "A", rawContent: "<p>raw</p>" }],
      truncated: false
    });
    expect(text).toContain("Raw content:");
    expect(text).toContain("<p>raw</p>");
  });
});
