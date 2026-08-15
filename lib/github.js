/**
 * GitHub REST API — pure logic (defaults, validation, request building,
 * response mapping, formatting). No I/O: the host half wires this module to
 * `fetch` and the tool registry; the tests cover behavior here.
 * @module better-deepseek-harness/github
 */
/** The settings a fresh deployment starts from; every field owns its default. */
export const GITHUB_DEFAULTS = Object.freeze({
    // Public repositories need no token, so the tools are on by default; the
    // switch exists for deployments that want the tool surface hidden.
    enabled: true,
    token: "",
    timeoutMs: 30000
});
/** GitHub REST API v3 base URL (fixed — not configurable). */
export const GITHUB_API_URL = "https://api.github.com";
/** Ceiling on the stored GitHub token (security invariant). */
export const GITHUB_TOKEN_MAX_LENGTH = 4096;
/**
 * Accepted token prefixes: classic `ghp_`, fine-grained `github_pat_`, OAuth
 * `gho_`, user-to-server `ghu_`, server-to-server `ghs_`, refresh `ghr_`.
 */
export const GITHUB_TOKEN_RE = /^(gh[pousr]_|github_pat_)[A-Za-z0-9_-]+$/;
/** Non-empty GitHub tokens are long; anything shorter is a typo. */
export const GITHUB_TOKEN_MIN_LENGTH = 20;
/** Accepted range for the per-request timeout setting. */
export const GITHUB_TIMEOUT_MIN = 5000;
export const GITHUB_TIMEOUT_MAX = 120000;
/** Decoded file-content cap (chars) — a fixed security invariant, not configurable. */
export const GITHUB_FILE_CONTENT_CAP = 64 * 1024;
/** Directory-listing cap: the contents API returns at most 1000 entries per directory. */
export const GITHUB_TREE_ENTRIES_CAP = 1000;
/** Repository-search result cap (per_page). */
export const GITHUB_SEARCH_CAP = 10;
/** Release-list cap (per_page). */
export const GITHUB_RELEASES_CAP = 10;
/** Per-release body cap (chars). */
export const GITHUB_RELEASE_BODY_CAP = 4000;
/** Ceiling on one tree/file/search path or query argument. */
const GITHUB_ARG_MAX_LENGTH = 1024;
/**
 * Resolve the stored `github` settings section with explicit defaults. Invalid
 * stored values fall back to defaults instead of throwing — the settings
 * schema already rejects bad writes, so this only guards hand-edited files.
 *
 * @param value - the raw `github` section (any JSON value).
 * @returns the fully-defaulted settings.
 */
export function resolveGithubSettings(value) {
    const stored = typeof value === "object" && value !== null && !Array.isArray(value)
        ? value
        : {};
    const timeoutMs = Number.isInteger(stored.timeoutMs)
        && Number(stored.timeoutMs) >= GITHUB_TIMEOUT_MIN
        && Number(stored.timeoutMs) <= GITHUB_TIMEOUT_MAX
        ? Number(stored.timeoutMs)
        : GITHUB_DEFAULTS.timeoutMs;
    return {
        enabled: stored.enabled === void 0 ? GITHUB_DEFAULTS.enabled : stored.enabled === true,
        token: typeof stored.token === "string" ? stored.token : "",
        timeoutMs
    };
}
/**
 * Validate a candidate GitHub token. An empty string is valid (public
 * repositories need no auth). Returns an error message when the key is
 * rejected, or `null` when it is accepted.
 *
 * @param token - the trimmed candidate token.
 * @returns a human-readable problem, or `null` when the token is well-formed.
 */
