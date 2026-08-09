# YouTube Shorts 觀看提醒

連續看 YouTube Shorts 超過設定時間，跳出全屏提醒並自動暫停影片。提醒時間自己調。

---

# 安裝（3 步，約 1 分鐘）

## 第 1 步 — 裝 Tampermonkey

點這裡 → **[Tampermonkey 安裝頁](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)**

按「**加到 Chrome**」→ 再按「**新增擴充功能**」。

> 已經有 Tampermonkey 就跳過這步。

## 第 2 步 — 開啟權限 ⚠️ 漏掉這步一定失敗

複製下面這行，**貼到 Chrome 網址列按 Enter**：

```
chrome://extensions/?id=dhdgffkkebhmkfjojejmpbldmpobfkfo
```

> 這種網址沒辦法做成可點的連結（Chrome 禁止網頁跳到 `chrome://`），只能自己複製貼上。

在打開的頁面上做兩件事：

1. 把「**允許使用者指令碼 / Allow user scripts**」打開
2. 「**網站存取權 / Site access**」選「**在所有網站上 / On all sites**」

> 不需要開「開發人員模式」。Chrome 138 起這個開關已獨立出來，網路上多數教學還停在舊做法。

## 第 3 步 — 安裝腳本

**[點這裡安裝](https://raw.githubusercontent.com/FanFantom9452/YouTube-Short-Limiter/main/shorts-limiter.user.js)**

Tampermonkey 會跳出安裝頁 → 按「**安裝**」。

或者開命令提示字元（`Win + R` → 打 `cmd` → Enter），貼這行，效果一樣：

```
start "" "https://raw.githubusercontent.com/FanFantom9452/YouTube-Short-Limiter/main/shorts-limiter.user.js"
```

## 完成

開任何一支 `youtube.com/shorts/` 影片就開始計時。預設連續看 **4 分鐘**跳提醒。

改設定：點瀏覽器右上角 Tampermonkey 圖示 → **設定提醒時間**。

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

## 看到「無法從這個網站新增應用程式、擴充功能和使用者指令碼」

這是 Chrome **自己**的封鎖頁，不是 Tampermonkey 的。Chrome 原生就認得 `.user.js` 網址，會試著把它當擴充功能安裝，然後被「非 Web Store 一律擋掉」的規則攔下。

Tampermonkey 正常運作時會**搶先**攔截這個網址、換成自己的安裝介面，Chrome 根本沒機會跳這頁。所以看到這頁就代表 **Tampermonkey 沒有攔到** —— 回頭把第 2 步做完，重開 Chrome 再試。

## 還是不行 → 用 URL 匯入繞過

這條路不經過 `.user.js` 頁面攔截：

Tampermonkey 圖示 → **管理面板** → **公用程式** 分頁 → **URL 匯入** → 貼上腳本網址 → **匯入**。

## 換別的使用者腳本管理器有用嗎

沒用。Tampermonkey、Violentmonkey、ScriptCat 在 Chrome 上都走同一個 `chrome.userScripts` API，都需要第 2 步那個開關。

想完全避開它只有兩條路：用 **Firefox**（本腳本一字不改即可執行），或改用本 repo 的 **Chrome 擴充功能版**（走 `content_scripts`，不受此限制）。

## 為什麼不能一行指令全自動裝完

Chrome 從 137 版起移除了 `--load-extension` 命令列參數，且不允許任何程式自動安裝擴充功能或使用者腳本 —— 這是為了防堵惡意軟體的刻意設計，繞不過去。最後那顆「安裝」按鈕一定得手動點。

---

# 開發

兩個版本，邏輯共用同一份 `tick.js`：

```
tick.js                  純函式狀態機（兩個版本共用）
tick.test.js             node tick.test.js
shorts-limiter.user.js   使用者腳本版
manifest.json            Chrome 擴充功能版
content.js
popup.html / popup.js
install.cmd              Windows 引導式安裝
```

無建置流程、無相依套件。

```sh
node tick.test.js
```

## 發布使用者腳本

改完程式碼 push 到 `main` 分支即可，Tampermonkey 會自己去 `@updateURL` 拉更新。

但**一定要把 `.user.js` 檔頭的 `@version` 加上去** —— Tampermonkey 靠它判斷要不要更新。只改 `tick.js` 不加版號的話，既有使用者不會收到更新，因為 `@require` 的內容是快取的。
