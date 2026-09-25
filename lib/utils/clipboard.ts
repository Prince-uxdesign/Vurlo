/**
 * Copies text, trying the async Clipboard API first and falling back to the
 * legacy `execCommand("copy")` (older Safari, non-secure origins, some in-app
 * browsers). Must be called from a user gesture. Resolves false only when
 * every method failed, so the caller can offer manual copying instead.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission denied or unsupported: try the fallback below.
  }
  return legacyCopy(text);
}

function legacyCopy(text: string): boolean {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  // Off-screen but still selectable; 16px avoids iOS zooming on focus.
  area.style.cssText = "position:fixed;top:0;left:-9999px;opacity:0;font-size:16px";
  const active = document.activeElement as HTMLElement | null;
  document.body.appendChild(area);
  try {
    area.select();
    area.setSelectionRange(0, text.length); // iOS ignores select()
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
    active?.focus({ preventScroll: true });
  }
}