export function validateGithubToken(token) {
    if (token.length === 0)
        return null;
    if (token.length < GITHUB_TOKEN_MIN_LENGTH) {
        return `GitHub token is too short (${token.length} chars; expected at least ${GITHUB_TOKEN_MIN_LENGTH}, starting with "ghp_", "gho_", "ghu_", "ghs_", "ghr_" or "github_pat_")`;
    }
    if (!GITHUB_TOKEN_RE.test(token)) {
        return 'GitHub token format is invalid (must start with "ghp_", "gho_", "ghu_", "ghs_", "ghr_" or "github_pat_" and contain only letters, digits, "-" or "_")';
    }
    return null;
}
const REPO_PART_RE = /^[A-Za-z0-9_.-]+$/;
const REPO_PART_MAX_LENGTH = 100;
/** Split a combined "owner/repo" (or "owner/repo.git") into its two parts. */
function splitRepoSlash(input) {
    const slash = input.indexOf("/");
    return [input.slice(0, slash), input.slice(slash + 1).replace(/\.git$/, "")];
}
/** Validate one owner or repo name part. */
function validateRepoPart(part, label) {
    if (part.length > REPO_PART_MAX_LENGTH)
        return `${label} "${part}" is too long (max ${REPO_PART_MAX_LENGTH} chars)`;
    if (/[\0\r\n]/.test(part))
        return `${label} contains control characters`;
    if (!REPO_PART_RE.test(part))
        return `${label} "${part}" is invalid — use only letters, digits, ".", "-" and "_"`;
    return null;
}
/**
 * Parse the owner/repo pair from the model's arguments. Accepts a separate
 * `owner` + `repo`, or a single combined `owner/repo` in either field (a
 * trailing ".git" is stripped). URLs and ambiguous double-specifications are
 * rejected with guidance.
 *
 * @param owner - the raw `owner` argument (any JSON value).
 * @param repo - the raw `repo` argument (any JSON value).
 * @returns the validated ref, or a human-readable rejection.
 */
export function parseRepoRef(owner, repo) {
    const ownerPart = typeof owner === "string" ? owner.trim() : "";
    const repoPart = typeof repo === "string" ? repo.trim() : "";
    if (/^https?:\/\//.test(ownerPart) || /^https?:\/\//.test(repoPart) || ownerPart.includes("github.com") || repoPart.includes("github.com")) {
        return { ok: false, message: 'pass the repository as "owner/repo", not a URL (e.g. "octocat/Hello-World")' };
    }
    let o = ownerPart;
    let r = repoPart;
    if (r.includes("/")) {
        if (o !== "")
            return { ok: false, message: 'use either separate owner and repo arguments or a combined "owner/repo", not both' };
        [o, r] = splitRepoSlash(r);
    }
    else if (o.includes("/")) {
        if (r !== "")
            return { ok: false, message: 'use either separate owner and repo arguments or a combined "owner/repo", not both' };
        [o, r] = splitRepoSlash(o);
    }
    if (o === "" || r === "") {
        return { ok: false, message: 'a repository must be given as "owner/repo" (e.g. "octocat/Hello-World")' };
    }
    const ownerProblem = validateRepoPart(o, "owner");
    if (ownerProblem !== null)
        return { ok: false, message: ownerProblem };
    const repoProblem = validateRepoPart(r, "repo");
    if (repoProblem !== null)
        return { ok: false, message: repoProblem };
    return { ok: true, ref: { owner: o, repo: r } };
}
/**
 * Validate a repository-relative path for the contents endpoint. Empty is
 * valid (repository root); ".."/"." segments and control characters are
 * rejected so the path can never escape the requested repository.
 *
 * @param path - the trimmed path argument.
 * @returns a human-readable problem, or `null` when the path is safe.
 */
