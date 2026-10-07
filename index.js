// 天地無聲勢
// 生成期間播放一段無聲音訊。iOS 會讓「正在播放聲音」的網頁在背景繼續執行，
// 這樣切到別的 App 時 Safari 不會暫停 ST 頁面，生成也就不會被中斷。

const MODULE = 'tiandiWusheng';
const VERSION = '1.3.0';
const MAX_MS = 10 * 60 * 1000; // 保險：就算沒收到結束事件，最多播十分鐘
const PRIME_MS = 5000;         // 按了送出卻沒開始生成的話，五秒後停
// 會觸發生成的按鈕：送出、重刷（最後一則往右滑）、重新生成、繼續
const TRIGGERS = '#send_but, .swipe_right, #option_regenerate, #option_continue, #mes_continue';

const { eventSource, event_types, extensionSettings, saveSettingsDebounced } = SillyTavern.getContext();
extensionSettings[MODULE] = Object.assign({ enabled: true }, extensionSettings[MODULE]);
const settings = extensionSettings[MODULE];

// 現場產生一段無聲 WAV（8 kHz、8-bit、單聲道），不必另外附音檔。
// 長度必須超過 5 秒：Chrome 把 5 秒以下的聲音當成短暫音效，不掛播放通知，也不替頁面撐背景
// （Chromium media_content_type.cc 的 kMinimumContentDurationSecs = 5）
function silentWavUrl(seconds = 10, rate = 8000) {
    const n = seconds * rate;
    const buf = new ArrayBuffer(44 + n);
    const v = new DataView(buf);
    const tag = (at, s) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
    tag(0, 'RIFF'); v.setUint32(4, 36 + n, true); tag(8, 'WAVE');
    tag(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
    tag(36, 'data'); v.setUint32(40, n, true);
    new Uint8Array(buf, 44).fill(128); // 8-bit PCM 的靜音值是 128，不是 0
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

let unlocked = false;
let running = false;
let timer = null;
let primeTimer = null;
let savePending = false;

function setStatus(text) {
    const el = document.getElementById('tiandi_status');
    if (el) el.textContent = text;
}

function makeAudio() {
    const a = new Audio(silentWavUrl());
    a.loop = true;
    a.preload = 'auto';
    a.setAttribute('playsinline', '');
    // 生成中被系統暫停（來電、Siri、別的 App 出聲），等下一次點擊再接上
    a.addEventListener('pause', () => { if (running) setStatus('被打斷了：點一下畫面就會接上'); });
    return a;
}
let audio = makeAudio();

function play(onOk) {
    audio.play().then(onOk).catch(err => {
        unlocked = false;
        if (err.name !== 'NotAllowedError') audio = makeAudio(); // 元件壞了就換一個新的
        if (running) setStatus('未能起勢：點一下畫面就會接上，不用重新整理');
    });
}

// iOS 規定播放要發生在使用者點擊的當下，而且被別的聲音打斷後會收回許可。
// 所以一直監聽點擊，每一下都看情況處理：
//   ・點的是會開始生成的按鈕 → 當場就播，不等事後的事件（許可被收回也不怕）
//   ・生成中卻沒在播（被打斷或起勢失敗）→ 趁這一下接上
//   ・還沒解鎖 → 播一下再停，把音訊元件解鎖
function onTap(e) {
    if (!settings.enabled) return;
    const trigger = e.target instanceof Element && e.target.closest(TRIGGERS);
    if (trigger && !running) {
        clearTimeout(primeTimer);
        primeTimer = setTimeout(() => { if (!running) { audio.pause(); audio.currentTime = 0; } }, PRIME_MS);
        play(() => { unlocked = true; });
    } else if (running && audio.paused) {
        play(() => { unlocked = true; setStatus('運功中…'); });
    } else if (!unlocked) {
        play(() => {
            unlocked = true;
            if (!running) { audio.pause(); audio.currentTime = 0; setStatus('已解鎖，待命中'); }
        });
    }
}
document.addEventListener('touchend', onTap, true);
document.addEventListener('click', onTap, true);

function start() {
    if (!settings.enabled) return;
    running = true;
    clearTimeout(primeTimer);
    clearTimeout(timer);
    timer = setTimeout(stop, MAX_MS);
    if ('mediaSession' in navigator && typeof MediaMetadata !== 'undefined') {
        navigator.mediaSession.metadata = new MediaMetadata({ title: '天地無聲勢', artist: 'SillyTavern', album: '生成中' });
    }
    if (!audio.paused) { setStatus('運功中…'); return; } // 按送出時已經起勢了
    play(() => setStatus('運功中…'));
}

function stop() {
    running = false;
    clearTimeout(timer);
    timer = null;
    clearTimeout(primeTimer);
    audio.pause();
    audio.currentTime = 0;
    // 生成若在背景結束，ST 緊接著送出的存檔請求可能被 iOS 擋掉。記下來，等切回前景再補存一次
    if (document.visibilityState === 'hidden') savePending = true;
    setStatus(unlocked ? '收勢，待命中' : '待命中（點一下畫面即可解鎖）');
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (running && audio.paused) play(() => setStatus('運功中…')); // 回到前景時順手接上
    if (savePending) {
        savePending = false;
        // 等網路恢復再存；不跳通知，失敗的話 ST 自己會跳紅色通知
        setTimeout(() => SillyTavern.getContext().saveChat(), 1500);
    }
});

// 「開始生成」事件連試算（dryRun）都會發，試算卻沒有「結束」事件，會卡在運功中。
// 改聽「指令處理完、真的要生成了」的事件，並略過試算與背景生成
const startEvent = event_types.GENERATION_AFTER_COMMANDS ?? event_types.GENERATION_STARTED;
eventSource.on(startEvent, (type, options, dryRun) => { if (!dryRun && type !== 'quiet') start(); });
eventSource.on(event_types.GENERATION_ENDED, stop);
eventSource.on(event_types.GENERATION_STOPPED, stop);

// 擴充設定面板
const panel = document.getElementById('extensions_settings2') ?? document.getElementById('extensions_settings');
panel?.insertAdjacentHTML('beforeend', `
<div class="tiandi-wusheng-settings">
    <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>天地無聲勢 <small>v${VERSION}</small></b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
            <label class="checkbox_label" for="tiandi_enabled">
                <input type="checkbox" id="tiandi_enabled">
                <span>啟用：生成期間播放無聲音訊，手機切到背景也不斷線</span>
            </label>
            <small>狀態：<span id="tiandi_status">待命中（點一下畫面即可解鎖）</span></small>
            <small>運功期間會暫停其他 App 正在播的音樂。</small>
        </div>
    </div>
</div>`);
const box = document.getElementById('tiandi_enabled');
if (box) {
    box.checked = settings.enabled;
    box.addEventListener('change', () => {
        settings.enabled = box.checked;
        if (!settings.enabled) stop();
        saveSettingsDebounced();
    });
}

// 除錯用：在瀏覽器主控台可以查看目前狀態
globalThis.__tiandiWusheng = {
    get audio() { return audio; }, get unlocked() { return unlocked; },
    get running() { return running; }, get savePending() { return savePending; },
};
