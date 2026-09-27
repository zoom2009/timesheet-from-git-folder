import { describe, expect, test } from "bun:test";
import { buildLogArgs, parseAuthorEmails } from "./git-scan";

describe("parseAuthorEmails", () => {
  test("splits, trims and drops empty entries", () => {
    expect(parseAuthorEmails(" a@x.com , b@y.com ,, ")).toEqual(["a@x.com", "b@y.com"]);
  });

  test("empty string gives no emails", () => {
    expect(parseAuthorEmails("")).toEqual([]);
  });
});

describe("buildLogArgs", () => {
  test("adds one --author flag per email", () => {
    const args = buildLogArgs("/repo", ["a@x.com", "b@y.com"]);
    expect(args.filter((arg) => arg === "--author")).toHaveLength(2);
    expect(args).toContain("a@x.com");
  });

  test("no emails means no author filter", () => {
    expect(buildLogArgs("/repo", [])).not.toContain("--author");
  });
});
