// 純函式狀態機。沒有 DOM、沒有 chrome API，所以可以直接被 node 測。
// 瀏覽器端當經典 script 載入（content script 與 popup 共用全域作用域）。

const DEFAULT_SETTINGS = {
  limitMin: 4,
  mode: 'manual', // 'manual' = 只有按下「我休息」才歸零 | 'auto' = 停止觀看超過 autoResetSec 秒就歸零
  autoResetSec: 60,
  snoozeMin: 5,
};

const EMPTY_STATE = {
  accumMs: 0,
  day: '',
  lastActive: 0, // 上一次「真正累加」的時戳，不是上一次看到 Shorts 頁
  snoozeUntil: 0,
};

/**
 * @param ctx { now, day, onShorts, playing, tickMs }
 *   playing 已經包含「分頁可見 + 視窗有焦點 + 影片在播」三個條件
 * @returns { state, showOverlay }
 */
function tick(state, settings, ctx) {
  const cfg = { ...DEFAULT_SETTINGS, ...settings };
  let s = { ...EMPTY_STATE, ...state };

  // 換日整組清空，包含還沒到期的 snooze
  if (s.day !== ctx.day) s = { ...EMPTY_STATE, day: ctx.day };

  // 距離上次累加的空窗。因為基準是「上次累加」而非「上次看到 Shorts」，
  // 背景分頁被 Chrome 節流成每分鐘一跳也不影響：那些跳不會累加，時戳凍結
  // 在離開前那一刻，所以差值是真實經過時間。暫停與關瀏覽器同理。
  if (cfg.mode === 'auto' && s.lastActive && ctx.now - s.lastActive > cfg.autoResetSec * 1000) {
    s = { ...s, accumMs: 0, snoozeUntil: 0 };
  }

  if (ctx.onShorts && ctx.playing) {
    s = { ...s, accumMs: s.accumMs + ctx.tickMs, lastActive: ctx.now };
  }

  const showOverlay =
    ctx.onShorts && s.accumMs >= cfg.limitMin * 60000 && ctx.now >= s.snoozeUntil;

  return { state: s, showOverlay };
}

// 「我休息」：累計歸零，順便清掉 snooze
function takeBreak(state) {
  return { ...state, accumMs: 0, snoozeUntil: 0 };
}

// 「再看一下」：只延後，累計刻意不歸零，所以時間到會再跳一次
function snooze(state, settings, now) {
  const cfg = { ...DEFAULT_SETTINGS, ...settings };
  return { ...state, snoozeUntil: now + cfg.snoozeMin * 60000 };
}

if (typeof module !== 'undefined') {
  module.exports = { tick, takeBreak, snooze, DEFAULT_SETTINGS, EMPTY_STATE };
}
