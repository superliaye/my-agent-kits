#!/usr/bin/env python3
"""
a11y_readback.py — Tier-2 OS-native accessibility read-back for desktop-app-loop.

Reads STRUCTURED UI state from a foreign desktop app WITHOUT a debug port, via
the operating system's accessibility provider:

  * Windows -> UI Automation (pywinauto `uia` backend). Chromium/Electron 138+
    exposes its ARIA tree through native UIA, so a `role="combobox"` div surfaces
    as a ComboBox with selectable ListItems carrying SelectionItem.IsSelected.
  * macOS   -> the AX API (PyObjC). The Chromium renderer a11y tree is built
    lazily; this forces it by setting AXManualAccessibility=true on the app
    element, then walks AXChildren. (UNVERIFIED on a Mac in this build — see
    NOTE in _mac_*; the Windows path is the validated one.)

Both paths emit a uniform JSON shape so callers don't branch on OS.

The Chromium accessibility tree is built LAZILY. A naive scrape of a fresh window
may see only a ~9-node skeleton. This helper acts as a UIA/AX client (which is
the activation signal), then POLLS until the node count stops growing. Always
open a dropdown/menu BEFORE reading it — collapsed popups don't populate.

Verbs
  dump      Walk the target window subtree -> {window, count, elements:[...]}.
  selected  Report selected item(s), filtered by --name-re / --control-type.

Examples
  python a11y_readback.py dump     --title-re "(?i)codex" --out tree.json
  python a11y_readback.py dump     --title-re "(?i)codex" --control-type ComboBox
  python a11y_readback.py selected --title-re "(?i)codex" --name-re "(?i)theme"

Exit codes: 0 ok | 2 no matching window | 3 dependency missing | 4 read error.
"""
import argparse
import json
import platform
import re
import sys
import time


def _eprint(*a):
    print(*a, file=sys.stderr)


def _re_search(pattern, text):
    try:
        return re.search(pattern, text or "") is not None
    except re.error:
        return pattern.lower() in (text or "").lower()


def _passes(info, name_re, control_type):
    if name_re and not _re_search(name_re, info.get("name", "")):
        return False
    if control_type and (info.get("control_type") or "").lower() != control_type.lower():
        return False
    return True


# --------------------------------------------------------------------------- #
# Windows — UI Automation via pywinauto                                        #
# --------------------------------------------------------------------------- #
def _win_find_window(title_re, pid):
    from pywinauto import Desktop
    desktop = Desktop(backend="uia")
    candidates = []
    for w in desktop.windows():
        try:
            text = w.window_text()
            wpid = w.process_id()
        except Exception:
            continue
        if pid and wpid != pid:
            continue
        if title_re and not _re_search(title_re, text):
            continue
        candidates.append((w, text, wpid))
    if not candidates:
        return None, None

    # Prefer the largest window (the real app, not a tooltip/popup) — cheap proxy
    # for "the main window" without walking every candidate's full subtree.
    def _area(c):
        try:
            r = c[0].rectangle()
            return (r.right - r.left) * (r.bottom - r.top)
        except Exception:
            return 0

    candidates.sort(key=_area, reverse=True)
    return candidates[0][0], candidates[0][2]


