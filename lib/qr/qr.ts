/**
 * QR codes for Vurlo short links. The code always encodes the short URL
 * (never the destination), so scans go through the redirect like any other
 * visit. Pure functions: usable in the browser and in tests.
 */
import { encode } from "uqr";

/** The spec's recommended quiet zone: 4 light modules on every side. */
export const QR_QUIET_ZONE = 4;
/** Long edge of the downloaded PNG, in pixels (rounded down to whole modules). */
export const QR_PNG_TARGET = 1024;

export interface QrCode {
  /** Modules per side, quiet zone included. */
  size: number;
  /** `true` = dark module. Quiet zone included. */
  modules: boolean[][];
  /** One SVG path (unit = one module) drawing every dark module. */
  path: string;
}

export class QrError extends Error {
  constructor(public readonly reason: "missing_url" | "generation_failed") {
    super(reason);
  }
}

/** Only absolute http(s) URLs are encoded. */
export function isQrEncodable(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

/** True for addresses that only work on the developer's own machine. */
export function isLocalUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === "localhost" || hostname === "[::1]" || /^127\./.test(hostname) || hostname.endsWith(".local");
  } catch {
    return false;
  }
}

// Short URLs don't change, so each is encoded once per page load.
const cache = new Map<string, QrCode>();
const CACHE_LIMIT = 50;

/** Encodes `url` (error correction M: scans reliably even when a little damaged). */
export function getQrCode(url: string): QrCode {
  if (!isQrEncodable(url)) throw new QrError("missing_url");
  const hit = cache.get(url);
  if (hit) return hit;

  let modules: boolean[][];
  try {
    modules = encode(url, { ecc: "M", border: QR_QUIET_ZONE }).data;
  } catch {
    throw new QrError("generation_failed");
  }
  if (!modules.length || modules.some((row) => row.length !== modules.length)) {
    throw new QrError("generation_failed");
  }

  const code: QrCode = { size: modules.length, modules, path: toPath(modules) };
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  cache.set(url, code);
  return code;
}

/** Horizontal runs of dark modules become one rectangle each: small and exact. */
function toPath(modules: boolean[][]): string {
  const parts: string[] = [];
  modules.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (!row[x]) continue;
      const start = x;
      while (x + 1 < row.length && row[x + 1]) x++;
      const run = x - start + 1;
      parts.push(`M${start} ${y}h${run}v1h-${run}z`);
    }
  });
  return parts.join("");
}

const escapeXml = (text: string) =>
  text.replace(/[<>&"']/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[ch]!);

/**
 * A standalone, vector SVG file (no embedded raster). One module = one user
 * unit, drawn at 16px per module by default and scaling cleanly to any size.
 */
export function qrSvg(code: QrCode, url: string): string {
  const px = code.size * 16;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${code.size} ${code.size}" width="${px}" height="${px}" shape-rendering="crispEdges" role="img">`,
    `<title>QR code for ${escapeXml(url)}</title>`,
    `<rect width="${code.size}" height="${code.size}" fill="#ffffff"/>`,
    `<path d="${code.path}" fill="#000000"/>`,
    "</svg>",
    "",
  ].join("\n");
}

/** Pixels per module for the PNG: the largest whole number that fits the target. */
export function pngScale(code: QrCode, target = QR_PNG_TARGET): number {
  return Math.max(1, Math.floor(target / code.size));
}

/** `vurlo-qr-summer-sale.png`: names the link, safe on every file system. */
export function qrFilename(slug: string, extension: "png" | "svg"): string {
  const safe = slug.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return `vurlo-qr-${safe || "link"}.${extension}`;
}
