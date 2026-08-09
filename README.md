# YouTube Shorts 觀看提醒

連續看 YouTube Shorts 超過設定時間，跳出全屏提醒並自動暫停影片。提醒時間自己調。

Chrome 擴充功能，只要 `storage` 一個權限，只跑在 `www.youtube.com`，零網路請求，所有資料留在本機。

---

# 安裝

開 **命令提示字元** 或 **PowerShell** 都可以（`Win + R` → 打 `cmd` → Enter），貼這行：

```
powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/FanFantom9452/YouTube-Short-Limiter/main/install.ps1 | iex"
```

腳本會**一步一步帶你做完**，每做完一步按 Enter 進下一步：

| | 腳本做的事 | 你做的事 |
|---|---|---|
| **第 1 步** | 把 `chrome://extensions` 複製到剪貼簿，並嘗試自動開啟 | 確認頁面開在你要用的那個 Chrome 設定檔上；沒自動開就在網址列 Ctrl+V |
| **第 2 步** | — | 右上角打開「**開發人員模式**」 |
| **第 3 步** | 把剪貼簿**換成**安裝路徑 | 點「**載入未封裝項目**」→ 在選擇視窗 Ctrl+V → 確定 |

剪貼簿之所以分兩次換，是因為剪貼簿只有一個位置：第 1 步你需要的是網址，第 3 步你需要的是路徑。腳本在你按 Enter 的那一刻才換掉。

> **最後兩下為什麼要手動點**：Chrome 不允許任何程式自動安裝擴充功能，這是防堵惡意軟體的刻意設計，繞不過去。

---

# 設定在哪裡

**不在 `chrome://extensions` 那張卡片上。** 那張卡片永遠只有開關和「詳細資料」。

設定在**工具列的圖示**裡：

1. 點 Chrome 工具列右邊的**拼圖圖示**（擴充功能）
2. 找到「YouTube Shorts 觀看提醒」，點旁邊的**圖釘**把它釘到工具列
3. 之後點那個**紅色圓形圖示**，就是設定畫面

| 項目 | 預設 | 說明 |
|---|---|---|
| 提醒門檻 | 4 分鐘 | 連續觀看多久跳提醒 |
| 歸零方式 | 只有按下「我休息」才歸零 | 見下 |
| 停止多久算中斷 | 60 秒 | 只在「自動歸零」模式下生效 |
| 「再看一下」延後 | 5 分鐘 | 按「再看 N 分鐘」後多久再跳一次 |

同一個畫面也會顯示目前累計了多久，以及一顆「立即歸零」。

## 兩種歸零方式

- **只有按下「我休息」才歸零（預設）**：累計跨分頁、跨重開瀏覽器保留，只有按「我休息」或「立即歸零」才清空，每天換日自動清一次。
- **停止觀看一段時間後自動歸零**：停止觀看超過設定秒數自動清空。這裡的「停止」包含暫停影片、切到別的分頁、關瀏覽器 —— 是刻意的，詳見 `docs/superpowers/specs/`。

「再看 N 分鐘」**不會**歸零累計，所以延後時間到會再跳一次。

## 計時規則

四個條件同時成立才累加：在 `/shorts/` 頁面、影片正在播放、分頁可見、視窗有焦點。

因為包含「視窗有焦點」，兩個分頁不可能同時計時，不會重複計。

---

# 更新

重跑安裝指令，然後到 `chrome://extensions` 按那張卡片上的**重新載入箭頭**。

設定與累計時間不會因為更新而消失 —— 安裝路徑固定，Chrome 認得這是同一個擴充功能。

---

# 疑難排解

## 找不到設定畫面，只看到開啟／關閉

你在看 `chrome://extensions` 的卡片。設定在工具列圖示裡，看上面「設定在哪裡」。

## 找不到「載入未封裝項目」按鈕

「開發人員模式」沒開。右上角那個開關打開後按鈕才會出現。

## 卡片上出現紅色錯誤，或擴充功能突然消失

`%LOCALAPPDATA%\YouTubeShortLimiter` 這個資料夾被刪掉或搬走了。未封裝的擴充功能是直接從磁碟讀檔，資料夾不能移動。重跑安裝指令即可。

## 指令跑完沒有自動開 Chrome

腳本找不到 `chrome.exe`（非標準路徑安裝）。第 1 步的網址還在剪貼簿裡，自己開一個分頁貼上就好。

## 提醒不會跳

依序確認：網址是 `youtube.com/shorts/...`、影片正在播（不是暫停）、分頁在前景、視窗有焦點。四個條件缺一就不計時 —— 這是刻意的，讓「看了幾分鐘」貼近真的在看的時間。

## 不想直接執行網路上的腳本

合理。先讀過 [`install.ps1`](install.ps1) 再決定，或直接下載這個 repo 的 ZIP 自己解壓到任一固定資料夾，然後手動走「開發人員模式 → 載入未封裝項目」。

讀完想在本機跑那個檔案的話，**不要**用 `powershell -File .\install.ps1` —— Windows PowerShell 5.1 會用系統 ANSI 字碼頁讀取無 BOM 的 `.ps1`，中文會變亂碼。改用：

```
powershell -NoProfile -Command "iex (Get-Content -Raw -Encoding UTF8 .\install.ps1)"
```

或用 PowerShell 7（`pwsh -File .\install.ps1`），它預設就以 UTF-8 讀取。

---

# 開發

```
manifest.json    MV3 宣告，無 background service worker
tick.js          純函式狀態機
content.js       每秒 tick、遮罩
popup.html/js    設定介面
icons/           16 / 32 / 48 / 128 px
tick.test.js     node tick.test.js
install.ps1      Windows 分段式安裝腳本
```

無建置流程、無相依套件。

```sh
node tick.test.js
```

計時邏輯全部關在 `tick.js` 這個純函式裡（無 DOM、無 chrome API），模式切換、歸零規則、跨天這三段唯一容易寫錯的地方都由 `tick.test.js` 用 assert 釘住。

`install.ps1` 是 UTF-8 **無 BOM**。這是二選一：加 BOM 的話 `irm` 回傳的字串會保留 U+FEFF，`iex` 第一行就變成 `﻿#` 而報錯（PowerShell 把 U+FEFF 當識別字字元，不是空白）；不加 BOM 則換成 Windows PowerShell 5.1 直接執行檔案時用 ANSI 字碼頁解讀，中文變亂碼。主要安裝路徑是一行指令，所以選無 BOM。
