import { describe, expect, it } from "vitest";
import { isConfigured, parseProjectUrl } from "./storage";

describe("parseProjectUrl", () => {
  it("ユーザーの Project", () => {
    expect(parseProjectUrl("https://github.com/users/alice/projects/1")).toEqual({
      owner: "alice",
      number: 1,
      type: "user",
    });
  });

  it("Organization の Project（ビューの URL でもよい）", () => {
    expect(parseProjectUrl("https://github.com/orgs/acme/projects/12/views/3")).toEqual({
      owner: "acme",
      number: 12,
      type: "org",
    });
  });

  it("Project 以外の URL は null", () => {
    expect(parseProjectUrl("https://github.com/acme/repo")).toBeNull();
    expect(parseProjectUrl("")).toBeNull();
  });
});

describe("isConfigured", () => {
  const projectUrl = "https://github.com/users/alice/projects/1";

  it("トークンと Project の URL がそろっていれば true", () => {
    expect(isConfigured({ githubToken: "ghp_x", projectUrl })).toBe(true);
  });

  it("トークンが空、URL が空、URL の形式が違うときは false", () => {
    expect(isConfigured({ githubToken: "", projectUrl })).toBe(false);
    expect(isConfigured({ githubToken: "  ", projectUrl })).toBe(false);
    expect(isConfigured({ githubToken: "ghp_x", projectUrl: "" })).toBe(false);
    expect(isConfigured({ githubToken: "ghp_x", projectUrl: "https://github.com/acme/repo" })).toBe(
      false,
    );
  });
});
