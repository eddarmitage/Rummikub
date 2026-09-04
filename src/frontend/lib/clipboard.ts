/**
 * Copies `text` to the clipboard, reporting whether it actually worked.
 *
 * `navigator.clipboard` is only exposed in a **secure context** — HTTPS, plus the
 * `http://localhost` / `http://127.0.0.1` special cases. The standalone Docker build (README
 * "Docker (self-hosted, no-auth)") is normally reached over plain HTTP on a LAN address like
 * `http://192.168.0.10:8080`, which is *not* a secure context: `navigator.clipboard` is
 * `undefined` there, so `writeText` throws a TypeError. That's precisely the deployment where
 * sharing a scorecard link matters most — several phones round one table — hence the
 * `execCommand` fallback below. It's deprecated, but it's the only copy path that works on an
 * insecure origin, and callers can act on `false` rather than appearing to do nothing.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Missing API (insecure context) or a denied permission — try the legacy path before
    // giving up.
  }
  return copyViaExecCommand(text);
}

function copyViaExecCommand(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  // Off-screen rather than hidden: `display: none` / `visibility: hidden` makes the element
  // unselectable, and without a selection there's nothing for `copy` to act on.
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  document.body.appendChild(textarea);

  try {
    textarea.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}
