import { describe, it, expect } from "vitest";
import {
  GITHUB_API_URL,
  GITHUB_DEFAULTS,
  GITHUB_FILE_CONTENT_CAP,
  GITHUB_RELEASE_BODY_CAP,
  GITHUB_RELEASES_CAP,
  GITHUB_TREE_ENTRIES_CAP,
  formatGithubFileOutput,
  formatGithubReleasesOutput,
  formatGithubRepoOutput,
  formatGithubSearchOutput,
  formatGithubTreeOutput,
  githubContentsUrl,
  githubErrorMessage,
  githubHeaders,
  githubReleasesUrl,
  githubRepoUrl,
  githubSearchUrl,
  mapGithubContentsResponse,
  mapGithubReleasesResponse,
  mapGithubRepoResponse,
  mapGithubSearchResponse,
  parseRepoRef,
  resolveGithubSettings,
  validateGithubPath,
  validateGithubToken
} from "../src/github.js";

/** A realistic repo JSON body for /repos/{owner}/{repo}. */
function repoBody(overrides: Record<string, unknown> = {}) {
  return {
    full_name: "octocat/Hello-World",
    html_url: "https://github.com/octocat/Hello-World",
    description: "My first repository on GitHub!",
    default_branch: "main",
    stargazers_count: 12345,
    forks_count: 678,
    open_issues_count: 42,
    language: "TypeScript",
    license: { spdx_id: "MIT" },
    topics: ["demo", "hello"],
    pushed_at: "2026-01-02T03:04:05Z",
    archived: false,
    ...overrides
  };
}

describe("resolveGithubSettings", () => {
  it("returns the documented defaults for an empty section", () => {
    expect(resolveGithubSettings(undefined)).toEqual(GITHUB_DEFAULTS);
  });

  it("merges stored values over the defaults", () => {
    const settings = resolveGithubSettings({ enabled: false, token: "ghp_abc", timeoutMs: 45000 });
    expect(settings.enabled).toBe(false);
    expect(settings.token).toBe("ghp_abc");
    expect(settings.timeoutMs).toBe(45000);
  });

  it("degrades invalid stored values without throwing (the master switch fails closed)", () => {
    const settings = resolveGithubSettings({ enabled: "yes", token: 42, timeoutMs: 1 });
    expect(settings).toEqual({ enabled: false, token: "", timeoutMs: GITHUB_DEFAULTS.timeoutMs });
  });

  it("clamps out-of-range timeouts to the default", () => {
    expect(resolveGithubSettings({ timeoutMs: 1 }).timeoutMs).toBe(GITHUB_DEFAULTS.timeoutMs);
    expect(resolveGithubSettings({ timeoutMs: 999999 }).timeoutMs).toBe(GITHUB_DEFAULTS.timeoutMs);
  });
});

describe("validateGithubToken", () => {
  it("accepts the empty token (unauthenticated public access)", () => {
    expect(validateGithubToken("")).toBeNull();
  });

  it("accepts classic and fine-grained token shapes", () => {
    expect(validateGithubToken("ghp_" + "a".repeat(36))).toBeNull();
    expect(validateGithubToken("github_pat_" + "b".repeat(60))).toBeNull();
    expect(validateGithubToken("gho_" + "c".repeat(36))).toBeNull();
    expect(validateGithubToken("ghu_" + "d".repeat(36))).toBeNull();
    expect(validateGithubToken("ghs_" + "e".repeat(36))).toBeNull();
    expect(validateGithubToken("ghr_" + "f".repeat(36))).toBeNull();
  });

  it("rejects short tokens", () => {
    expect(validateGithubToken("ghp_short")).toMatch(/too short/);
  });

  it("rejects tokens with unknown prefixes or characters", () => {
    expect(validateGithubToken("sk-" + "a".repeat(30))).toMatch(/format is invalid/);
    expect(validateGithubToken("ghp_" + "a".repeat(30) + "!")).toMatch(/format is invalid/);
  });
});

