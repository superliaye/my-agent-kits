<#
  capture_window.ps1 — Tier-3 screenshot executor (Windows).
  Captures a target app window to PNG via OS screen capture (no debug port, no
  app cooperation). DPI-aware so coordinates match physical pixels used by the
  input-synthesis step.

  Usage:
    pwsh -NoProfile -File capture_window.ps1 -ProcId 49208 -Out shot.png
    pwsh -NoProfile -File capture_window.ps1 -TitleRe "(?i)codex" -Out shot.png

  Prints JSON: { out, x, y, width, height } — the window's screen-space origin
  and size, so a grounding model's in-image coordinates can be mapped back to
  absolute screen coordinates for clicking.
#>
param(
  [int]$ProcId = 0,
  [string]$TitleRe = "",
  [Parameter(Mandatory = $true)][string]$Out,
  [switch]$NoForeground
)

Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinCap {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, IntPtr pid);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool f);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
}
"@
[void][WinCap]::SetProcessDPIAware()

# OS screen capture grabs whatever is PAINTED at the window's rect, so an
# occluded target captures the window on top of it. Foreground the target first
# (also required so Tier-3 input synthesis lands in the right window). Uses the
# AttachThreadInput trick to bypass the foreground lock.
function Set-Foreground([IntPtr]$hwnd) {
  [void][WinCap]::ShowWindow($hwnd, 9)  # SW_RESTORE
  $fg = [WinCap]::GetForegroundWindow()
  $tA = [WinCap]::GetWindowThreadProcessId($fg, [IntPtr]::Zero)
  $tB = [WinCap]::GetWindowThreadProcessId($hwnd, [IntPtr]::Zero)
  $me = [WinCap]::GetCurrentThreadId()
  [void][WinCap]::AttachThreadInput($me, $tA, $true)
  [void][WinCap]::AttachThreadInput($me, $tB, $true)
  [void][WinCap]::BringWindowToTop($hwnd)
  [void][WinCap]::SetForegroundWindow($hwnd)
  [void][WinCap]::AttachThreadInput($me, $tA, $false)
  [void][WinCap]::AttachThreadInput($me, $tB, $false)
  Start-Sleep -Milliseconds 400
}

$proc = $null
if ($ProcId -gt 0) {
  $proc = Get-Process -Id $ProcId -ErrorAction SilentlyContinue
} elseif ($TitleRe) {
  $proc = Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -match $TitleRe } | Select-Object -First 1
}
if (-not $proc -or $proc.MainWindowHandle -eq 0) { Write-Error "No window for ProcId=$ProcId TitleRe=$TitleRe"; exit 2 }

if (-not $NoForeground) { Set-Foreground $proc.MainWindowHandle }

$r = New-Object WinCap+RECT
[void][WinCap]::GetWindowRect($proc.MainWindowHandle, [ref]$r)
$w = $r.Right - $r.Left
$h = $r.Bottom - $r.Top
if ($w -le 0 -or $h -le 0) { Write-Error "Bad window rect ($w x $h)"; exit 3 }

$bmp = New-Object System.Drawing.Bitmap $w, $h
$g = [System.Drawing.Graphics]::FromImage($bmp)
try {
  $g.CopyFromScreen($r.Left, $r.Top, 0, 0, $bmp.Size)
  $bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $g.Dispose(); $bmp.Dispose()
}

[ordered]@{ out = $Out; x = $r.Left; y = $r.Top; width = $w; height = $h } | ConvertTo-Json -Compress