export function validateGithubPath(path) {
    if (path.length === 0)
        return null;
    if (path.length > GITHUB_ARG_MAX_LENGTH)
        return `path is too long (max ${GITHUB_ARG_MAX_LENGTH} chars)`;
    if (/[\0\r\n]/.test(path))
        return "path contains control characters";
    if (path.split("/").some((segment) => segment === "." || segment === "..")) {
        return 'path must not contain "." or ".." segments';
    }
    return null;
}
/** Repository metadata endpoint. */
export function githubRepoUrl(owner, repo) {
    return `${GITHUB_API_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}
/** Contents endpoint: directory listing or single file, with optional ref. */
export function githubContentsUrl(owner, repo, path, ref) {
    const base = `${GITHUB_API_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split("/").map(encodeURIComponent).join("/")}`;
    return ref !== void 0 && ref !== "" ? `${base}?ref=${encodeURIComponent(ref)}` : base;
}
/** Repository search endpoint. */
export function githubSearchUrl(query, perPage) {
    return `${GITHUB_API_URL}/search/repositories?q=${encodeURIComponent(query)}&per_page=${perPage}`;
}
/** Releases endpoint. */
export function githubReleasesUrl(owner, repo, perPage) {
    return `${GITHUB_API_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases?per_page=${perPage}`;
}
/**
 * Request headers for one GitHub REST call. The token is optional: without
 * it the call is unauthenticated (60 req/h/IP), with it the standard Bearer
 * auth applies. The API version pin is the documented 2022-11-28.
 *
 * @param token - the resolved settings token ("" = unauthenticated).
 * @returns the header map.
 */
export function githubHeaders(token) {
    const headers = {
        "accept": "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "better-deepseek-harness"
    };
    if (token !== "")
        headers["authorization"] = `Bearer ${token}`;
    return headers;
}
/**
 * Map a `GET /repos/{owner}/{repo}` response to the normalized info. Sparse
 * or malformed bodies degrade to defaults (empty fullName, "main" branch)
 * instead of crashing the conversation.
 *
 * @param json - the parsed response body.
 * @returns the normalized repository info.
 */
export function mapGithubRepoResponse(json) {
    const body = typeof json === "object" && json !== null ? json : {};
    const fullName = typeof body.full_name === "string" ? body.full_name : "";
    const license = typeof body.license === "object" && body.license !== null
        && typeof body.license.spdx_id === "string"
        ? body.license.spdx_id
        : void 0;
    return {
        fullName,
        htmlUrl: typeof body.html_url === "string" ? body.html_url : `https://github.com/${fullName}`,
        ...(typeof body.description === "string" && body.description.length > 0 ? { description: body.description } : {}),
        defaultBranch: typeof body.default_branch === "string" && body.default_branch !== "" ? body.default_branch : "main",
        stars: typeof body.stargazers_count === "number" ? body.stargazers_count : 0,
        forks: typeof body.forks_count === "number" ? body.forks_count : 0,
        openIssues: typeof body.open_issues_count === "number" ? body.open_issues_count : 0,
        ...(typeof body.language === "string" && body.language.length > 0 ? { language: body.language } : {}),
        ...(license !== void 0 ? { license } : {}),
        topics: Array.isArray(body.topics) ? body.topics.filter((topic) => typeof topic === "string") : [],
        ...(typeof body.pushed_at === "string" && body.pushed_at.length > 0 ? { pushedAt: body.pushed_at } : {}),
        archived: body.archived === true
    };
}
/**
 * Map a `GET /repos/{owner}/{repo}/contents/{path}` response. The endpoint
 * returns a directory array or a single file object depending on the path;
 * this maps both into one discriminated result the tools branch on.
 *
 * File content arrives base64-encoded: it is decoded, capped at `cap` chars
 * (truncated content carries a marker), and NUL bytes mark the file as
 * binary (the caller decides how to surface that).
 *
 * @param json - the parsed response body.
 * @param cap - decoded content cap in chars.
 * @returns the discriminated contents result.
 */
export function mapGithubContentsResponse(json, cap = GITHUB_FILE_CONTENT_CAP) {
    if (Array.isArray(json)) {
        const entries = [];
        for (const entry of json) {
            if (entries.length >= GITHUB_TREE_ENTRIES_CAP)
                break;
            if (typeof entry !== "object" || entry === null)
                continue;
            const row = entry;
            const name = typeof row.name === "string" ? row.name : "";
            const type = row.type === "dir" ? "dir" : row.type === "file" ? "file" : void 0;
            if (name === "" || type === void 0)
                continue;
            const item = {
                name,
                path: typeof row.path === "string" && row.path !== "" ? row.path : name,
                type
            };
            if (typeof row.size === "number")
                item.size = row.size;
            if (typeof row.download_url === "string" && row.download_url.length > 0)
                item.downloadUrl = row.download_url;
            entries.push(item);
        }
        return { kind: "dir", entries, truncated: entries.length >= GITHUB_TREE_ENTRIES_CAP };
    }
    const body = typeof json === "object" && json !== null ? json : {};
    const content = typeof body.content === "string" ? body.content : "";
    const size = typeof body.size === "number" ? body.size : 0;
    let decoded = "";
    if (content !== "") {
        try {
            decoded = Buffer.from(content.replace(/\s/g, ""), "base64").toString("utf8");
        }
        catch { /* undecodable base64 — keep the empty string */ }
    }
    const binary = decoded.includes("\0");
    const truncated = decoded.length > cap;
    return {
        kind: "file",
        content: truncated || binary ? decoded.slice(0, cap) : decoded,
        size,
        truncated,
        binary
    };
}
/**
 * Map a `GET /search/repositories` response to the normalized result. Items
 * are capped at `cap`; malformed entries degrade to an empty list.
 *
 * @param json - the parsed response body.
 * @param cap - max items to keep.
 * @returns the normalized search result.
 */
