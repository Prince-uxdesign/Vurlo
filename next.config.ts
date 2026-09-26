import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

function originOf(value: string | undefined): string | null {
  try {
    return value ? new URL(value).origin : null;
  } catch {
    return null;
  }
}

const supabaseOrigin = originOf(process.env.NEXT_PUBLIC_SUPABASE_URL);

/**
 * Content-Security-Policy, kept to what this app actually loads:
 * - Scripts only from our origin. 'unsafe-inline' stays because Next's
 *   hydration uses inline scripts and a nonce would force every page
 *   (including the static marketing page) to render dynamically; React's
 *   escaping is the XSS defence, this blocks any third-party script source.
 *   Dev adds 'unsafe-eval' for React's debugging tools.
 * - Styles: Tailwind output plus inline style attributes (bar widths).
 * - Images: ours, plus data:/blob: for QR previews and downloads.
 * - Fonts: next/font self-hosts, so 'self'.
 * - connect-src: our API only (the browser never talks to Supabase; dev
 *   adds the websocket for hot reload).
 * - form-action: our server actions, plus Supabase and Google because the
 *   no-JavaScript Google sign-in form is redirected there.
 * - frame-ancestors 'none': no one can frame the dashboard to clickjack
 *   Delete/Disable (X-Frame-Options below covers older browsers).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  `form-action 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ""} https://accounts.google.com`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Don't guess content types (a user-controlled string can't be sniffed into HTML/JS).
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  // Destinations learn a visitor came via Vurlo's origin, never a dashboard path or query.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Features Vurlo never uses. Clipboard and Web Share (used for copy/QR) stay allowed.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
  // HTTPS only for two years. No `preload`: that's a hard-to-undo commitment
  // for the whole domain, so it's left as a deliberate launch decision.
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Every action here takes a few short fields (the biggest is a 2,048-char
    // destination). 1MB default -> 32kb: oversized bodies are refused by the
    // framework before any action code or database work.
    serverActions: { bodySizeLimit: "32kb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
