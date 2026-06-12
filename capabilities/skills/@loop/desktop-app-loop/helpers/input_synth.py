#!/usr/bin/env python3
"""
input_synth.py — Tier-3 input-synthesis executor.

Synthesizes real OS mouse/keyboard input at absolute SCREEN coordinates, so a
vision/grounding model can act on a foreign app with no debug port and no
accessibility cooperation. Pair with capture_window.ps1 (Windows) / screencapture
(macOS) for the screenshot half of the loop.

  * Windows -> Win32 SendInput (DPI-aware, virtual-desktop normalized).
  * macOS   -> Quartz CGEvent via PyObjC (UNVERIFIED in this build; Windows is
    the validated path). Needs pyobjc-framework-Quartz.

Verbs:
  click  --x N --y N [--button left|right] [--double]
  move   --x N --y N
  type   --text "hello"
  key    --keys "enter" | "ctrl+a" | "esc"

Coordinates are absolute screen pixels (same space capture_window.ps1 reports as
x/y origin + width/height — add the in-image offset to the window origin).
"""
import argparse
import platform
import sys
import time


# --------------------------------------------------------------------------- #
# Windows — Win32 SendInput                                                    #
# --------------------------------------------------------------------------- #
def _win():
    import ctypes
    from ctypes import wintypes

    user32 = ctypes.WinDLL("user32", use_last_error=True)
    try:
        user32.SetProcessDPIAware()
    except Exception:
        pass

    INPUT_MOUSE, INPUT_KEYBOARD = 0, 1
    MOVE, ABSOLUTE, VIRTUALDESK = 0x0001, 0x8000, 0x4000
    LDOWN, LUP, RDOWN, RUP = 0x0002, 0x0004, 0x0008, 0x0010
    WHEEL = 0x0800
    KEYUP, UNICODE = 0x0002, 0x0004
    SM_XV, SM_YV, SM_CXV, SM_CYV = 76, 77, 78, 79

    ULONG_PTR = ctypes.POINTER(ctypes.c_ulong)

    class MOUSEINPUT(ctypes.Structure):
        _fields_ = [("dx", wintypes.LONG), ("dy", wintypes.LONG), ("mouseData", wintypes.DWORD),
                    ("dwFlags", wintypes.DWORD), ("time", wintypes.DWORD), ("dwExtraInfo", ULONG_PTR)]

    class KEYBDINPUT(ctypes.Structure):
        _fields_ = [("wVk", wintypes.WORD), ("wScan", wintypes.WORD), ("dwFlags", wintypes.DWORD),
                    ("time", wintypes.DWORD), ("dwExtraInfo", ULONG_PTR)]

    class _U(ctypes.Union):
        _fields_ = [("mi", MOUSEINPUT), ("ki", KEYBDINPUT)]

    class INPUT(ctypes.Structure):
        _fields_ = [("type", wintypes.DWORD), ("u", _U)]

    def send(inp):
        user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(inp))

    def norm(x, y):
        ox, oy = user32.GetSystemMetrics(SM_XV), user32.GetSystemMetrics(SM_YV)
        cw, ch = user32.GetSystemMetrics(SM_CXV), user32.GetSystemMetrics(SM_CYV)
        nx = int((x - ox) * 65535 / max(cw - 1, 1))
        ny = int((y - oy) * 65535 / max(ch - 1, 1))
        return nx, ny

    def mouse(flags, nx=0, ny=0):
        send(INPUT(type=INPUT_MOUSE, u=_U(mi=MOUSEINPUT(nx, ny, 0, flags, 0, None))))

    def move(x, y):
        nx, ny = norm(x, y)
        mouse(MOVE | ABSOLUTE | VIRTUALDESK, nx, ny)

    def click(x, y, button, double):
        move(x, y); time.sleep(0.05)
        down, up = (RDOWN, RUP) if button == "right" else (LDOWN, LUP)
        for _ in range(2 if double else 1):
            mouse(down); time.sleep(0.03); mouse(up); time.sleep(0.04)

    def scroll(x, y, amount):
        # Wheel over (x,y). amount<0 scrolls DOWN (reveals items below).
        move(x, y); time.sleep(0.05)
        delta = (amount * 120) & 0xFFFFFFFF  # WHEEL_DELTA per notch, as unsigned DWORD
        send(INPUT(type=INPUT_MOUSE, u=_U(mi=MOUSEINPUT(0, 0, delta, WHEEL, 0, None))))

    def type_text(text):
        for ch in text:
            code = ord(ch)
            for fl in (UNICODE, UNICODE | KEYUP):
                send(INPUT(type=INPUT_KEYBOARD, u=_U(ki=KEYBDINPUT(0, code, fl, 0, None))))
            time.sleep(0.01)

    VK = {"enter": 0x0D, "esc": 0x1B, "escape": 0x1B, "tab": 0x09, "space": 0x20,
          "backspace": 0x08, "delete": 0x2E, "up": 0x26, "down": 0x28, "left": 0x25,
          "right": 0x27, "ctrl": 0x11, "alt": 0x12, "shift": 0x10, "win": 0x5B,
          "a": 0x41}

    def key(combo):
        parts = [p.strip().lower() for p in combo.split("+")]
        vks = [VK.get(p, ord(p.upper()) if len(p) == 1 else 0) for p in parts]
        for vk in vks:
            send(INPUT(type=INPUT_KEYBOARD, u=_U(ki=KEYBDINPUT(vk, 0, 0, 0, None))))
        for vk in reversed(vks):
            send(INPUT(type=INPUT_KEYBOARD, u=_U(ki=KEYBDINPUT(vk, 0, KEYUP, 0, None))))

    return move, click, scroll, type_text, key


