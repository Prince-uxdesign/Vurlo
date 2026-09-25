/** Browser-only helpers for saving QR files. */
import { pngScale, qrSvg } from "./qr";
import type { QrCode } from "./qr";

/** Draws the code module by module on a canvas: exact edges, no smoothing. */
export function qrPngBlob(code: QrCode): Promise<Blob> {
  const scale = pngScale(code);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = code.size * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("canvas unavailable"));
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000000";
  code.modules.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) ctx.fillRect(x * scale, y * scale, scale, scale);
    }),
  );
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("png encoding failed"))), "image/png"),
  );
}

export function qrSvgBlob(code: QrCode, url: string): Blob {
  return new Blob([qrSvg(code, url)], { type: "image/svg+xml;charset=utf-8" });
}

/** Saves a blob under `filename` via a temporary object URL. */
export function saveBlob(blob: Blob, filename: string): void {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke later: some browsers read the URL after click() returns.
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}
