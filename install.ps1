# YouTube Shorts 觀看提醒 — Chrome 擴充功能安裝腳本（Windows）
#
# 從 CMD 或 PowerShell 都可以執行：
#
#   powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/FanFantom9452/YouTube-Short-Limiter/main/install.ps1 | iex"
#
# 本檔案存成「UTF-8 with BOM」。Windows PowerShell 5.1 在沒有 BOM 時會用系統
# ANSI 字碼頁讀取 .ps1，中文會變亂碼；加了 BOM 之後，直接執行檔案與透過
# irm | iex 兩種方式都能正確顯示。

$ErrorActionPreference = 'Stop'
# PS 5.1 預設仍在協商 TLS 1.0/1.1，GitHub 只接受 1.2 以上。
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Repo   = 'FanFantom9452/YouTube-Short-Limiter'
$Branch = 'main'

# 固定路徑，絕不用 TEMP。Chrome 是拿資料夾絕對路徑的 SHA256 當未封裝擴充功能的
# ID，而 chrome.storage 又是按 ID 分區的 —— 路徑一變，使用者的設定與累計時間會
# 在每次更新時無聲歸零。TEMP 還會被磁碟清理直接刪掉。
$Dest = Join-Path $env:LOCALAPPDATA 'YouTubeShortLimiter'

$tmp     = [IO.Path]::GetTempPath()
$zip     = Join-Path $tmp 'yt-short-limiter.zip'
$staging = Join-Path $tmp 'yt-short-limiter-extract'

function Write-Step {
    param([string]$Title)
    Write-Host ''
    Write-Host "  ─────────────────────────────────────────────" -ForegroundColor DarkGray
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host ''
}

function Wait-Step {
    param([string]$Prompt = '這一步做完後，回到這個視窗按 Enter 繼續')
    Write-Host ''
    # 被管線或排程呼叫時 stdin 是重導的，Read-Host 會立刻返回而不是等待，
    # 那種情況下直接把步驟全部印出來就好，不要假裝在等使用者。
    if ([Console]::IsInputRedirected) {
        Write-Host "  （非互動模式，自動繼續）" -ForegroundColor DarkGray
        return
    }
    Write-Host "  >>> $Prompt" -ForegroundColor Yellow
    $null = Read-Host
}

Write-Host ''
Write-Host '  YouTube Shorts 觀看提醒 — 安裝' -ForegroundColor Cyan

# ── 下載與安裝（不需要互動）────────────────────────────────────────────
Write-Host ''
Write-Host '  下載中...'
Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/$Repo/archive/refs/heads/$Branch.zip" -OutFile $zip

if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
Expand-Archive -Path $zip -DestinationPath $staging -Force
# GitHub 的分支 zip 會多包一層 <repo>-<branch>/
$inner = Get-ChildItem $staging -Directory | Select-Object -First 1
if (-not $inner) { throw '壓縮檔結構不如預期：找不到最上層資料夾。' }
if (Test-Path $Dest) { Remove-Item $Dest -Recurse -Force }
Move-Item -LiteralPath $inner.FullName -Destination $Dest
Remove-Item $staging, $zip -Recurse -Force

Write-Host "  已安裝到 $Dest" -ForegroundColor Green

# ── 第 1 步：開啟擴充功能頁面 ──────────────────────────────────────────
Write-Step '第 1 步 / 共 3 步 — 開啟 Chrome 的擴充功能頁面'

Set-Clipboard -Value 'chrome://extensions'
Write-Host '  已把這個網址複製到你的剪貼簿：' -ForegroundColor Green
Write-Host '      chrome://extensions' -ForegroundColor White
Write-Host ''

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
    # 用 Start-Process 而不是呼叫運算子：Chrome 還沒開著時，被啟動的那個行程就是
    # 瀏覽器本體，呼叫運算子會卡住直到使用者關閉瀏覽器。
    # 另外 chrome:// 不能用 start 開啟，那會走系統的通訊協定處理常式，而 chrome:
    # 沒有註冊在那裡；當成 chrome.exe 的引數傳進去才有效。
    Start-Process -FilePath $chrome -ArgumentList 'chrome://extensions/'
    Write-Host '  已嘗試自動開啟。' -ForegroundColor DarkGray
}

Write-Host '  如果沒有自動開啟，或開到了不是你要用的那個 Chrome 設定檔，'
Write-Host '  請自己切到正確的 Chrome 視窗，在網址列按 Ctrl+V 再按 Enter。'

Wait-Step '擴充功能頁面已經開好了？按 Enter 繼續'

# ── 第 2 步：開發人員模式 ──────────────────────────────────────────────
Write-Step '第 2 步 / 共 3 步 — 打開「開發人員模式」'

Write-Host '  在剛才那個頁面的「右上角」，把 開發人員模式 / Developer mode 打開。'
Write-Host ''
Write-Host '  打開後，左上角會多出「載入未封裝項目 / Load unpacked」這顆按鈕。'
Write-Host '  沒看到那顆按鈕，就是這個開關還沒開。' -ForegroundColor DarkGray

Wait-Step '看到「載入未封裝項目」按鈕了？按 Enter 繼續'

# ── 第 3 步：載入資料夾 ────────────────────────────────────────────────
Write-Step '第 3 步 / 共 3 步 — 載入擴充功能資料夾'

Set-Clipboard -Value $Dest
Write-Host '  剪貼簿已經換成安裝路徑（原本的網址被取代了）：' -ForegroundColor Green
Write-Host "      $Dest" -ForegroundColor White
Write-Host ''
Write-Host '  1. 點左上角「載入未封裝項目 / Load unpacked」'
Write-Host '  2. 在跳出來的資料夾選擇視窗，按 Ctrl+V 貼上路徑，按 Enter'
Write-Host '  3. 按「選擇資料夾」確定'

Wait-Step '載入完成了？按 Enter 看最後說明'

# ── 完成 ───────────────────────────────────────────────────────────────
Write-Step '完成'

Write-Host '  現在開任何一支 youtube.com/shorts/ 影片就會開始計時。'
Write-Host '  預設連續看 4 分鐘跳提醒。'
Write-Host ''
Write-Host '  要改時間，設定在「工具列的圖示」裡，不是在擴充功能頁面那張卡片上：' -ForegroundColor Yellow
Write-Host '    1. 點 Chrome 工具列右邊的拼圖圖示（擴充功能）'
Write-Host '    2. 找到「YouTube Shorts 觀看提醒」，點旁邊的圖釘把它釘到工具列'
Write-Host '    3. 之後點那個紅色圓形圖示，就是設定畫面'
Write-Host ''
Write-Host '  要更新：重跑這行指令，再回擴充功能頁面按卡片上的重新載入箭頭。' -ForegroundColor DarkGray
Write-Host ''
