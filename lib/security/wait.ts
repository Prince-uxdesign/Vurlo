/**
 * Retry timing people can act on: "30 seconds", "1 minute", "12 minutes".
 * Never exposes how limits work, only how long to wait.
 */
export function waitPhrase(seconds: number): string {
  if (seconds < 60) {
    const s = Math.max(5, Math.ceil(seconds / 5) * 5);
    return `${s} seconds`;
  }
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}
