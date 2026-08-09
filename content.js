// 每秒 tick 一次。輪詢 location.pathname 已經涵蓋 YouTube 的 SPA 換頁，
// 所以不需要攔 History API 或聽 yt-navigate-finish。
// tick.js 先載入，提供 tick / takeBreak / snooze / DEFAULT_SETTINGS / EMPTY_STATE。

const TICK_MS = 1000;
const STATE_KEY = 'ytShortsLimiterState';
const SETTINGS_KEY = 'ytShortsLimiterSettings';

let state = { ...EMPTY_STATE };
let settings = { ...DEFAULT_SETTINGS };
let overlay = null;
let lastWritten = '';

// 'sv' locale 剛好給出本地時區的 YYYY-MM-DD，不用自己補零
const todayStr = () => new Date().toLocaleDateString('sv');

// Shorts 頁同時存在多個預載的 <video>，固定選擇器會挑到暫停中的鄰居。
// readyState > 2 排除卡緩衝的情況，不然轉圈圈也會被算成在看。
function playingVideo() {
  return [...document.querySelectorAll('video')].find(
    (v) => !v.paused && !v.ended && v.readyState > 2
  );
}

function persist(next) {
  const json = JSON.stringify(next);
  if (json === lastWritten) return; // 不在 Shorts 時狀態不變，省掉每秒寫磁碟
  lastWritten = json;
  chrome.storage.local.set({ [STATE_KEY]: next });
}

function loop() {
  // 遮罩已顯示：凍結計時，並持續暫停影片 —— 使用者仍可用鍵盤或滾輪在遮罩
  // 後方切到下一支 Shorts，這一行比逐一攔截 keydown / wheel 便宜也更全面。
  if (overlay) {
    playingVideo()?.pause();
    return;
  }

  const onShorts = location.pathname.startsWith('/shorts/');
  const playing =
    !!playingVideo() && document.visibilityState === 'visible' && document.hasFocus();

  const result = tick(state, settings, {
    now: Date.now(),
    day: todayStr(),
    onShorts,
    playing,
    tickMs: TICK_MS,
  });

  state = result.state;
  persist(state);
  if (result.showOverlay) showReminder();
}

function showReminder() {
  playingVideo()?.pause();

  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483647';
  // closed shadow root：YouTube 的 CSS 進不來，我們的也出不去
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `
    <style>
      .backdrop {
        position: fixed; inset: 0;
        display: flex; align-items: center; justify-content: center;
        background: rgba(0, 0, 0, .82);
        backdrop-filter: blur(6px);
        font: 400 16px/1.6 system-ui, -apple-system, "Noto Sans TC", sans-serif;
        color: #fff;
      }
      .card { text-align: center; padding: 40px 48px; max-width: 420px; }
      h2 { margin: 0 0 8px; font-size: 28px; font-weight: 600; letter-spacing: .02em; }
      p { margin: 0 0 28px; color: #b9b9b9; font-size: 15px; }
      .row { display: flex; gap: 12px; justify-content: center; }
      button {
        font: inherit; font-size: 15px; padding: 10px 22px;
        border-radius: 8px; border: 0; cursor: pointer;
      }
      .primary { background: #fff; color: #111; font-weight: 600; }
      .ghost { background: transparent; color: #ddd; border: 1px solid #555; }
      .ghost:hover { border-color: #999; color: #fff; }
    </style>
    <div class="backdrop">
      <div class="card">
        <h2>已經連續看 ${Number(settings.limitMin)} 分鐘了</h2>
        <p>要不要休息一下？</p>
        <div class="row">
          <button class="primary" id="break">我休息</button>
          <button class="ghost" id="snooze">再看 ${Number(settings.snoozeMin)} 分鐘</button>
        </div>
      </div>
    </div>`;

  root.getElementById('break').addEventListener('click', () => {
    state = takeBreak(state);
    persist(state);
    dismiss(); // 影片維持暫停
  });

  root.getElementById('snooze').addEventListener('click', () => {
    state = snooze(state, settings, Date.now());
    persist(state);
    dismiss();
    document.querySelector('#shorts-player video')?.play();
  });

  document.body.appendChild(host);
  overlay = host;
}

function dismiss() {
  overlay?.remove();
  overlay = null;
}

chrome.storage.local.get(STATE_KEY).then((local) => {
  state = { ...EMPTY_STATE, ...local[STATE_KEY] };
  lastWritten = JSON.stringify(state);
  return chrome.storage.sync.get(SETTINGS_KEY);
}).then((sync) => {
  settings = { ...DEFAULT_SETTINGS, ...sync[SETTINGS_KEY] };
  setInterval(loop, TICK_MS);
});

// popup 改設定或按「立即歸零」時即時反映，不用重整頁面
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes[SETTINGS_KEY]) {
    settings = { ...DEFAULT_SETTINGS, ...changes[SETTINGS_KEY].newValue };
  }
  if (area === 'local' && changes[STATE_KEY]) {
    const next = JSON.stringify(changes[STATE_KEY].newValue);
    if (next !== lastWritten) {
      state = { ...EMPTY_STATE, ...changes[STATE_KEY].newValue };
      lastWritten = next;
      if (state.accumMs === 0) dismiss();
    }
  }
});
