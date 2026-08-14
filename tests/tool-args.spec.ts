import { describe, it, expect } from "vitest";
import { tryParseJsonObject, repairToolArguments } from "../src/tool-args.js";
import type { RepairPolicy, ToolParameters } from "../src/tool-args.js";

const policy: RepairPolicy = { enabled: true, descriptionFill: "Execute tool" };
const schema = (properties?: Record<string, unknown>): ToolParameters => ({ type: "object", properties });

describe("tryParseJsonObject", () => {
  it("parses an already-valid object string", () => {
    expect(tryParseJsonObject('{"a": 1}')).toEqual({ a: 1 });
  });

  it("returns undefined for empty or whitespace-only input", () => {
    expect(tryParseJsonObject("")).toBeUndefined();
    expect(tryParseJsonObject("   ")).toBeUndefined();
  });

  it("rejects JSON that is not an object (array, null, number)", () => {
    expect(tryParseJsonObject("[1, 2]")).toBeUndefined();
    expect(tryParseJsonObject("null")).toBeUndefined();
    expect(tryParseJsonObject("42")).toBeUndefined();
  });

  it("returns undefined for a string without braces", () => {
    expect(tryParseJsonObject("just prose")).toBeUndefined();
  });

  it("recovers a truncated object by closing its brace", () => {
    expect(tryParseJsonObject('{"a": 1')).toEqual({ a: 1 });
  });

  it("strips surrounding prose", () => {
    expect(tryParseJsonObject('Here you go: {"a": 1} thanks')).toEqual({ a: 1 });
  });

  it("drops trailing commas", () => {
    expect(tryParseJsonObject('{"a": 1,}')).toEqual({ a: 1 });
  });

  it("recovers a truncated object that also has a trailing comma", () => {
    expect(tryParseJsonObject('{"a": 1,')).toEqual({ a: 1 });
  });

  it("parses nested objects", () => {
    expect(tryParseJsonObject('{"a": {"b": [1, 2]}}')).toEqual({ a: { b: [1, 2] } });
  });

  it("handles a } inside a string value", () => {
    expect(tryParseJsonObject('{"a": "x}y"}')).toEqual({ a: "x}y" });
  });

  it("gives up on interleaved garbage between braces", () => {
    expect(tryParseJsonObject('foo {"b": 2} bar {"a": 1}')).toBeUndefined();
  });
});

describe("repairToolArguments", () => {
  it("passes arguments through untouched when the policy is absent", () => {
    const args = { code: "echo hi" };
    const result = repairToolArguments(schema({ code: { type: "string" } }), args, null);
    expect(result.changed).toBe(false);
    expect(result.arguments).toBe(args);
  });

  it("passes arguments through untouched when repair is disabled", () => {
    const args = { code: "echo hi" };
    const result = repairToolArguments(schema(), args, { enabled: false, descriptionFill: "x" });
    expect(result.changed).toBe(false);
    expect(result.arguments).toBe(args);
  });

  it("fills a missing description declared by the schema", () => {
    const args = { code: "echo hi" };
    const result = repairToolArguments(schema({ code: { type: "string" }, description: { type: "string" } }), args, policy);
    expect(result.changed).toBe(true);
    expect(result.arguments).toEqual({ code: "echo hi", description: "Execute tool" });
    expect(args).toEqual({ code: "echo hi" }); // original never mutates
  });

  it("replaces an empty or whitespace description", () => {
    const s = schema({ description: { type: "string" } });
    expect(repairToolArguments(s, { description: "   " }, policy).arguments).toEqual({ description: "Execute tool" });
  });

  it("replaces a wrongly-typed description", () => {
    const s = schema({ description: { type: "string" } });
    expect(repairToolArguments(s, { description: 42 }, policy).arguments).toEqual({ description: "Execute tool" });
  });

  it("keeps a present non-empty description", () => {
    const args = { description: "Runs it" };
    const result = repairToolArguments(schema({ description: { type: "string" } }), args, policy);
    expect(result.changed).toBe(false);
    expect(result.arguments).toBe(args);
  });

  it("does nothing when the schema has no description property", () => {
    const args = { code: "echo hi" };
    const result = repairToolArguments(schema({ code: { type: "string" } }), args, policy);
    expect(result.changed).toBe(false);
    expect(result.arguments).toBe(args);
  });

  it("does nothing when the schema is absent", () => {
    const args = { code: "echo hi" };
    expect(repairToolArguments(undefined, args, policy).changed).toBe(false);
    expect(repairToolArguments(null, args, policy).arguments).toBe(args);
  });

  it("recovers a malformed string and reports the change", () => {
    const result = repairToolArguments(schema({ code: { type: "string" } }), '{"code": "echo hi"', policy);
    expect(result.changed).toBe(true);
    expect(result.arguments).toEqual({ code: "echo hi" });
  });

  it("recovers a string and then fills the description", () => {
    const s = schema({ code: { type: "string" }, description: { type: "string" } });
    const result = repairToolArguments(s, '{"code": "echo hi"', policy);
    expect(result.changed).toBe(true);
    expect(result.arguments).toEqual({ code: "echo hi", description: "Execute tool" });
  });

  it("keeps an unrecoverable string untouched", () => {
    const result = repairToolArguments(schema(), "garbage", policy);
    expect(result.changed).toBe(false);
    expect(result.arguments).toBe("garbage");
  });

  it("passes non-object arguments through (null, array, number)", () => {
    expect(repairToolArguments(schema(), null, policy).arguments).toBeNull();
    expect(repairToolArguments(schema(), [1, 2], policy).changed).toBe(false);
    expect(repairToolArguments(schema(), 7, policy).arguments).toBe(7);
  });
});