export function mapGithubSearchResponse(json, cap = GITHUB_SEARCH_CAP) {
    const body = typeof json === "object" && json !== null ? json : {};
    const rawItems = Array.isArray(body.items) ? body.items : [];
    const items = [];
    for (const entry of rawItems) {
        if (items.length >= cap)
            break;
        if (typeof entry !== "object" || entry === null)
            continue;
        const row = entry;
        const fullName = typeof row.full_name === "string" ? row.full_name : "";
        if (fullName === "")
            continue;
        const item = {
            fullName,
            htmlUrl: typeof row.html_url === "string" ? row.html_url : `https://github.com/${fullName}`,
            stars: typeof row.stargazers_count === "number" ? row.stargazers_count : 0
        };
        if (typeof row.description === "string" && row.description.length > 0)
            item.description = row.description;
        if (typeof row.language === "string" && row.language.length > 0)
            item.language = row.language;
        items.push(item);
    }
    return { totalCount: typeof body.total_count === "number" ? body.total_count : items.length, items };
}
/**
 * Map a `GET /repos/{owner}/{repo}/releases` response to the normalized list.
 * Release bodies are capped at `bodyCap` chars; entries without a tag name
 * are dropped.
 *
 * @param json - the parsed response body.
 * @param cap - max releases to keep.
 * @param bodyCap - per-release body cap in chars.
 * @returns the normalized release list.
 */
export function mapGithubReleasesResponse(json, cap = GITHUB_RELEASES_CAP, bodyCap = GITHUB_RELEASE_BODY_CAP) {
    const raw = Array.isArray(json) ? json : [];
    const releases = [];
    for (const entry of raw) {
        if (releases.length >= cap)
            break;
        if (typeof entry !== "object" || entry === null)
            continue;
        const row = entry;
        const tagName = typeof row.tag_name === "string" ? row.tag_name : "";
        if (tagName === "")
            continue;
        const release = {
            tagName,
            htmlUrl: typeof row.html_url === "string" ? row.html_url : ""
        };
        if (typeof row.name === "string" && row.name.length > 0)
            release.name = row.name;
        if (typeof row.published_at === "string" && row.published_at.length > 0)
            release.publishedAt = row.published_at;
        if (typeof row.body === "string" && row.body.length > 0) {
            release.body = row.body.length > bodyCap ? row.body.slice(0, bodyCap) + "\n…[truncated]" : row.body;
        }
        releases.push(release);
    }
    return { releases };
}
/**
 * Map a failed GitHub API response into a model-facing error message. Known
 * statuses (401/403 rate limit/404) get actionable text; everything else
 * carries the API's own message when present.
 *
 * @param status - the HTTP status.
 * @param body - the parsed error body (any JSON value).
 * @param resource - the requested URL (named in 404 messages).
 * @returns the error message.
 */