def _win_force_accessibility(pid):
    """Convince Chromium/Electron to build its lazy renderer a11y tree.

    Two signals, applied together: (1) the system screen-reader flag, and (2)
    binding an MSAA IAccessible to each Chrome_RenderWidgetHostHWND of the target
    process. Returns the prior screen-reader flag so the caller can restore it.

    NOTE: hardened apps (e.g. Codex) ignore BOTH and expose only a ~9-node
    skeleton until relaunched with --force-renderer-accessibility. For those,
    Tier 2 needs the relaunch flag (see SKILL.md); this best-effort poke is for
    apps that activate at runtime (VS Code, Slack, etc.).
    """
    import ctypes
    from ctypes import byref, POINTER
    import win32gui
    import win32con
    import win32process

    SPI_GETSCREENREADER, SPI_SETSCREENREADER, SPIF_SENDCHANGE = 0x0046, 0x0047, 0x02
    OBJID_CLIENT = 0xFFFFFFFC

    # Only touch the flag if we successfully READ its prior value — otherwise a
    # later "restore" could force-disable a screen reader a real AT user had on.
    prior = ctypes.c_int(0)
    got = False
    try:
        if ctypes.windll.user32.SystemParametersInfoW(SPI_GETSCREENREADER, 0, byref(prior), 0):
            got = True
            ctypes.windll.user32.SystemParametersInfoW(SPI_SETSCREENREADER, True, None, SPIF_SENDCHANGE)
    except Exception:
        got = False

    # Enumerate this process's render-widget child HWNDs and bind IAccessible.
    try:
        from comtypes.client import GetModule
        GetModule("oleacc.dll")
        from comtypes.gen.Accessibility import IAccessible
        oleacc = ctypes.oledll.oleacc

        tops = []

        def _cb(hwnd, _):
            try:
                _, wpid = win32process.GetWindowThreadProcessId(hwnd)
            except Exception:
                return True
            if wpid == pid:
                tops.append(hwnd)
            return True

        win32gui.EnumWindows(_cb, None)

        render = []

        def _walk(parent):
            child = win32gui.GetWindow(parent, win32con.GW_CHILD)
            while child:
                if "RenderWidgetHostHWND" in win32gui.GetClassName(child):
                    render.append(child)
                _walk(child)
                child = win32gui.GetWindow(child, win32con.GW_HWNDNEXT)

        for t in tops:
            _walk(t)

        for h in render:
            try:
                pacc = POINTER(IAccessible)()
                oleacc.AccessibleObjectFromWindow(h, OBJID_CLIENT, byref(IAccessible._iid_), byref(pacc))
                _ = pacc.accChildCount
            except Exception:
                pass
    except Exception:
        pass

    # None => we didn't successfully read/set the flag, so caller must NOT restore.
    return bool(prior.value) if got else None


def _win_restore_screenreader(prior):
    import ctypes
    try:
        ctypes.windll.user32.SystemParametersInfoW(0x0047, bool(prior), None, 0x02)
    except Exception:
        pass


def _win_info(wrapper):
    ei = wrapper.element_info
    info = {
        "name": ei.name,
        "control_type": ei.control_type,
        "automation_id": ei.automation_id,
        "class_name": ei.class_name,
    }
    # SelectionItem pattern -> is this item selected? (dropdown options, list rows)
    try:
        info["selected"] = bool(wrapper.iface_selection_item.CurrentIsSelected)
    except Exception:
        pass
    # Value pattern -> current text value (e.g. a combobox's shown selection).
    try:
        v = wrapper.iface_value.CurrentValue
        if v not in (None, ""):
            info["value"] = v
    except Exception:
        pass
    try:
        r = ei.rectangle
        info["rect"] = [r.left, r.top, r.right, r.bottom]
    except Exception:
        pass
    return info


def _win_dump(args):
    try:
        win, wpid = _win_find_window(args.title_re, args.pid)
    except ImportError:
        _eprint("pywinauto not installed. Run: python -m pip install -r helpers/requirements.txt")
        sys.exit(3)
    if win is None:
        _eprint("No top-level window matched title-re=%r pid=%r" % (args.title_re, args.pid))
        sys.exit(2)

    # Force the lazy Chromium renderer a11y tree to build (best-effort; hardened
    # apps need a relaunch with --force-renderer-accessibility instead).
    prior_sr = None
    if not args.no_activate:
        prior_sr = _win_force_accessibility(wpid)
        time.sleep(args.settle_delay)

    # Settle: query descendants repeatedly until the count stops growing (the
    # lazy tree has finished building) or attempts run out.
    last = -1
    descendants = []
    try:
        for _ in range(args.settle):
            try:
                descendants = win.descendants()
            except Exception as e:
                _eprint("descendants() failed: %s" % e)
                time.sleep(args.settle_delay)
                continue
            if len(descendants) == last:
                break
            last = len(descendants)
            time.sleep(args.settle_delay)
    finally:
        if prior_sr is not None:
            _win_restore_screenreader(prior_sr)

    elements = []
    for d in descendants:
        try:
            info = _win_info(d)
        except Exception:
            continue
        if _passes(info, args.name_re, args.control_type):
            elements.append(info)
        if args.max and len(elements) >= args.max:
            break

    try:
        title = win.window_text()
    except Exception:
        title = None
    return {"backend": "uia", "window": title, "total_descendants": last,
            "count": len(elements), "elements": elements}


# --------------------------------------------------------------------------- #
# macOS — Accessibility (AX) API via PyObjC   (UNVERIFIED in this build)       #
# --------------------------------------------------------------------------- #
def _mac_pid(title_re, pid):
    if pid:
        return pid
    import subprocess
    # Best-effort: match a running process's full command line against title_re.
    # `command=` (not `comm=`) keeps the full path so app names with spaces match;
    # for precise targeting pass --pid (or use NSWorkspace).
    try:
        out = subprocess.check_output(["ps", "-axo", "pid=,command="], text=True)
    except Exception:
        return None
    for line in out.splitlines():
        line = line.strip()
        if not line:
            continue
        p, _, command = line.partition(" ")
        if title_re and _re_search(title_re, command):
            try:
                return int(p)
            except ValueError:
                continue
    return None


