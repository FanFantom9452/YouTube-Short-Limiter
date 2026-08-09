# YouTube Shorts 觀看提醒 — 設計

日期：2026-08-10

## 目的

連續觀看 YouTube Shorts 達設定時間（預設 4 分鐘）後，在頁面上跳出全屏遮罩提醒休息。門檻與歸零規則可在擴充功能的 popup 內設定。

## 決定事項

| 項目 | 決定 |
|---|---|
| 計時定義 | 只算實際播放中：在 `/shorts/` + 影片未暫停 + 分頁可見 + 視窗有焦點 |
| 歸零規則 | 兩種模式，可切換。預設 `manual`（只有按下「我休息」才歸零）；`auto`（停止觀看超過 N 秒自動歸零，N 預設 60） |
| 累計壽命 | 存 `chrome.storage.local`，跨分頁、跨重開瀏覽器保留；每天換日自動歸零 |
| 提醒形式 | 頁內全屏遮罩 + 自動暫停影片 |

## 架構

無 background service worker。全部邏輯住在 content script。

```
manifest.json    MV3 宣告：storage 權限 + content_scripts + action
tick.js          純函式 reducer，無 DOM、無 chrome API
content.js       每秒 tick、抓 video、畫遮罩
popup.html/js    設定 + 顯示今日累計
tick.test.js     node 跑的 assert 自測
```

`tick.js` 同時被 content script、popup 與測試載入。瀏覽器端當作經典 script（全域共享作用域），Node 端靠結尾的 `module.exports` 守衛當 CommonJS。零建置流程。

### 為什麼不需要 service worker

- **SPA 換頁**：每秒 tick 直接讀 `location.pathname`，輪詢已涵蓋，不需 History API hook 或 `yt-navigate-finish`。
- **離開判定**：靠時戳比對，離開期間不需要有東西在跑。
- **跨天歸零**：讀取時比對日期字串即可。

### 為什麼不需要跨分頁同步

計時條件包含 `document.hasFocus()`，兩個分頁不可能同時有焦點 → 天然互斥，不會重複計。

## 資料

```js
// chrome.storage.local — 執行狀態
{ accumMs, day: "2026-08-10", lastActive, snoozeUntil }

// chrome.storage.sync — 設定
{ limitMin: 4, mode: "manual", autoResetSec: 60, snoozeMin: 5 }
```

`lastActive` = **上一次真正累加的那一秒**的時戳，不是「上次看到 Shorts 頁」。

理由：Chrome 會把背景分頁的 `setInterval` 節流到約每分鐘一次。若以「上次看到 Shorts 頁」為基準，切到別的分頁時 tick 幾乎不跑，`now - lastSeen` 永遠讀起來在 60 秒內，離開十分鐘也不會觸發歸零。改以「上次累加」為基準則免疫：背景分頁本來就不累加，時戳凍結在離開前那一刻，回來時算出的差值是真實經過時間。同一個定義順帶涵蓋暫停與關閉瀏覽器。

副作用（刻意接受）：模式 `auto` 下，在 Shorts 頁按暫停超過 N 秒也會歸零。符合「連續觀看」語意。

## 計時迴圈（content.js，每秒）

1. 遮罩已顯示 → 暫停任何正在播的影片後直接 return（凍結計時，並防止使用者用鍵盤/滾輪在遮罩後方切下一支）
2. 組 ctx：`now`、`day`、`onShorts`、`playing`
3. 呼叫 `tick(state, settings, ctx)`
4. 狀態有變才寫 `storage.local`（避免閒置時每秒寫磁碟）
5. `showOverlay` 為真 → 顯示遮罩

`playing` 的判定取「所有 `<video>` 中真正在播且 `readyState > 2` 的那一個」，而非固定選擇器。Shorts 頁同時存在多個預載的 video 元素，固定選擇器會選到暫停中的鄰居；`readyState > 2` 則避免把卡緩衝的時間算進去。

## 遮罩

Shadow DOM 隔離 YouTube 的 CSS，`position:fixed; inset:0; z-index:2147483647`。

兩顆按鈕：

- **我休息** → `accumMs = 0`、`snoozeUntil = 0`，關遮罩，影片維持暫停
- **再看 N 分鐘** → `snoozeUntil = now + snoozeMin`，關遮罩，影片繼續播。累計**不**歸零，所以延後時間到會再跳一次

## 測試

`tick.js` 是純函式，把唯一容易寫錯的三段邏輯（模式切換、歸零規則、跨天）關在裡面。`node tick.test.js` 跑 assert，無框架、無相依。

涵蓋：只在觀看中累加、不在 Shorts 不累加、達門檻觸發遮罩、manual 模式長時間中斷不歸零、auto 模式超過門檻歸零、auto 模式未超過不歸零、跨天清空、snooze 期間不跳、`takeBreak` 歸零。

## 刻意跳過

service worker、SPA 導航事件監聽、統計圖表、每日總量上限、TikTok / Instagram Reels、`m.youtube.com`、圖示檔。
