import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

const { generateApiKey, hashApiKey } = await import("./api-key");

describe("api keys", () => {
  it("generates a prefixed random key whose hash matches", () => {
    const { key, prefix, hash } = generateApiKey();
    expect(key.startsWith("rly_")).toBe(true);
    expect(key.length).toBeGreaterThan(40);
    expect(prefix).toBe(key.slice(0, 12));
    expect(hash).toBe(hashApiKey(key));
    expect(hash).not.toContain(key);
  });

  it("never repeats", () => {
    expect(generateApiKey().key).not.toBe(generateApiKey().key);
  });

  it("hashes deterministically to 64 hex characters", () => {
    expect(hashApiKey("rly_x")).toBe(hashApiKey("rly_x"));
    expect(hashApiKey("rly_x")).toMatch(/^[0-9a-f]{64}$/);
  });
});
