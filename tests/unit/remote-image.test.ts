import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { assertPublicUrl, isPrivateIp, pageImage, sniff } = await import("@/lib/remote-image");

describe("fotos desde un enlace", () => {
  it("rechaza direcciones internas", async () => {
    for (const bad of ["http://127.0.0.1/a.jpg", "http://localhost/a.jpg", "https://10.0.0.5/x", "http://169.254.169.254/latest", "http://[::1]/x", "ftp://example.com/a.jpg", "https://user:pass@example.com/a.jpg", "https://example.com:8080/a.jpg"]) {
      await expect(assertPublicUrl(bad)).rejects.toThrow();
    }
    expect(isPrivateIp("192.168.1.10")).toBe(true);
    expect(isPrivateIp("::ffff:10.1.2.3")).toBe(true);
    expect(isPrivateIp("fd00::1")).toBe(true);
    expect(isPrivateIp("8.8.8.8")).toBe(false);
  });

  it("acepta una dirección pública escrita con números", async () => {
    await expect(assertPublicUrl("https://8.8.8.8/a.jpg")).resolves.toBeInstanceOf(URL);
  });

  it("reconoce el tipo de foto por sus primeros bytes", () => {
    expect(sniff(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe("image/jpeg");
    expect(sniff(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe("image/png");
    expect(sniff(new TextEncoder().encode("<html><body>hola</body></html>"))).toBeNull();
  });

  it("encuentra la foto principal de una página", () => {
    const html = '<head><meta property="og:image" content="/fotos/a.jpg?x=1&amp;y=2"></head>';
    expect(pageImage(html, new URL("https://tienda.com/p/1"))).toBe("https://tienda.com/fotos/a.jpg?x=1&y=2");
    expect(pageImage("<head></head>", new URL("https://tienda.com"))).toBeNull();
  });
});
