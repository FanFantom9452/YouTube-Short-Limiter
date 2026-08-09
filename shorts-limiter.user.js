// ==UserScript==
// @name         YouTube Shorts 觀看提醒
// @namespace    https://github.com/FanFantom9452/YouTube-Short-Limiter
// @version      1.0.0
// @description  連續觀看 YouTube Shorts 達設定時間後，跳出全屏提醒並暫停影片。
// @match        https://www.youtube.com/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @require      https://raw.githubusercontent.com/FanFantom9452/YouTube-Short-Limiter/main/tick.js
// @downloadURL  https://raw.githubusercontent.com/FanFantom9452/YouTube-Short-Limiter/main/shorts-limiter.user.js
// @updateURL    https://raw.githubusercontent.com/FanFantom9452/YouTube-Short-Limiter/main/shorts-limiter.user.js
// ==/UserScript==

// @require 拉的是 repo 裡同一份 tick.js，跟 Chrome 擴充功能版共用邏輯與測試。
// 注意：Tampermonkey 會快取 @require 的內容，只改 tick.js 不會推送給既有使用者，
// 必須同時把上面的 @version 加上去才會觸發更新。

(function () {
  'use strict';

  const TICK_MS = 1000;
  const STATE_KEY = 'state';
  const SETTINGS_KEY = 'settings';

  // GM_getValue / GM_setValue 是同步的，不像 chrome.storage 要先 await 初始化
  let state = { ...EMPTY_STATE, ...GM_getValue(STATE_KEY, {}) };
  let settings = { ...DEFAULT_SETTINGS, ...GM_getValue(SETTINGS_KEY, {}) };
  let lastWritten = JSON.stringify(state);
  let reminder = null;

  // 'sv' locale 剛好給出本地時區的 YYYY-MM-DD，不用自己補零
  const todayStr = () => new Date().toLocaleDateString('sv');

  const fmt = (ms) =>
    `${Math.floor(ms / 60000)} 分 ${String(Math.floor(ms / 1000) % 60).padStart(2, '0')} 秒`;

  function persist() {
    const json = JSON.stringify(state);
    if (json === lastWritten) return; // 不在 Shorts 時狀態不變，省掉每秒寫入
    lastWritten = json;
    GM_setValue(STATE_KEY, state);
  }

  // Shorts 頁同時存在多個預載的 <video>，固定選擇器會挑到暫停中的鄰居。
  // readyState > 2 排除卡緩衝的情況，不然轉圈圈也會被算成在看。
  function playingVideo() {
    return [...document.querySelectorAll('video')].find(
      (v) => !v.paused && !v.ended && v.readyState > 2
    );
  }

  // 輪詢 location.pathname 已經涵蓋 YouTube 的 SPA 換頁，
  // 所以不需要攔 History API 或聽 yt-navigate-finish。
  function loop() {
    // 提醒已顯示：凍結計時，並持續暫停影片 —— 使用者仍可用鍵盤或滾輪在遮罩
    // 後方切到下一支 Shorts，這一行比逐一攔截 keydown / wheel 便宜也更全面。
    if (reminder) {
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
    persist();
    if (result.showOverlay) showReminder();
  }

  const PANEL_CSS = `
    .backdrop {
      position: fixed; inset: 0;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0, 0, 0, .82);
      backdrop-filter: blur(6px);
      font: 400 16px/1.6 system-ui, -apple-system, "Noto Sans TC", sans-serif;
      color: #fff;
    }
    .card { padding: 36px 44px; max-width: 420px; text-align: center; }
    h2 { margin: 0 0 8px; font-size: 26px; font-weight: 600; letter-spacing: .02em; }
    p { margin: 0 0 24px; color: #b9b9b9; font-size: 15px; }
    .row { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
    button {
      font: inherit; font-size: 15px; padding: 10px 22px;
      border-radius: 8px; border: 0; cursor: pointer;
    }
    .primary { background: #fff; color: #111; font-weight: 600; }
    .ghost { background: transparent; color: #ddd; border: 1px solid #555; }
    .ghost:hover { border-color: #999; color: #fff; }
    label { display: block; text-align: left; margin-bottom: 12px; font-size: 14px; color: #ccc; }
    input, select {
      width: 100%; box-sizing: border-box; margin-top: 4px; padding: 7px 9px;
      font: inherit; font-size: 15px; border-radius: 6px;
      border: 1px solid #555; background: #1c1c1c; color: #fff;
    }`;

  // closed shadow root：YouTube 的 CSS 進不來，我們的也出不去
  function makePanel(html) {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483647';
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `<style>${PANEL_CSS}</style>${html}`;
    document.body.appendChild(host);
    return { root, close: () => host.remove() };
  }

  function showReminder() {
    playingVideo()?.pause();

    const p = makePanel(`
      <div class="backdrop"><div class="card">
        <h2>已經連續看 ${Number(settings.limitMin)} 分鐘了</h2>
        <p>要不要休息一下？</p>
        <div class="row">
          <button class="primary" id="rest">我休息</button>
          <button class="ghost" id="more">再看 ${Number(settings.snoozeMin)} 分鐘</button>
        </div>
      </div></div>`);

    const dismiss = () => {
      p.close();
      reminder = null;
    };

    p.root.getElementById('rest').addEventListener('click', () => {
      state = takeBreak(state);
      persist();
      dismiss(); // 影片維持暫停
    });

    p.root.getElementById('more').addEventListener('click', () => {
      state = snooze(state, settings, Date.now());
      persist();
      dismiss();
      document.querySelector('#shorts-player video')?.play();
    });

    reminder = p;
  }

  function openSettings() {
    const shown = state.day === todayStr() ? state.accumMs : 0;

    const p = makePanel(`
      <div class="backdrop"><div class="card">
        <h2>Shorts 觀看提醒</h2>
        <p>目前累計連續觀看 ${fmt(shown)}</p>
        <label>提醒門檻（分鐘）
          <input id="limitMin" type="number" min="1" max="600" step="1" value="${Number(settings.limitMin)}">
        </label>
        <label>歸零方式
          <select id="mode">
            <option value="manual">只有按下「我休息」才歸零</option>
            <option value="auto">停止觀看一段時間後自動歸零</option>
          </select>
        </label>
        <label>停止多久算中斷（秒）
          <input id="autoResetSec" type="number" min="5" max="3600" step="5" value="${Number(settings.autoResetSec)}">
        </label>
        <label>「再看一下」延後（分鐘）
          <input id="snoozeMin" type="number" min="1" max="60" step="1" value="${Number(settings.snoozeMin)}">
        </label>
        <div class="row">
          <button class="primary" id="save">儲存</button>
          <button class="ghost" id="zero">立即歸零</button>
          <button class="ghost" id="close">關閉</button>
        </div>
      </div></div>`);

    // 用 .value 指定而非塞進 innerHTML，避免把使用者設定當 HTML 解析
    p.root.getElementById('mode').value = settings.mode;

    // 空值或超出 min/max 時退回預設，不要把 NaN 寫進設定
    const read = (id) => {
      const el = p.root.getElementById(id);
      return el.value !== '' && el.checkValidity() ? Number(el.value) : DEFAULT_SETTINGS[id];
    };

    p.root.getElementById('save').addEventListener('click', () => {
      settings = {
        limitMin: read('limitMin'),
        mode: p.root.getElementById('mode').value,
        autoResetSec: read('autoResetSec'),
        snoozeMin: read('snoozeMin'),
      };
      GM_setValue(SETTINGS_KEY, settings);
      p.close();
    });

    p.root.getElementById('zero').addEventListener('click', () => {
      state = takeBreak(state);
      persist();
      p.close();
    });

    p.root.getElementById('close').addEventListener('click', p.close);
  }

  GM_registerMenuCommand('設定提醒時間', openSettings);
  setInterval(loop, TICK_MS);
})();
