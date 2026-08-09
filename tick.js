// 純函式狀態機。沒有 DOM、沒有 chrome API，所以可以直接被 node 測。
// 瀏覽器端當經典 script 載入（content script 與 popup 共用全域作用域）。

const DEFAULT_SETTINGS = {
  limitMin: 4,
  // 'manual' = 要先按過「我休息」，停止觀看才開始算休息
  // 'auto'   = 只要停止觀看就算，不需要按任何東西
  mode: 'manual',
  resetAfterMin: 5, // 停止觀看多久之後把累計歸零
  snoozeMin: 5,
  showHud: true,
};

const EMPTY_STATE = {
  accumMs: 0,
  day: '',
  lastActive: 0, // 上一次「真正累加」的時戳，不是上一次看到 Shorts 頁
  snoozeUntil: 0,
  resting: false, // 按過「我休息」；在影片重新播放之前不再彈遮罩
};

/**
 * @param ctx { now, day, onShorts, playing, tickMs }
 *   playing 已經包含「分頁可見 + 視窗有焦點 + 影片在播」三個條件
 * @returns { state, showOverlay, remainingMs, snoozed }
 */
function tick(state, settings, ctx) {
  const cfg = { ...DEFAULT_SETTINGS, ...settings };
  let s = { ...EMPTY_STATE, ...state };

  // 換日整組清空，包含還沒到期的 snooze
  if (s.day !== ctx.day) s = { ...EMPTY_STATE, day: ctx.day };

  // 歸零條件：停止觀看夠久。manual 模式還要求先按過「我休息」——「休息」因此
  // 真的是休息，而不是一鍵把計時器抹掉。
  //
  // 基準是「上次累加」而非「上次看到 Shorts」：背景分頁被 Chrome 節流成每分鐘
  // 一跳也不影響，那些跳不會累加，時戳凍結在離開前那一刻，差值就是真實經過
  // 時間。暫停與關瀏覽器同理。
  const restCounts = cfg.mode === 'auto' || s.resting;
  if (restCounts && s.lastActive && ctx.now - s.lastActive > cfg.resetAfterMin * 60000) {
    s = { ...s, accumMs: 0, snoozeUntil: 0, resting: false };
  }

  if (ctx.onShorts && ctx.playing) {
    // 休息中又重新播放 —— 休息作廢，遮罩這一刻就會回來
    s = { ...s, accumMs: s.accumMs + ctx.tickMs, lastActive: ctx.now, resting: false };
  }

  const snoozeLeftMs = Math.max(0, s.snoozeUntil - ctx.now);
  const limitLeftMs = Math.max(0, cfg.limitMin * 60000 - s.accumMs);

  return {
    state: s,
    showOverlay: ctx.onShorts && limitLeftMs === 0 && snoozeLeftMs === 0 && !s.resting,
    // 下一次彈遮罩前還剩多久，給右上角的倒數用
    remainingMs: snoozeLeftMs > 0 ? snoozeLeftMs : limitLeftMs,
    snoozed: snoozeLeftMs > 0,
  };
}

// 「我休息」：刻意不動累計。影片維持暫停；一旦重新播放，遮罩立刻回來。
// 累計要歸零，得真的停止觀看達 resetAfterMin。
function rest(state) {
  return { ...state, resting: true };
}

// 「再看 N 分鐘」：只給一段寬限，累計刻意不清，所以寬限到期會再跳一次。
function snooze(state, settings, now) {
  const cfg = { ...DEFAULT_SETTINGS, ...settings };
  return { ...state, snoozeUntil: now + cfg.snoozeMin * 60000, resting: false };
}

// popup 的「立即歸零」：唯一無條件清空累計的入口。
function clearCounter(state) {
  return { ...state, accumMs: 0, snoozeUntil: 0, resting: false };
}

if (typeof module !== 'undefined') {
  module.exports = { tick, rest, snooze, clearCounter, DEFAULT_SETTINGS, EMPTY_STATE };
}