# --------------------------------------------------------------------------- #
# macOS — Quartz CGEvent   (UNVERIFIED in this build)                          #
# --------------------------------------------------------------------------- #
def _mac():
    from Quartz import (
        CGEventCreateMouseEvent, CGEventPost, CGEventCreateKeyboardEvent,
        CGEventKeyboardSetUnicodeString, kCGHIDEventTap, kCGEventMouseMoved,
        kCGEventLeftMouseDown, kCGEventLeftMouseUp, kCGEventRightMouseDown,
        kCGEventRightMouseUp, kCGMouseButtonLeft, kCGMouseButtonRight,
        CGEventCreateScrollWheelEvent, kCGScrollEventUnitLine,
    )

    def post(ev_type, x, y, button=kCGMouseButtonLeft):
        ev = CGEventCreateMouseEvent(None, ev_type, (x, y), button)
        CGEventPost(kCGHIDEventTap, ev)

    def move(x, y):
        post(kCGEventMouseMoved, x, y)

    def click(x, y, button, double):
        move(x, y); time.sleep(0.05)
        down, up, b = (kCGEventRightMouseDown, kCGEventRightMouseUp, kCGMouseButtonRight) \
            if button == "right" else (kCGEventLeftMouseDown, kCGEventLeftMouseUp, kCGMouseButtonLeft)
        for _ in range(2 if double else 1):
            post(down, x, y, b); time.sleep(0.03); post(up, x, y, b); time.sleep(0.04)

    def scroll(x, y, amount):
        move(x, y); time.sleep(0.05)
        ev = CGEventCreateScrollWheelEvent(None, kCGScrollEventUnitLine, 1, amount)
        CGEventPost(kCGHIDEventTap, ev)

    def type_text(text):
        for ch in text:
            for down in (True, False):  # key-down then key-up
                ev = CGEventCreateKeyboardEvent(None, 0, down)
                CGEventKeyboardSetUnicodeString(ev, len(ch), ch)
                CGEventPost(kCGHIDEventTap, ev)
            time.sleep(0.01)

    def key(combo):
        print("input_synth: key() is not implemented on macOS; use click/type, or a "
              "model executor for chords.", file=sys.stderr)
        sys.exit(3)

    return move, click, scroll, type_text, key


def main():
    p = argparse.ArgumentParser(description="Tier-3 input synthesis executor.")
    p.add_argument("verb", choices=["click", "move", "scroll", "type", "key"])
    p.add_argument("--x", type=int)
    p.add_argument("--y", type=int)
    p.add_argument("--button", default="left", choices=["left", "right"])
    p.add_argument("--double", action="store_true")
    p.add_argument("--amount", type=int, default=-3, help="scroll notches; negative = down")
    p.add_argument("--text", default="")
    p.add_argument("--keys", default="")
    args = p.parse_args()

    osname = platform.system()
    if osname == "Windows":
        move, click, scroll, type_text, key = _win()
    elif osname == "Darwin":
        move, click, scroll, type_text, key = _mac()
    else:
        print("input_synth supports Windows and macOS only.", file=sys.stderr)
        sys.exit(3)

    if args.verb in ("click", "move", "scroll") and (args.x is None or args.y is None):
        p.error("--x and --y are required for click/move/scroll")

    if args.verb == "click":
        click(args.x, args.y, args.button, args.double)
    elif args.verb == "move":
        move(args.x, args.y)
    elif args.verb == "scroll":
        scroll(args.x, args.y, args.amount)
    elif args.verb == "type":
        type_text(args.text)
    elif args.verb == "key":
        key(args.keys)
    print("ok")


if __name__ == "__main__":
    main()
