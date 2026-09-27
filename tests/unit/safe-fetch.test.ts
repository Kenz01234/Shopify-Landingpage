import { describe, expect, it } from "vitest";
import { assertSafeUrl, isPrivateAddress } from "@/lib/safe-fetch";
import { encryptJson, decryptJson, signPayload, verifySignature } from "@/lib/crypto";

describe("Externe URLs", () => {
  it("erkennt private und lokale Adressen", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "::1", "fd00::1", "::ffff:10.0.0.1", "0.0.0.0"]) expect(isPrivateAddress(ip)).toBe(true);
    for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700::1111"]) expect(isPrivateAddress(ip)).toBe(false);
  });
  it("lehnt unsichere URLs ab", async () => {
    await expect(assertSafeUrl("http://cdn.example.com/a.mp4", ["cdn.example.com"])).rejects.toThrow(/https/);
    await expect(assertSafeUrl("https://evil.example.org/a.mp4", ["cdn.example.com"])).rejects.toThrow(/nicht freigegeben/);
    await expect(assertSafeUrl("https://127.0.0.1/a.mp4", ["127.0.0.1"])).rejects.toThrow(/Private/);
    await expect(assertSafeUrl("https://u:p@cdn.example.com/a.mp4", ["cdn.example.com"])).rejects.toThrow(/Zugangsdaten/);
  });
});

describe("Kryptografie-Helfer", () => {
  it("verschlüsselt und entschlüsselt Zugangsdaten (AES-256-GCM)", () => {
    const sealed = encryptJson({ refresh_token: "geheim" });
    expect(sealed).not.toContain("geheim");
    expect(decryptJson<{ refresh_token: string }>(sealed).refresh_token).toBe("geheim");
    const tampered = sealed.slice(0, -4) + (sealed.endsWith("A") ? "BBBB" : "AAAA");
    expect(() => decryptJson(tampered)).toThrow();
  });
  it("prüft HMAC-Signaturen mit Zeitfenster", () => {
    const ts = Math.floor(Date.now() / 1000).toString();
    const sig = signPayload("s3cret", ts, '{"a":1}');
    expect(verifySignature("s3cret", ts, '{"a":1}', `sha256=${sig}`)).toBe(true);
    expect(verifySignature("s3cret", ts, '{"a":2}', `sha256=${sig}`)).toBe(false);
    expect(verifySignature("s3cret", String(Number(ts) - 3600), '{"a":1}', signPayload("s3cret", String(Number(ts) - 3600), '{"a":1}'))).toBe(false);
  });
});