describe("parseRepoRef", () => {
  it("accepts separate owner and repo", () => {
    const parsed = parseRepoRef("octocat", "Hello-World");
    expect(parsed).toEqual({ ok: true, ref: { owner: "octocat", repo: "Hello-World" } });
  });

  it("accepts a combined owner/repo in the repo argument", () => {
    const parsed = parseRepoRef(undefined, "octocat/Hello-World");
    expect(parsed.ok && parsed.ref).toEqual({ owner: "octocat", repo: "Hello-World" });
  });

  it("accepts a combined owner/repo in the owner argument", () => {
    const parsed = parseRepoRef("octocat/Hello-World", undefined);
    expect(parsed.ok && parsed.ref).toEqual({ owner: "octocat", repo: "Hello-World" });
  });

  it("strips a trailing .git from the repo name", () => {
    const parsed = parseRepoRef(undefined, "octocat/Hello-World.git");
    expect(parsed.ok && parsed.ref).toEqual({ owner: "octocat", repo: "Hello-World" });
  });

  it("rejects URLs with guidance", () => {
    expect(parseRepoRef("https://github.com/octocat/Hello-World", undefined).ok).toBe(false);
    expect(parseRepoRef(undefined, "https://github.com/o/r").ok).toBe(false);
    expect(parseRepoRef(undefined, "github.com/octocat/Hello-World").ok).toBe(false);
  });

  it("rejects double specification (combined + separate)", () => {
    const parsed = parseRepoRef("octocat/Hello-World", "Hello-World");
    expect(parsed.ok).toBe(false);
    expect(parsed.ok || parsed.message).toMatch(/not both/);
  });

  it("rejects missing or invalid parts", () => {
    expect(parseRepoRef("", "").ok).toBe(false);
    expect(parseRepoRef("", "Hello-World").ok).toBe(false);
    expect(parseRepoRef("octocat", "").ok).toBe(false);
    expect(parseRepoRef("bad owner", "repo").ok).toBe(false);
    expect(parseRepoRef("octocat", "bad\u0000repo").ok).toBe(false);
    expect(parseRepoRef("o".repeat(200), "r").ok).toBe(false);
  });
});

describe("validateGithubPath", () => {
  it("accepts the empty path (repository root) and plain paths", () => {
    expect(validateGithubPath("")).toBeNull();
    expect(validateGithubPath("src/index.ts")).toBeNull();
    expect(validateGithubPath("docs/中文/readme.md")).toBeNull();
  });

  it("rejects traversal, control characters, and oversized paths", () => {
    expect(validateGithubPath("../secret")).toMatch(/\.\./);
    expect(validateGithubPath("a/./b")).toMatch(/\./);
    expect(validateGithubPath("a\r\nb")).toMatch(/control/);
    expect(validateGithubPath("x".repeat(5000))).toMatch(/too long/);
  });
});

describe("URL builders", () => {
  it("builds the repo endpoint", () => {
    expect(githubRepoUrl("octocat", "Hello-World")).toBe(`${GITHUB_API_URL}/repos/octocat/Hello-World`);
  });

  it("builds the contents endpoint with optional path and ref", () => {
    expect(githubContentsUrl("o", "r", "", undefined)).toBe(`${GITHUB_API_URL}/repos/o/r/contents/`);
    expect(githubContentsUrl("o", "r", "src/a b.ts", undefined)).toBe(`${GITHUB_API_URL}/repos/o/r/contents/src/a%20b.ts`);
    expect(githubContentsUrl("o", "r", "README.md", "v1.0")).toBe(`${GITHUB_API_URL}/repos/o/r/contents/README.md?ref=v1.0`);
  });

  it("builds the search and releases endpoints", () => {
    expect(githubSearchUrl("topic:rust stars:>100", 5)).toBe(`${GITHUB_API_URL}/search/repositories?q=topic%3Arust%20stars%3A%3E100&per_page=5`);
    expect(githubReleasesUrl("o", "r", 3)).toBe(`${GITHUB_API_URL}/repos/o/r/releases?per_page=3`);
  });
});

describe("githubHeaders", () => {
  it("sends the pinned API version and no auth without a token", () => {
    const headers = githubHeaders("");
    expect(headers.accept).toBe("application/vnd.github+json");
    expect(headers["x-github-api-version"]).toBe("2022-11-28");
    expect(headers).not.toHaveProperty("authorization");
  });

  it("adds Bearer auth when a token is configured", () => {
    expect(githubHeaders("ghp_token123").authorization).toBe("Bearer ghp_token123");
  });
});

describe("mapGithubRepoResponse", () => {
  it("maps a full response body", () => {
    expect(mapGithubRepoResponse(repoBody())).toEqual({
      fullName: "octocat/Hello-World",
      htmlUrl: "https://github.com/octocat/Hello-World",
      description: "My first repository on GitHub!",
      defaultBranch: "main",
      stars: 12345,
      forks: 678,
      openIssues: 42,
      language: "TypeScript",
      license: "MIT",
      topics: ["demo", "hello"],
      pushedAt: "2026-01-02T03:04:05Z",
      archived: false
    });
  });

  it("degrades sparse bodies to defaults", () => {
    const info = mapGithubRepoResponse(null);
    expect(info.fullName).toBe("");
    expect(info.defaultBranch).toBe("main");
    expect(info.stars).toBe(0);
    expect(info.archived).toBe(false);
    expect(info.description).toBeUndefined();
    expect(info.license).toBeUndefined();
  });

  it("drops empty optional fields", () => {
    const info = mapGithubRepoResponse(repoBody({ description: "", language: null, topics: "nope" }));
    expect(info.description).toBeUndefined();
    expect(info.language).toBeUndefined();
    expect(info.topics).toEqual([]);
  });
});

