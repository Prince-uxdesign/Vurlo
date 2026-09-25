import assert from "node:assert/strict";
import { describe, it } from "node:test";
import jsQR from "jsqr";
import { QR_QUIET_ZONE, QrError, getQrCode, isLocalUrl, isQrEncodable, pngScale, qrFilename, qrSvg } from "@/lib/qr/qr";
import type { QrCode } from "@/lib/qr/qr";

/** Rasterizes a code (as the PNG download does) and reads it back with an independent decoder. */
function decode(code: QrCode, scale = 4): string | null {
  const px = code.size * scale;
  const rgba = new Uint8ClampedArray(px * px * 4);
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      const v = code.modules[Math.floor(y / scale)]![Math.floor(x / scale)] ? 0 : 255;
      rgba.set([v, v, v, 255], (y * px + x) * 4);
    }
  }
  return jsQR(rgba, px, px)?.data ?? null;
}

/** Rebuilds the module grid from the SVG path, proving the vector drawing matches the code. */
function modulesFromPath(path: string, size: number): boolean[][] {
  const grid = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  for (const [, x, y, run] of path.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    for (let i = 0; i < Number(run); i++) grid[Number(y)]![Number(x) + i] = true;
  }
  return grid;
}

describe("QR encoding", () => {
  const urls = [
    "https://vurlo.app/summer",
    "https://vurlo.app/abc1234",
    "https://vurlo.app/abcdefghij-abcdefghij-abcdefghij",
    "http://localhost:3111/x_y-z",
  ];

  it("encodes exactly the short URL (decoded by an independent reader)", () => {
    for (const url of urls) assert.equal(decode(getQrCode(url)), url);
  });

  it("includes a 4-module light quiet zone on every side", () => {
    const { modules, size } = getQrCode(urls[0]!);
    for (let i = 0; i < size; i++) {
      for (let q = 0; q < QR_QUIET_ZONE; q++) {
        assert.equal(modules[q]![i], false);
        assert.equal(modules[size - 1 - q]![i], false);
        assert.equal(modules[i]![q], false);
        assert.equal(modules[i]![size - 1 - q], false);
      }
    }
    assert.equal(modules[QR_QUIET_ZONE]![QR_QUIET_ZONE], true, "finder pattern corner starts right after the quiet zone");
  });

  it("caches per URL (no re-encoding for the same link)", () => {
    assert.equal(getQrCode(urls[1]!), getQrCode(urls[1]!));
    assert.notEqual(getQrCode(urls[0]!), getQrCode(urls[1]!));
  });

  it("refuses to encode missing or non-web URLs, with a typed reason", () => {
    for (const bad of ["", "vurlo.app/x", "javascript:alert(1)", "ftp://vurlo.app/x"]) {
      assert.throws(() => getQrCode(bad), (e: unknown) => e instanceof QrError && e.reason === "missing_url");
      assert.equal(isQrEncodable(bad), false);
    }
    assert.equal(isQrEncodable(null), false);
  });
});

describe("QR files", () => {
  const url = "https://vurlo.app/q&a";
  const code = getQrCode(url);
  const svg = qrSvg(code, url);

  it("SVG is vector-only, well-formed and self-describing", () => {
    assert.match(svg, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(svg, new RegExp(`viewBox="0 0 ${code.size} ${code.size}"`));
    assert.doesNotMatch(svg, /<image|data:|base64|href=/, "no embedded raster");
    assert.match(svg, /<title>QR code for https:\/\/vurlo\.app\/q&amp;a<\/title>/, "text is XML-escaped");
    assert.equal((svg.match(/<svg/g) ?? []).length, 1);
    assert.match(svg.trim(), /<\/svg>$/);
    // Every tag opened is closed or self-closing.
    const open = [...svg.matchAll(/<(svg|title)\b/g)].length;
    const close = [...svg.matchAll(/<\/(svg|title)>/g)].length;
    assert.equal(open, close);
  });

  it("the SVG path draws exactly the encoded modules", () => {
    const rebuilt = modulesFromPath(code.path, code.size);
    assert.deepEqual(rebuilt, code.modules);
    assert.equal(decode({ ...code, modules: rebuilt }), url);
  });

  it("PNG scale gives whole-pixel modules near 1024px", () => {
    const scale = pngScale(code);
    assert.ok(Number.isInteger(scale) && scale >= 20);
    assert.ok(code.size * scale <= 1024 && code.size * scale > 900, `${code.size * scale}px`);
  });

  it("filenames name the link and are safe everywhere", () => {
    assert.equal(qrFilename("summer-sale", "png"), "vurlo-qr-summer-sale.png");
    assert.equal(qrFilename("Weird/../Name?", "svg"), "vurlo-qr-weird-name.svg");
    assert.equal(qrFilename("", "png"), "vurlo-qr-link.png");
  });

  it("flags local development addresses", () => {
    assert.equal(isLocalUrl("http://localhost:3000/x"), true);
    assert.equal(isLocalUrl("http://127.0.0.1:3000/x"), true);
    assert.equal(isLocalUrl("https://vurlo.app/x"), false);
  });
});