def _mac_dump(args):
    try:
        from ApplicationServices import (
            AXUIElementCreateApplication,
            AXUIElementCopyAttributeValue,
            AXUIElementSetAttributeValue,
        )
    except ImportError:
        _eprint("PyObjC AX framework missing. Run: python -m pip install -r helpers/requirements.txt")
        sys.exit(3)

    pid = _mac_pid(args.title_re, args.pid)
    if not pid:
        _eprint("Could not resolve a pid for title-re=%r. Pass --pid." % args.title_re)
        sys.exit(2)

    app = AXUIElementCreateApplication(pid)
    # Force the lazy Chromium renderer a11y tree to build (the mac analog of the
    # Windows force-accessibility handshake).
    try:
        # Chromium-specific signal that forces the renderer tree to build. (We
        # avoid AXEnhancedUserInterface — it can alter the app's own layout and
        # has no clean restore.)
        AXUIElementSetAttributeValue(app, "AXManualAccessibility", True)
    except Exception:
        pass
    time.sleep(args.settle_delay)

    def attr(el, name):
        try:
            err, val = AXUIElementCopyAttributeValue(el, name, None)
            return val if err == 0 else None
        except Exception:
            return None

    elements = []

    def walk(el, depth):
        if depth > args.max_depth or (args.max and len(elements) >= args.max):
            return
        info = {
            "name": attr(el, "AXTitle") or attr(el, "AXDescription"),
            "control_type": attr(el, "AXRole"),
            "value": attr(el, "AXValue"),
        }
        sel = attr(el, "AXSelected")
        if sel is not None:
            info["selected"] = bool(sel)
        info = {k: v for k, v in info.items() if v is not None}
        if _passes(info, args.name_re, args.control_type):
            elements.append(info)
        for child in (attr(el, "AXChildren") or []):
            walk(child, depth + 1)

    for child in (attr(app, "AXChildren") or []):
        walk(child, 0)

    return {"backend": "ax", "pid": pid, "count": len(elements), "elements": elements}


# --------------------------------------------------------------------------- #
def _dispatch(args):
    osname = platform.system()
    if osname == "Windows":
        result = _win_dump(args)
    elif osname == "Darwin":
        result = _mac_dump(args)
    else:
        _eprint("Tier 2 (accessibility read-back) supports Windows and macOS only. "
                "On %s use Tier 1 (CDP) or Tier 3 (vision)." % osname)
        sys.exit(3)

    if args.verb == "selected":
        result["elements"] = [e for e in result["elements"] if e.get("selected")]
        result["count"] = len(result["elements"])

    text = json.dumps(result, indent=2, ensure_ascii=False, default=str)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(text)
        _eprint("wrote %s (%d elements)" % (args.out, result["count"]))
    else:
        print(text)


def main():
    p = argparse.ArgumentParser(description="OS-native accessibility read-back (Tier 2).")
    p.add_argument("verb", choices=["dump", "selected"])
    p.add_argument("--title-re", help="regex matched against the top-level window title (Windows) / process comm (macOS)")
    p.add_argument("--pid", type=int, help="target process id (skips title matching)")
    p.add_argument("--name-re", help="keep only elements whose name matches this regex")
    p.add_argument("--control-type", help="keep only this control type (e.g. ComboBox, ListItem, Button)")
    p.add_argument("--max", type=int, default=0, help="cap number of emitted elements (0 = no cap)")
    p.add_argument("--max-depth", type=int, default=60, help="max tree depth to walk")
    p.add_argument("--settle", type=int, default=8, help="max activation/settle polls (Windows)")
    p.add_argument("--settle-delay", type=float, default=0.6, help="seconds between settle polls")
    p.add_argument("--no-activate", action="store_true",
                   help="skip the force-accessibility poke (Windows); use if the app is already activated")
    p.add_argument("--out", help="write JSON to this file instead of stdout")
    args = p.parse_args()

    if not args.title_re and not args.pid:
        p.error("provide --title-re and/or --pid")

    try:
        _dispatch(args)
    except SystemExit:
        raise
    except Exception as e:
        _eprint("read error: %s" % e)
        sys.exit(4)


if __name__ == "__main__":
    main()