describe("mapGithubContentsResponse", () => {
  it("maps a directory listing", () => {
    const result = mapGithubContentsResponse([
      { name: "src", path: "src", type: "dir" },
      { name: "README.md", path: "README.md", type: "file", size: 123, download_url: "https://raw.githubusercontent.com/o/r/main/README.md" },
      { name: "notes", path: "notes", type: "symlink" }
    ]);
    expect(result.kind).toBe("dir");
    if (result.kind !== "dir") return;
    expect(result.truncated).toBe(false);
    expect(result.entries).toEqual([
      { name: "src", path: "src", type: "dir" },
      { name: "README.md", path: "README.md", type: "file", size: 123, downloadUrl: "https://raw.githubusercontent.com/o/r/main/README.md" }
    ]);
  });

  it("marks listings truncated at the 1000-entry cap", () => {
    const rows = Array.from({ length: 1200 }, (_, i) => ({ name: `f${i}`, path: `f${i}`, type: "file" }));
    const result = mapGithubContentsResponse(rows);
    expect(result.kind).toBe("dir");
    if (result.kind !== "dir") return;
    expect(result.entries).toHaveLength(GITHUB_TREE_ENTRIES_CAP);
    expect(result.truncated).toBe(true);
  });

  it("decodes base64 file content", () => {
    const result = mapGithubContentsResponse({
      name: "README.md",
      path: "README.md",
      size: 11,
      content: Buffer.from("# Hello\n").toString("base64")
    });
    expect(result.kind).toBe("file");
    if (result.kind !== "file") return;
    expect(result).toEqual({ kind: "file", content: "# Hello\n", size: 11, truncated: false, binary: false });
  });

  it("truncates oversized file content to the cap", () => {
    const payload = "x".repeat(GITHUB_FILE_CONTENT_CAP + 100);
    const result = mapGithubContentsResponse({ content: Buffer.from(payload).toString("base64"), size: payload.length });
    expect(result.kind).toBe("file");
    if (result.kind !== "file") return;
    expect(result.content).toHaveLength(GITHUB_FILE_CONTENT_CAP);
    expect(result.truncated).toBe(true);
  });

  it("flags binary files by NUL bytes", () => {
    const payload = "PK\u0000\u0004binary";
    const result = mapGithubContentsResponse({ content: Buffer.from(payload).toString("base64"), size: payload.length });
    expect(result.kind).toBe("file");
    if (result.kind !== "file") return;
    expect(result.binary).toBe(true);
  });

  it("degrades malformed bodies to an empty file", () => {
    const result = mapGithubContentsResponse({});
    expect(result).toEqual({ kind: "file", content: "", size: 0, truncated: false, binary: false });
  });
});

describe("mapGithubSearchResponse", () => {
  it("maps and caps search items", () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      full_name: `o/r${i}`,
      html_url: `https://github.com/o/r${i}`,
      description: `desc ${i}`,
      language: "Rust",
      stargazers_count: i
    }));
    const result = mapGithubSearchResponse({ total_count: 200, items }, 3);
    expect(result.totalCount).toBe(200);
    expect(result.items).toHaveLength(3);
    expect(result.items[0]).toEqual({ fullName: "o/r0", htmlUrl: "https://github.com/o/r0", description: "desc 0", language: "Rust", stars: 0 });
  });

  it("drops entries without a full name and degrades malformed bodies", () => {
    const result = mapGithubSearchResponse({ total_count: 1, items: [{ description: "no name" }, "junk", { full_name: "o/r", stargazers_count: 7 }] });
    expect(result.items).toEqual([{ fullName: "o/r", htmlUrl: "https://github.com/o/r", stars: 7 }]);
    expect(mapGithubSearchResponse(null).items).toEqual([]);
  });
});

