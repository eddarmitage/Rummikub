// Only ever redirect back into this same app — never follow an absolute/external returnTo.
// Beyond the obvious `https://evil.com` and protocol-relative `//evil.com`, this also rejects
// any backslash: browsers normalise `\` to `/` when resolving a `Location` header, so
// `/\evil.com` and `/\/evil.com` would otherwise resolve to `https://evil.com/` too.
export function sanitizeReturnTo(returnTo: string): string {
  return returnTo.startsWith("/") && !returnTo.startsWith("//") && !returnTo.includes("\\")
    ? returnTo
    : "/";
}
