<#
  discover_exe.ps1 — Tier-1 executable / launch discovery for desktop-app-loop.

  Resolves HOW to (re)launch a target desktop app with a CDP debug flag, and
  whether that is even possible. Emits a single JSON object to stdout.

  Usage:
    pwsh -NoProfile -File discover_exe.ps1 -Match "codex"

  App kinds it distinguishes:
    "exe"  — a normal installed executable. Chromium flags (e.g.
             --remote-debugging-port) CAN be passed at launch. canPassArgs = true.
    "msix" — a Store/MSIX-packaged app (runs from Program Files\WindowsApps).
             The shell launch path does NOT forward Chromium flags
             (canPassArgs = false), BUT you CAN inject them by relaunching the
             package's exe inside its container via Invoke-CommandInDesktopPackage
             (see relaunchWithArgs). Validated: this opens the CDP port on Codex.

  Fields: match, kind, exePath, packageFamilyName, aumid, appId, runningPids,
          mainWindowPids, launchCommand, relaunchWithArgs, canPassArgs, notes[].
#>
param(
  [Parameter(Mandatory = $true)][string]$Match
)

$ErrorActionPreference = "SilentlyContinue"

# Treat the supplied name literally — `-match` is a regex operator, so an app
# name with metacharacters (or a stray `.*`) would otherwise break or over-match.
$rx = [regex]::Escape($Match)

$result = [ordered]@{
  match             = $Match
  kind              = $null
  exePath           = $null
  packageFamilyName = $null
  aumid             = $null
  appId             = $null
  runningPids       = @()
  mainWindowPids    = @()
  launchCommand     = $null
  relaunchWithArgs  = $null
  canPassArgs       = $false
  notes             = @()
}

# 1) Running processes whose name or image path matches.
$procs = Get-Process | Where-Object {
  $_.ProcessName -match $rx -or ($_.Path -and $_.Path -match $rx)
}
$result.runningPids    = @($procs | Select-Object -ExpandProperty Id)
# Processes owning a top-level window = the GUI, not background/CLI helpers.
$guiProcs = $procs | Where-Object { $_.MainWindowHandle -ne 0 }
$result.mainWindowPids = @($guiProcs | Select-Object -ExpandProperty Id)

# 2) MSIX / Store package?
$pkg = Get-AppxPackage | Where-Object { $_.Name -match $rx -or $_.PackageFamilyName -match $rx } | Select-Object -First 1
if ($pkg) {
  $result.kind = "msix"
  $result.packageFamilyName = $pkg.PackageFamilyName
  try {
    $manifest = Get-AppxPackageManifest $pkg
    $appId = @($manifest.Package.Applications.Application.Id)[0]
    if ($appId) { $result.appId = $appId; $result.aumid = "$($pkg.PackageFamilyName)!$appId" }
  } catch { $result.notes += "could not read AppId from manifest: $($_.Exception.Message)" }
  if ($result.aumid) {
    $result.launchCommand = "explorer.exe shell:AppsFolder\$($result.aumid)"
  }
  $gui = $guiProcs | Select-Object -First 1
  if ($gui -and $gui.Path) { $result.exePath = $gui.Path }
  else { $result.exePath = (Join-Path $pkg.InstallLocation 'app\*.exe' | Get-Item -ErrorAction SilentlyContinue | Select-Object -First 1).FullName }
  $result.canPassArgs = $false
  # The container-launch route that CAN pass flags (validated against Codex).
  if ($result.appId -and $result.exePath) {
    # Escape single quotes for the single-quoted PowerShell string literals.
    $q = { param($s) $s -replace "'", "''" }
    $result.relaunchWithArgs = "Import-Module Appx -UseWindowsPowerShell; Invoke-CommandInDesktopPackage -PackageFamilyName '$(& $q $pkg.PackageFamilyName)' -AppId '$(& $q $result.appId)' -Command '$(& $q $result.exePath)' -Args '--remote-debugging-port=9222 --force-renderer-accessibility'"
  }
  $result.notes += "MSIX-packaged: shell launch does NOT forward Chromium flags. To enable Tier 1 (CDP) AND Tier 2 (a11y), fully quit the app then run relaunchWithArgs (Invoke-CommandInDesktopPackage) — requires confirmation, it restarts the user's app."
  $result | ConvertTo-Json -Depth 6
  return
}

# 3) Normal exe — prefer a GUI process's own image path.
$gui = $guiProcs | Select-Object -First 1
if ($gui -and $gui.Path) { $result.kind = "exe"; $result.exePath = $gui.Path }

# 4) Registry App Paths.
if (-not $result.exePath) {
  foreach ($root in @(
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths",
    "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths")) {
    $hit = Get-ChildItem $root | Where-Object { $_.PSChildName -match $rx } | Select-Object -First 1
    if ($hit) {
      $def = (Get-ItemProperty $hit.PSPath).'(default)'
      if ($def) { $result.kind = "exe"; $result.exePath = $def; break }
    }
  }
}

# 5) Start Menu shortcut target.
if (-not $result.exePath) {
  $lnk = Get-ChildItem "$env:APPDATA\Microsoft\Windows\Start Menu\Programs", "$env:PROGRAMDATA\Microsoft\Windows\Start Menu\Programs" `
    -Recurse -Filter *.lnk | Where-Object { $_.Name -match $rx } | Select-Object -First 1
  if ($lnk) {
    $sh = New-Object -ComObject WScript.Shell
    $target = $sh.CreateShortcut($lnk.FullName).TargetPath
    if ($target) { $result.kind = "exe"; $result.exePath = $target }
  }
}

if ($result.exePath) {
  $result.canPassArgs = $true
  $result.launchCommand = "Start-Process `"$($result.exePath)`" -ArgumentList `"--remote-debugging-port=9222`""
} else {
  $result.notes += "Could not resolve an executable for '$Match'. Pass the path explicitly, or use Tier 2/3."
}

$result | ConvertTo-Json -Depth 6