describe("mapGithubReleasesResponse", () => {
  it("maps releases and caps bodies", () => {
    const longBody = "b".repeat(GITHUB_RELEASE_BODY_CAP + 10);
    const result = mapGithubReleasesResponse([
      { tag_name: "v1.0.0", html_url: "https://github.com/o/r/releases/tag/v1.0.0", name: "One", published_at: "2026-01-01T00:00:00Z", body: "notes" },
      { tag_name: "v0.9.0", html_url: "https://github.com/o/r/releases/tag/v0.9.0", body: longBody },
      { tag_name: "", html_url: "x" }
    ], GITHUB_RELEASES_CAP, GITHUB_RELEASE_BODY_CAP);
    expect(result.releases).toHaveLength(2);
    expect(result.releases[0]).toEqual({
      tagName: "v1.0.0",
      htmlUrl: "https://github.com/o/r/releases/tag/v1.0.0",
      name: "One",
      publishedAt: "2026-01-01T00:00:00Z",
      body: "notes"
    });
    expect(result.releases[1].body).toHaveLength(GITHUB_RELEASE_BODY_CAP + "\n…[truncated]".length);
    expect(result.releases[1].body).toMatch(/…\[truncated\]$/);
  });

  it("caps the release count", () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ tag_name: `v${i}`, html_url: "x" }));
    expect(mapGithubReleasesResponse(rows, 2).releases).toHaveLength(2);
  });
});

describe("githubErrorMessage", () => {
  it("explains an invalid token on 401", () => {
    expect(githubErrorMessage(401, {}, "https://api.github.com/repos/o/r")).toMatch(/token is invalid or expired/);
  });

  it("explains rate limiting on 403", () => {
    expect(githubErrorMessage(403, { message: "API rate limit exceeded for 1.2.3.4" }, "u")).toMatch(/rate limit exceeded/);
  });

  it("carries the API detail for other 403s and falls back to a generic message", () => {
    expect(githubErrorMessage(403, { message: "Resource not accessible" }, "u")).toBe("GitHub API error (HTTP 403): Resource not accessible");
    expect(githubErrorMessage(403, null, "u")).toMatch(/access forbidden/);
  });

  it("names the resource on 404", () => {
    expect(githubErrorMessage(404, {}, "https://api.github.com/repos/o/r")).toMatch(/was not found/);
  });

  it("carries the API detail for other statuses", () => {
    expect(githubErrorMessage(422, { message: "Validation Failed" }, "u")).toBe("GitHub API error (HTTP 422): Validation Failed");
    expect(githubErrorMessage(500, null, "u")).toBe("GitHub API error (HTTP 500)");
  });
});

describe("output formatters", () => {
  it("formats repository info", () => {
    const text = formatGithubRepoOutput(mapGithubRepoResponse(repoBody()));
    expect(text).toContain("octocat/Hello-World");
    expect(text).toContain("stars: 12345");
    expect(text).toContain("license: MIT");
    expect(text).toContain("Cite the repository URL");
  });

  it("formats directory listings with a truncation notice", () => {
    expect(formatGithubTreeOutput({ entries: [{ name: "a", path: "src/a.ts", type: "file", size: 3 }], truncated: false })).toContain("src/a.ts (3 bytes)");
    expect(formatGithubTreeOutput({ entries: [{ name: "d", path: "d", type: "dir" }], truncated: true })).toContain("truncated");
    expect(formatGithubTreeOutput({ entries: [], truncated: false })).toContain("empty");
  });

  it("formats file content with binary/truncation notices", () => {
    expect(formatGithubFileOutput({ content: "hi", size: 2, truncated: false, binary: false })).toBe("hi");
    expect(formatGithubFileOutput({ content: "\u0000", size: 5, truncated: false, binary: true })).toMatch(/binary/);
    expect(formatGithubFileOutput({ content: "hi", size: 9999, truncated: true, binary: false })).toMatch(/larger than/);
  });

  it("formats search results with the overflow notice", () => {
    const result = mapGithubSearchResponse({ total_count: 50, items: [{ full_name: "o/r", description: "d", language: "Rust", stargazers_count: 10 }] });
    const text = formatGithubSearchOutput(result);
    expect(text).toContain("[o/r — d](https://github.com/o/r)");
    expect(text).toContain("and 49 more repositories");
    expect(formatGithubSearchOutput({ totalCount: 0, items: [] })).toContain("No repositories found.");
  });

  it("formats release lists", () => {
    const result = mapGithubReleasesResponse([{ tag_name: "v1", html_url: "u", name: "One", published_at: "2026-01-01T00:00:00Z", body: "notes" }]);
    const text = formatGithubReleasesOutput(result);
    expect(text).toContain("[One](u)");
    expect(text).toContain("v1");
    expect(text).toContain("notes");
    expect(formatGithubReleasesOutput({ releases: [] })).toContain("No releases found.");
  });
});
