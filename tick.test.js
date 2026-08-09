// node tick.test.js
const assert = require('assert');
const { tick, takeBreak, snooze, EMPTY_STATE } = require('./tick.js');

const DAY = '2026-08-10';
const T0 = 1_760_000_000_000;

// 連跑 n 秒的觀看，回傳最後的 state 與是否該跳遮罩
function watch(state, settings, n, startAt = T0, day = DAY) {
  let s = state, show = false;
  for (let i = 0; i < n; i++) {
    const r = tick(s, settings, {
      now: startAt + i * 1000, day, onShorts: true, playing: true, tickMs: 1000,
    });
    s = r.state;
    show = r.showOverlay;
  }
  return { state: s, showOverlay: show };
}

// 只在觀看中累加
{
  const { state } = watch(EMPTY_STATE, {}, 10);
  assert.strictEqual(state.accumMs, 10_000);
}

// 在 Shorts 但沒在播 → 不累加
{
  const { state } = tick(EMPTY_STATE, {}, {
    now: T0, day: DAY, onShorts: true, playing: false, tickMs: 1000,
  });
  assert.strictEqual(state.accumMs, 0);
}

// 不在 Shorts 頁 → 不累加、不跳遮罩
{
  const seeded = { ...EMPTY_STATE, day: DAY, accumMs: 999_000 };
  const r = tick(seeded, { limitMin: 4 }, {
    now: T0, day: DAY, onShorts: false, playing: true, tickMs: 1000,
  });
  assert.strictEqual(r.state.accumMs, 999_000);
  assert.strictEqual(r.showOverlay, false);
}

// 達門檻觸發遮罩，未達則否
{
  const cfg = { limitMin: 4 };
  assert.strictEqual(watch(EMPTY_STATE, cfg, 239).showOverlay, false);
  assert.strictEqual(watch(EMPTY_STATE, cfg, 240).showOverlay, true);
}

// manual 模式：中斷一小時回來，累計原封不動
{
  const cfg = { limitMin: 4, mode: 'manual', autoResetSec: 60 };
  const { state } = watch(EMPTY_STATE, cfg, 100);
  const r = tick(state, cfg, {
    now: T0 + 3_600_000, day: DAY, onShorts: true, playing: true, tickMs: 1000,
  });
  assert.strictEqual(r.state.accumMs, 101_000);
}

// auto 模式：中斷超過 autoResetSec → 歸零（該 tick 自己那一秒仍算數）
{
  const cfg = { limitMin: 4, mode: 'auto', autoResetSec: 60 };
  const { state } = watch(EMPTY_STATE, cfg, 100);
  const r = tick(state, cfg, {
    now: T0 + 100_000 + 61_000, day: DAY, onShorts: true, playing: true, tickMs: 1000,
  });
  assert.strictEqual(r.state.accumMs, 1000);
}

// auto 模式：中斷未超過 autoResetSec → 繼續累加
{
  const cfg = { limitMin: 4, mode: 'auto', autoResetSec: 60 };
  const { state } = watch(EMPTY_STATE, cfg, 100);
  const r = tick(state, cfg, {
    now: T0 + 100_000 + 30_000, day: DAY, onShorts: true, playing: true, tickMs: 1000,
  });
  assert.strictEqual(r.state.accumMs, 101_000);
}

// auto 模式：從未看過（lastActive = 0）不該被誤判成中斷很久
{
  const cfg = { mode: 'auto', autoResetSec: 60 };
  const r = tick({ ...EMPTY_STATE, day: DAY, accumMs: 50_000 }, cfg, {
    now: T0, day: DAY, onShorts: true, playing: true, tickMs: 1000,
  });
  assert.strictEqual(r.state.accumMs, 51_000);
}

// 換日整組清空，包含還沒到期的 snooze
{
  const seeded = { day: '2026-08-09', accumMs: 500_000, lastActive: T0, snoozeUntil: T0 + 999_999 };
  const r = tick(seeded, { limitMin: 4 }, {
    now: T0, day: DAY, onShorts: true, playing: true, tickMs: 1000,
  });
  assert.strictEqual(r.state.accumMs, 1000);
  assert.strictEqual(r.state.snoozeUntil, 0);
  assert.strictEqual(r.showOverlay, false);
}

// snooze 期間不跳，到期後再跳，且累計沒有被歸零
{
  const cfg = { limitMin: 4, mode: 'manual', snoozeMin: 5 };
  const hit = watch(EMPTY_STATE, cfg, 240);
  assert.strictEqual(hit.showOverlay, true);

  const snoozed = snooze(hit.state, cfg, T0 + 240_000);
  assert.strictEqual(snoozed.accumMs, 240_000);

  const during = tick(snoozed, cfg, {
    now: T0 + 240_000 + 60_000, day: DAY, onShorts: true, playing: true, tickMs: 1000,
  });
  assert.strictEqual(during.showOverlay, false);

  const after = tick(during.state, cfg, {
    now: T0 + 240_000 + 301_000, day: DAY, onShorts: true, playing: true, tickMs: 1000,
  });
  assert.strictEqual(after.showOverlay, true);
}

// takeBreak 歸零並清掉 snooze
{
  const s = takeBreak({ ...EMPTY_STATE, accumMs: 300_000, snoozeUntil: T0 + 999 });
  assert.strictEqual(s.accumMs, 0);
  assert.strictEqual(s.snoozeUntil, 0);
}

console.log('tick.test.js: 全部通過');
