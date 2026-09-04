import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "../../src/frontend/lib/clipboard";

// jsdom doesn't implement `document.execCommand`, so there's nothing to spy on — assign it.
function stubExecCommand(result: boolean) {
  const execCommand = vi.fn().mockReturnValue(result);
  Object.defineProperty(document, "execCommand", { value: execCommand, configurable: true, writable: true });
  return execCommand;
}

describe("copyText", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(document, "execCommand");
  });

  it("uses the async Clipboard API when it's available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const execCommand = stubExecCommand(true);

    await expect(copyText("https://example.com/g/abc")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("https://example.com/g/abc");
    expect(execCommand).not.toHaveBeenCalled();
  });

  // The case that made "Share link" silently do nothing: on a plain-HTTP LAN origin — the
  // standalone Docker deployment — `navigator.clipboard` is undefined because it isn't a
  // secure context, so the property access throws rather than rejecting.
  it("falls back to execCommand when the Clipboard API is missing (insecure context)", async () => {
    vi.stubGlobal("navigator", {});
    const execCommand = stubExecCommand(true);

    await expect(copyText("http://192.168.0.10:8080/g/abc")).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  it("falls back to execCommand when the Clipboard API rejects (denied permission)", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    const execCommand = stubExecCommand(true);

    await expect(copyText("https://example.com/g/abc")).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  it("reports failure when no copy path works, so the caller can show the URL instead", async () => {
    vi.stubGlobal("navigator", {});
    stubExecCommand(false);

    await expect(copyText("http://192.168.0.10:8080/g/abc")).resolves.toBe(false);
  });

  it("leaves no scratch textarea behind, whichever way it goes", async () => {
    vi.stubGlobal("navigator", {});
    stubExecCommand(false);

    await copyText("http://192.168.0.10:8080/g/abc");

    expect(document.querySelectorAll("textarea")).toHaveLength(0);
  });
});
