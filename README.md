# YouTube Shorts 觀看提醒

連續看 YouTube Shorts 超過設定時間，跳出全屏提醒並自動暫停影片。提醒時間自己調。

Chrome 擴充功能，只要 `storage` 一個權限，只跑在 `www.youtube.com`，零網路請求，所有資料留在本機。

---

# 安裝

## 第 1 步 — 貼上這行指令

開 **命令提示字元** 或 **PowerShell** 都可以（`Win + R` → 打 `cmd` → Enter），貼這行：

```
powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/FanFantom9452/YouTube-Short-Limiter/main/install.ps1 | iex"
```

腳本會做三件事：下載程式到 `%LOCALAPPDATA%\YouTubeShortLimiter`、**把安裝路徑複製到你的剪貼簿**、開啟 `chrome://extensions`。

## 第 2 步 — 在剛跳出來的 Chrome 分頁上點三下

1. 右上角打開「**開發人員模式 / Developer mode**」
2. 左上角點「**載入未封裝項目 / Load unpacked**」
3. 在資料夾選擇視窗按 **Ctrl + V** 貼上路徑（已經在剪貼簿裡了），按確定

## 完成

開任何一支 `youtube.com/shorts/` 影片就開始計時。預設連續看 **4 分鐘**跳提醒。

改設定：點瀏覽器工具列上的擴充功能圖示。

---

# 更新

重跑第 1 步那行指令，然後到 `chrome://extensions` 按那張卡片上的**重新載入箭頭**。

你的設定與累計時間不會因為更新而消失 —— 安裝路徑是固定的，所以 Chrome 認得這是同一個擴充功能。

---

# 設定

| 項目 | 預設 | 說明 |
|---|---|---|
| 提醒門檻 | 4 分鐘 | 連續觀看多久跳提醒 |
| 歸零方式 | 只有按下「我休息」才歸零 | 見下 |
| 停止多久算中斷 | 60 秒 | 只在「自動歸零」模式下生效 |
| 「再看一下」延後 | 5 分鐘 | 按「再看 N 分鐘」後多久再跳一次 |

## 兩種歸零方式

- **只有按下「我休息」才歸零（預設）**：累計跨分頁、跨重開瀏覽器保留，只有按「我休息」或「立即歸零」才清空，每天換日自動清一次。
- **停止觀看一段時間後自動歸零**：停止觀看超過設定秒數自動清空。這裡的「停止」包含暫停影片、切到別的分頁、關瀏覽器 —— 是刻意的，詳見 `docs/superpowers/specs/`。

「再看 N 分鐘」**不會**歸零累計，所以延後時間到會再跳一次。

## 計時規則

四個條件同時成立才累加：在 `/shorts/` 頁面、影片正在播放、分頁可見、視窗有焦點。

因為包含「視窗有焦點」，兩個分頁不可能同時計時，不會重複計。

---

# 疑難排解

## 找不到「載入未封裝項目」按鈕

「開發人員模式」沒開。右上角那個開關打開後按鈕才會出現。

## 卡片上出現紅色錯誤，或擴充功能突然消失

`%LOCALAPPDATA%\YouTubeShortLimiter` 這個資料夾被刪掉或搬走了。未封裝的擴充功能是直接從磁碟讀檔的，資料夾不能移動。重跑安裝指令即可。

## 指令跑完沒有自動開 Chrome

腳本找不到 `chrome.exe`（非標準路徑安裝）。自己開 `chrome://extensions`，路徑還是在剪貼簿裡。

## 提醒不會跳

依序確認：網址是 `youtube.com/shorts/...`、影片正在播（不是暫停）、分頁在前景、視窗有焦點。四個條件缺一就不計時 —— 這是刻意的，讓「看了幾分鐘」貼近真的在看的時間。

## 不想直接執行網路上的腳本

合理。先讀過 [`install.ps1`](install.ps1) 再決定，或直接下載這個 repo 的 ZIP 自己解壓到任一固定資料夾，然後從第 2 步開始手動做。

---

# 開發

```
manifest.json    MV3 宣告，無 background service worker
tick.js          純函式狀態機
content.js       每秒 tick、遮罩
popup.html/js    設定介面
tick.test.js     node tick.test.js
install.ps1      Windows 安裝腳本
```

無建置流程、無相依套件。

```sh
node tick.test.js
```

計時邏輯全部關在 `tick.js` 這個純函式裡（無 DOM、無 chrome API），模式切換、歸零規則、跨天這三段唯一容易寫錯的地方都由 `tick.test.js` 用 assert 釘住。
