# YouTube Shorts break reminder - Chrome extension installer (Windows)
#
#   irm https://raw.githubusercontent.com/FanFantom9452/YouTube-Short-Limiter/main/install.ps1 | iex
#
# Console output is ASCII on purpose: Windows PowerShell 5.1 reads .ps1 files in
# the system ANSI codepage unless they carry a BOM, so Chinese text here would be
# mojibake for anyone who downloads the file and runs it directly. The Chinese
# walkthrough lives in README.md.

$ErrorActionPreference = 'Stop'
# PS 5.1 still negotiates TLS 1.0/1.1 by default; GitHub only accepts 1.2+.
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Repo   = 'FanFantom9452/YouTube-Short-Limiter'
$Branch = 'main'

# Fixed path, never TEMP. Chrome derives an unpacked extension's ID from the
# SHA256 of its absolute path, and chrome.storage is partitioned by that ID, so
# a moving path silently wipes the user's settings on every update. TEMP is also
# fair game for Disk Cleanup, which would break the extension outright.
$Dest = Join-Path $env:LOCALAPPDATA 'YouTubeShortLimiter'

$tmp     = [IO.Path]::GetTempPath()
$zip     = Join-Path $tmp 'yt-short-limiter.zip'
$staging = Join-Path $tmp 'yt-short-limiter-extract'

Write-Host ''
Write-Host '  YouTube Shorts break reminder - installer' -ForegroundColor Cyan
Write-Host ''

Write-Host '  [1/3] Downloading...'
Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/$Repo/archive/refs/heads/$Branch.zip" -OutFile $zip

Write-Host "  [2/3] Installing to $Dest"
if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
Expand-Archive -Path $zip -DestinationPath $staging -Force
# GitHub's branch zip wraps everything in a <repo>-<branch>/ directory.
$inner = Get-ChildItem $staging -Directory | Select-Object -First 1
if (-not $inner) { throw 'Unexpected archive layout: no top-level directory found.' }
if (Test-Path $Dest) { Remove-Item $Dest -Recurse -Force }
Move-Item -LiteralPath $inner.FullName -Destination $Dest
Remove-Item $staging, $zip -Recurse -Force

# So the folder picker in the next step is a single Ctrl+V.
Set-Clipboard -Value $Dest

Write-Host '  [3/3] Opening chrome://extensions'
$chrome = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $chrome) {
    $appPath = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe'
    if (Test-Path $appPath) { $chrome = (Get-ItemProperty $appPath).'(default)' }
}

if ($chrome) {
    # `start chrome://extensions` fails because the shell resolves chrome: through
    # its protocol handlers, where it is not registered. Handing the URL to
    # chrome.exe as an argument works. Start-Process rather than the call
    # operator: when no Chrome instance is running yet, the launched process IS
    # the browser and the call operator would block until the user closes it.
    Start-Process -FilePath $chrome -ArgumentList 'chrome://extensions/'
} else {
    Write-Host '        Could not find chrome.exe - open chrome://extensions yourself.' -ForegroundColor Yellow
}

Write-Host ''
Write-Host '  Now do this in the tab that just opened:' -ForegroundColor Cyan
Write-Host '    1. Turn on "Developer mode"           (top right)'
Write-Host '    2. Click "Load unpacked"              (top left)'
Write-Host '    3. Paste the path with Ctrl+V - it is already on your clipboard:'
Write-Host "         $Dest" -ForegroundColor White
Write-Host ''
Write-Host '  Then open any youtube.com/shorts/ video. Default reminder: 4 minutes.'
Write-Host '  Re-run this script to update, then hit the reload arrow on the card.'
Write-Host ''
