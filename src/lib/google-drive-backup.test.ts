import { describe, expect, it } from "vitest";
import { decryptRefreshToken, encryptRefreshToken } from "@/lib/google-drive-backup";

describe("Google Drive backup token encryption", () => {
  it("encrypts and decrypts a refresh token without storing plaintext", () => {
    const secret = "test-encryption-key-that-is-long-enough";
    const first = encryptRefreshToken("refresh-token", secret);
    const second = encryptRefreshToken("refresh-token", secret);
    expect(first).not.toContain("refresh-token");
    expect(first).not.toBe(second);
    expect(decryptRefreshToken(first, secret)).toBe("refresh-token");
  });

  it("rejects decryption with another key", () => {
    const encrypted = encryptRefreshToken("refresh-token", "first-encryption-key-that-is-long-enough");
    expect(() => decryptRefreshToken(encrypted, "second-encryption-key-that-is-long-enough")).toThrow();
  });
});
