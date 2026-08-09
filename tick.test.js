// node tick.test.js
const assert = require('assert');
const { tick, rest, snooze, clearCounter, EMPTY_STATE } = require('./tick.js');

const DAY = '2026-08-10';
const T0 = 1_760_000_000_000;
const MIN = 60_000;

const at = (state, settings, now, opts = {}) =>
  tick(state, settings, {
    now,
    day: opts.day ?? DAY,
    onShorts: opts.onShorts ?? true,
    playing: opts.playing ?? true,
    tickMs: 1000,
  });

// 連跑 n 秒的觀看，回傳最後一個 tick 的完整結果
function watch(state, settings, n, startAt = T0) {
  let r = { state };
  for (let i = 0; i < n; i++) r = at(r.state, settings, startAt + i * 1000);
  return r;
}

// 只在觀看中累加
{
  assert.strictEqual(watch(EMPTY_STATE, {}, 10).state.accumMs, 10_000);
}

// 在 Shorts 但沒在播 → 不累加
{
  const r = at(EMPTY_STATE, {}, T0, { playing: false });
  assert.strictEqual(r.state.accumMs, 0);
}

// 不在 Shorts 頁 → 不累加、不彈遮罩
{
  const seeded = { ...EMPTY_STATE, day: DAY, accumMs: 999 * MIN };
  const r = at(seeded, { limitMin: 4 }, T0, { onShorts: false });
  assert.strictEqual(r.state.accumMs, 999 * MIN);
  assert.strictEqual(r.showOverlay, false);
}

// 達門檻觸發遮罩，未達則否
{
  const cfg = { limitMin: 4 };
  assert.strictEqual(watch(EMPTY_STATE, cfg, 239).showOverlay, false);
  assert.strictEqual(watch(EMPTY_STATE, cfg, 240).showOverlay, true);
}

// remainingMs 正常倒數，到門檻歸零
{
  const cfg = { limitMin: 4 };
  assert.strictEqual(watch(EMPTY_STATE, cfg, 1).remainingMs, 4 * MIN - 1000);
  assert.strictEqual(watch(EMPTY_STATE, cfg, 240).remainingMs, 0);
  assert.strictEqual(watch(EMPTY_STATE, cfg, 240).snoozed, false);
}

// 「我休息」不動累計，只壓住遮罩
{
  const cfg = { limitMin: 4 };
  const hit = watch(EMPTY_STATE, cfg, 240);
  assert.strictEqual(hit.showOverlay, true);

  const resting = rest(hit.state);
  assert.strictEqual(resting.accumMs, 240_000, '休息不該把累計抹掉');
  assert.strictEqual(resting.resting, true);

  // 休息中、影片沒播 → 不彈
  const idle = at(resting, cfg, T0 + 240_000 + 5000, { playing: false });
  assert.strictEqual(idle.showOverlay, false);
  assert.strictEqual(idle.state.accumMs, 240_000);
}

// 休息中一旦重新播放 → 休息作廢，遮罩立刻回來
{
  const cfg = { limitMin: 4 };
  const resting = rest(watch(EMPTY_STATE, cfg, 240).state);
  const played = at(resting, cfg, T0 + 240_000 + 5000, { playing: true });
  assert.strictEqual(played.state.resting, false);
  assert.strictEqual(played.showOverlay, true, '按了播放就要再擋一次');
}

// manual 模式：沒按過休息，離開再久也不歸零
{
  const cfg = { limitMin: 4, mode: 'manual', resetAfterMin: 5 };
  const before = watch(EMPTY_STATE, cfg, 240).state;
  const r = at(before, cfg, T0 + 240_000 + 60 * MIN);
  assert.strictEqual(r.state.accumMs, 241_000);
}

// manual 模式：按了休息 + 真的離開超過 resetAfterMin → 歸零
{
  const cfg = { limitMin: 4, mode: 'manual', resetAfterMin: 5 };
  const resting = rest(watch(EMPTY_STATE, cfg, 240).state);
  const back = at(resting, cfg, T0 + 240_000 + 5 * MIN + 1000);
  assert.strictEqual(back.state.accumMs, 1000, '歸零後這一秒重新開始算');
  assert.strictEqual(back.state.resting, false);
}

// manual 模式：按了休息但離開不夠久 → 不歸零
{
  const cfg = { limitMin: 4, mode: 'manual', resetAfterMin: 5 };
  const resting = rest(watch(EMPTY_STATE, cfg, 240).state);
  const back = at(resting, cfg, T0 + 240_000 + 2 * MIN);
  assert.strictEqual(back.state.accumMs, 241_000);
  assert.strictEqual(back.showOverlay, true);
}

// auto 模式：不需要按休息，停止觀看夠久就歸零
{
  const cfg = { limitMin: 4, mode: 'auto', resetAfterMin: 5 };
  const before = watch(EMPTY_STATE, cfg, 100).state;
  const back = at(before, cfg, T0 + 100_000 + 5 * MIN + 1000);
  assert.strictEqual(back.state.accumMs, 1000);
}

// auto 模式：中斷未達門檻 → 繼續累加
{
  const cfg = { limitMin: 4, mode: 'auto', resetAfterMin: 5 };
  const before = watch(EMPTY_STATE, cfg, 100).state;
  const back = at(before, cfg, T0 + 100_000 + 2 * MIN);
  assert.strictEqual(back.state.accumMs, 101_000);
}

// auto 模式：從未看過（lastActive = 0）不該被誤判成中斷很久
{
  const cfg = { mode: 'auto', resetAfterMin: 5 };
  const r = at({ ...EMPTY_STATE, day: DAY, accumMs: 50_000 }, cfg, T0);
  assert.strictEqual(r.state.accumMs, 51_000);
}

// 換日整組清空，包含還沒到期的 snooze 與休息狀態
{
  const seeded = {
    day: '2026-08-09', accumMs: 500_000, lastActive: T0, snoozeUntil: T0 + 999_999, resting: true,
  };
  const r = at(seeded, { limitMin: 4 }, T0);
  assert.strictEqual(r.state.accumMs, 1000);
  assert.strictEqual(r.state.snoozeUntil, 0);
  assert.strictEqual(r.state.resting, false);
  assert.strictEqual(r.showOverlay, false);
}

// 「再看 N 分鐘」：期間不彈、倒數顯示寬限剩餘、累計刻意不清，到期再彈
{
  const cfg = { limitMin: 4, mode: 'manual', snoozeMin: 5 };
  const hit = watch(EMPTY_STATE, cfg, 240);
  const snoozed = snooze(hit.state, cfg, T0 + 240_000);
  assert.strictEqual(snoozed.accumMs, 240_000, '再看一下不該清掉累計');
  assert.strictEqual(snoozed.resting, false);

  const during = at(snoozed, cfg, T0 + 240_000 + 60_000);
  assert.strictEqual(during.showOverlay, false);
  assert.strictEqual(during.snoozed, true);
  assert.strictEqual(during.remainingMs, 4 * MIN, '倒數要顯示寬限剩餘而不是門檻剩餘');

  const after = at(during.state, cfg, T0 + 240_000 + 5 * MIN + 1000);
  assert.strictEqual(after.showOverlay, true);
}

// clearCounter 清空累計、寬限與休息狀態
{
  const s = clearCounter({ ...EMPTY_STATE, accumMs: 300_000, snoozeUntil: T0 + 999, resting: true });
  assert.strictEqual(s.accumMs, 0);
  assert.strictEqual(s.snoozeUntil, 0);
  assert.strictEqual(s.resting, false);
}

console.log('tick.test.js: 全部通過');