export function githubErrorMessage(status, body, resource) {
    const detail = typeof body === "object" && body !== null && typeof body.message === "string"
        ? body.message
        : "";
    const base = `GitHub API error (HTTP ${status})`;
    const suffix = detail !== "" ? `: ${detail}` : "";
    if (status === 401) {
        return "GitHub API error (HTTP 401): the configured token is invalid or expired — check it in Settings → Better DeepSeek Harness → GitHub";
    }
    if (status === 403) {
        if (detail.toLowerCase().includes("rate limit")) {
            return "GitHub API rate limit exceeded — wait, or configure a token in Settings → Better DeepSeek Harness → GitHub";
        }
        return `${base}${suffix || ": access forbidden"}`;
    }
    if (status === 404) {
        return `GitHub API error (HTTP 404): ${resource} was not found (repository, path, branch, or tag does not exist)`;
    }
    return `${base}${suffix}`;
}
/** Format repository info as the model-facing text block. */
export function formatGithubRepoOutput(info) {
    const lines = [
        `${info.fullName}${info.archived ? " (archived)" : ""} — ${info.htmlUrl}`,
        `default branch: ${info.defaultBranch} | stars: ${info.stars} | forks: ${info.forks} | open issues: ${info.openIssues}`
    ];
    if (info.description !== void 0 && info.description.length > 0)
        lines.push(`description: ${info.description}`);
    const extra = [
        info.language !== void 0 ? `language: ${info.language}` : "",
        info.license !== void 0 ? `license: ${info.license}` : "",
        info.topics.length > 0 ? `topics: ${info.topics.join(", ")}` : "",
        info.pushedAt !== void 0 ? `last push: ${info.pushedAt}` : ""
    ].filter((part) => part !== "");
    if (extra.length > 0)
        lines.push(extra.join(" | "));
    lines.push("Cite the repository URL above as a markdown link in your answer.");
    return lines.join("\n");
}
/** Format a directory listing as the model-facing text block. */
export function formatGithubTreeOutput(result) {
    if (result.entries.length === 0)
        return "The directory is empty.";
    const lines = result.entries.map((entry) => {
        const size = entry.type === "file" && entry.size !== void 0 ? ` (${entry.size} bytes)` : "";
        return `${entry.type === "dir" ? "[dir] " : ""}${entry.path}${size}`;
    });
    if (result.truncated)
        lines.push(`…[listing truncated at ${GITHUB_TREE_ENTRIES_CAP} entries]`);
    return lines.join("\n");
}
/** Format file content as the model-facing text block (with truncation/binary notices). */
export function formatGithubFileOutput(result) {
    if (result.binary) {
        return `The file is binary (${result.size} bytes); showing the first ${GITHUB_FILE_CONTENT_CAP} bytes:\n\n${result.content}`;
    }
    if (result.truncated) {
        return `The file is larger than ${GITHUB_FILE_CONTENT_CAP} chars; showing the beginning:\n\n${result.content}`;
    }
    return result.content;
}
/** Format repository search results as the model-facing text block. */
export function formatGithubSearchOutput(result) {
    if (result.items.length === 0)
        return "No repositories found.";
    const lines = result.items.map((item) => {
        const label = item.description !== void 0 && item.description.length > 0
            ? `${item.fullName} — ${item.description}`
            : item.fullName;
        const meta = [item.language, item.stars > 0 ? `${item.stars} stars` : ""].filter((part) => part !== "").join(" | ");
        return `- [${label}](${item.htmlUrl})${meta !== "" ? ` (${meta})` : ""}`;
    });
    if (result.totalCount > result.items.length) {
        lines.push(`…and ${result.totalCount - result.items.length} more repositories (use a narrower query or a higher limit)`);
    }
    lines.push("Cite the repository URLs above as markdown links in your answer.");
    return lines.join("\n");
}
/** Format release lists as the model-facing text block. */
export function formatGithubReleasesOutput(result) {
    if (result.releases.length === 0)
        return "No releases found.";
    return result.releases.map((release) => {
        const title = release.name !== void 0 && release.name !== "" ? release.name : release.tagName;
        const meta = [release.tagName, release.publishedAt !== void 0 ? `published ${release.publishedAt}` : ""]
            .filter((part) => part !== "")
            .join(" — ");
        const body = release.body !== void 0 ? `\n${release.body}` : "";
        return `- [${title}](${release.htmlUrl}) (${meta})${body}`;
    }).join("\n\n");
}
