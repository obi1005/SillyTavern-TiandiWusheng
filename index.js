// 天地無聲勢
// 生成期間播放一段無聲音訊。iOS 會讓「正在播放聲音」的網頁在背景繼續執行，
// 這樣切到別的 App 時 Safari 不會暫停 ST 頁面，生成也就不會被中斷。

const MODULE = 'tiandiWusheng';
const MAX_MS = 10 * 60 * 1000; // 保險：就算沒收到結束事件，最多播十分鐘

const { eventSource, event_types, extensionSettings, saveSettingsDebounced } = SillyTavern.getContext();
extensionSettings[MODULE] = Object.assign({ enabled: true }, extensionSettings[MODULE]);
const settings = extensionSettings[MODULE];

// 現場產生一秒的無聲 WAV（8 kHz、8-bit、單聲道），不必另外附音檔
function silentWavUrl(rate = 8000) {
    const buf = new ArrayBuffer(44 + rate);
    const v = new DataView(buf);
    const tag = (at, s) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
    tag(0, 'RIFF'); v.setUint32(4, 36 + rate, true); tag(8, 'WAVE');
    tag(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
    tag(36, 'data'); v.setUint32(40, rate, true);
    new Uint8Array(buf, 44).fill(128); // 8-bit PCM 的靜音值是 128，不是 0
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

const audio = new Audio(silentWavUrl());
audio.loop = true;
audio.preload = 'auto';
audio.setAttribute('playsinline', '');

let unlocked = false;
let running = false;
let timer = null;
let savePending = false;

function setStatus(text) {
    const el = document.getElementById('tiandi_status');
    if (el) el.textContent = text;
}

// iOS 規定：第一次播放必須發生在使用者點擊的當下。
// 所以點一下畫面（打字前點輸入框就算）時先播一下再停，把這個音訊元件「解鎖」，
// 之後生成開始時程式才能自己播。
function unlock() {
    if (unlocked) return;
    audio.play().then(() => {
        unlocked = true;
        if (!running) { audio.pause(); audio.currentTime = 0; } // 剛好按的是送出鈕的話，別把它停掉
        document.removeEventListener('touchend', unlock, true);
        document.removeEventListener('click', unlock, true);
        if (!running) setStatus('已解鎖，待命中');
    }).catch(() => { /* 這一下不算數，等下一次點擊 */ });
}
document.addEventListener('touchend', unlock, true);
document.addEventListener('click', unlock, true);

function start() {
    if (!settings.enabled) return;
    running = true;
    clearTimeout(timer);
    timer = setTimeout(stop, MAX_MS);
    if ('mediaSession' in navigator && typeof MediaMetadata !== 'undefined') {
        navigator.mediaSession.metadata = new MediaMetadata({ title: '天地無聲勢', artist: 'SillyTavern', album: '生成中' });
    }
    audio.play()
        .then(() => setStatus('運功中…'))
        .catch(err => setStatus(`未能起勢（${err.name}）：生成前先點一下畫面`));
}

function stop() {
    running = false;
    clearTimeout(timer);
    timer = null;
    audio.pause();
    audio.currentTime = 0;
    // 生成若在背景結束，ST 緊接著送出的存檔請求可能被 iOS 擋掉。記下來，等切回前景再補存一次
    if (document.visibilityState === 'hidden') savePending = true;
    setStatus(unlocked ? '收勢，待命中' : '待命中（點一下畫面即可解鎖）');
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !savePending) return;
    savePending = false;
    setTimeout(() => { // 等網路恢復
        globalThis.toastr?.info('生成在背景完成，補存一次聊天紀錄', '天地無聲勢');
        SillyTavern.getContext().saveChat(); // 失敗的話 ST 自己會跳紅色通知
    }, 1500);
});

eventSource.on(event_types.GENERATION_STARTED, start);
eventSource.on(event_types.GENERATION_ENDED, stop);
eventSource.on(event_types.GENERATION_STOPPED, stop);

// 擴充設定面板
const panel = document.getElementById('extensions_settings2') ?? document.getElementById('extensions_settings');
panel?.insertAdjacentHTML('beforeend', `
<div class="tiandi-wusheng-settings">
    <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>天地無聲勢</b>
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
globalThis.__tiandiWusheng = { audio, get unlocked() { return unlocked; }, get running() { return running; }, get savePending() { return savePending; } };
