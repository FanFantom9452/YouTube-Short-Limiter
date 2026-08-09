# YouTube Shorts 觀看提醒

連續觀看 YouTube Shorts 達設定時間後，跳出全屏提醒並暫停影片。

有兩個版本，邏輯共用同一份 `tick.js`：

- **使用者腳本**（`shorts-limiter.user.js`）—— 點一個連結就裝，推薦
- **Chrome 擴充功能**（`manifest.json` + `content.js` + `popup.html`）—— 要手動載入未封裝項目，或上架 Chrome 線上應用程式商店

---

## 安裝（使用者腳本）

### 步驟 0：先決條件（**這步不做後面一定失敗**）

1. 裝 [Tampermonkey](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
2. 開 `chrome://extensions`，右上角打開**開發人員模式**
3. 點 Tampermonkey 的**詳細資料**，打開**「允許使用者指令碼 / Allow user scripts」**
4. 同一頁把**網站存取權**設成**「在所有網站上」**

第 3 步是 Chrome 138 起新增的獨立權限開關，跟開發人員模式是兩回事，最常被漏掉。沒開的話 Chrome 不允許任何擴充功能執行使用者腳本。

### 方式一：一行指令

開 CMD 貼這行：

```
start "" "https://raw.githubusercontent.com/FanFantom9452/YouTube-Short-Limiter/main/shorts-limiter.user.js"
```

Tampermonkey 會攔截這個網址並跳出安裝頁，按「安裝」即可。

### 方式二：跑 `install.cmd`

沒有 Tampermonkey 的話，下載 `install.cmd` 點兩下，它會依序開啟 Tampermonkey 商店頁與腳本安裝頁。

> 為什麼不能全自動？Chrome 從 137 版起移除了 `--load-extension` 命令列參數，並且不允許任何程式自動安裝擴充功能或使用者腳本 —— 這是為了防堵惡意軟體的刻意設計，繞不過去。最後那顆「安裝」按鈕一定得手動點。

### 使用

裝好後開任一支 `youtube.com/shorts/` 影片即可開始計時。改設定：點 Tampermonkey 圖示 → **設定提醒時間**。

### 疑難排解

**看到「無法從這個網站新增應用程式、擴充功能和使用者指令碼」**

這是 Chrome **自己**的封鎖頁，不是 Tampermonkey 的。Chrome 原生就認得 `.user.js` 網址，會試著把它當擴充功能安裝然後擋下來。

Tampermonkey 正常運作時會搶先攔截這個網址、換成自己的安裝介面，Chrome 根本沒機會跳這頁。所以看到這頁就代表 **Tampermonkey 沒有攔到** —— 回頭做完上面的步驟 0，然後重開 Chrome 再試。

**還是不行 → 用 URL 匯入繞過**

這條路不經過 `.user.js` 頁面攔截：

Tampermonkey 圖示 → **管理面板** → **公用程式** 分頁 → **URL 匯入** → 貼上腳本網址 → **匯入**。

---

## 設定

| 項目 | 預設 | 說明 |
|---|---|---|
| 提醒門檻 | 4 分鐘 | 連續觀看多久跳提醒 |
| 歸零方式 | 只有按下「我休息」才歸零 | 見下 |
| 停止多久算中斷 | 60 秒 | 只在「自動歸零」模式下生效 |
| 「再看一下」延後 | 5 分鐘 | 按「再看 N 分鐘」後多久再跳一次 |

### 兩種歸零方式

- **只有按下「我休息」才歸零（預設）**：累計跨分頁、跨重開瀏覽器保留，只有按「我休息」或「立即歸零」才清空，每天換日自動清一次。
- **停止觀看一段時間後自動歸零**：停止觀看超過設定秒數自動清空。這裡的「停止」包含暫停影片、切到別的分頁、關瀏覽器 —— 是刻意的，詳見 `docs/superpowers/specs/`。

「再看 N 分鐘」**不會**歸零累計，所以延後時間到會再跳一次。

## 計時規則

四個條件同時成立才累加：在 `/shorts/` 頁面、影片正在播放、分頁可見、視窗有焦點。

因為包含「視窗有焦點」，兩個分頁不可能同時計時，不會重複計。

---

## 開發

```
tick.js                  純函式狀態機（兩個版本共用）
tick.test.js             node tick.test.js
shorts-limiter.user.js   使用者腳本版
manifest.json            Chrome 擴充功能版
content.js
popup.html / popup.js
```

無建置流程、無相依套件。

```sh
node tick.test.js
```

### 發布使用者腳本

改完程式碼 push 到 `main` 分支即可，Tampermonkey 會自己去 `@updateURL` 拉更新。

但**一定要把 `.user.js` 檔頭的 `@version` 加上去** —— Tampermonkey 靠它判斷要不要更新。只改 `tick.js` 不加版號的話，既有使用者不會收到更新，因為 `@require` 的內容是快取的。
