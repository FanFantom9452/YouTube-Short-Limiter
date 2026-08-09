const STATE_KEY = 'ytShortsLimiterState';
const SETTINGS_KEY = 'ytShortsLimiterSettings';
const NUMBERS = ['limitMin', 'resetAfterMin', 'snoozeMin'];

const $ = (id) => document.getElementById(id);

function fmt(ms) {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)} 分 ${String(total % 60).padStart(2, '0')} 秒`;
}

async function save() {
  const settings = { ...DEFAULT_SETTINGS, mode: $('mode').value, showHud: $('showHud').checked };
  for (const k of NUMBERS) {
    const el = $(k);
    // 空值或超出 min/max 時退回預設，不要把 NaN 寫進設定
    settings[k] = el.value !== '' && el.checkValidity() ? Number(el.value) : DEFAULT_SETTINGS[k];
  }
  await chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
  $('saved').textContent = '已儲存';
  setTimeout(() => ($('saved').textContent = ''), 1200);
}

async function load() {
  const [sync, local] = await Promise.all([
    chrome.storage.sync.get(SETTINGS_KEY),
    chrome.storage.local.get(STATE_KEY),
  ]);
  const settings = { ...DEFAULT_SETTINGS, ...sync[SETTINGS_KEY] };
  for (const k of NUMBERS) $(k).value = settings[k];
  $('mode').value = settings.mode;
  $('showHud').checked = settings.showHud;

  const state = { ...EMPTY_STATE, ...local[STATE_KEY] };
  const today = new Date().toLocaleDateString('sv');
  $('accum').textContent = fmt(state.day === today ? state.accumMs : 0);
}

[...NUMBERS, 'mode', 'showHud'].forEach((k) => $(k).addEventListener('change', save));

$('reset').addEventListener('click', async () => {
  const local = await chrome.storage.local.get(STATE_KEY);
  const next = clearCounter({ ...EMPTY_STATE, ...local[STATE_KEY] });
  await chrome.storage.local.set({ [STATE_KEY]: next });
  $('accum').textContent = fmt(0);
});

load();
