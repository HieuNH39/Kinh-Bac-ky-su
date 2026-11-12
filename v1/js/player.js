/* player.js — Trình phát thuyết minh dùng chung cho cả ứng dụng.
   Chỉ phát các file MP3 tạo sẵn từ kịch bản đã duyệt (thư mục audio/),
   nên nội dung nghe được luôn trùng khớp với lời thuyết minh in trên màn hình. */
const Player = (() => {
  const audio = document.getElementById("audio");
  const bar = document.getElementById("player");
  const btn = document.getElementById("playerToggle");
  const icon = document.getElementById("playerIcon");
  const title = document.getElementById("playerTitle");
  const seek = document.getElementById("playerSeek");
  const tNow = document.getElementById("playerTime");
  const tDur = document.getElementById("playerDur");
  const PLAY = "M8 5v14l11-7z", PAUSE = "M6 5h4v14H6zm8 0h4v14h-4z";
  let current = null; // {id, lang, title, href}
  const listeners = [];
  const endedListeners = []; // gọi khi nghe hết một bài (để gợi ý chơi đố vui)

  const fmt = (s) => (isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");
  const emit = () => listeners.forEach((fn) => fn(current, !audio.paused));

  // iPhone chặn tự phát âm thanh. Khi người dùng bấm "Bắt đầu", phát 0,1 giây im lặng
  // trên chính thẻ <audio> này; từ đó ứng dụng được phép tự phát lời giới thiệu.
  function silentWav() {
    const n = 800, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
    const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    w(0, "RIFF"); v.setUint32(4, 36 + n, true); w(8, "WAVE"); w(12, "fmt ");
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true);
    v.setUint16(34, 8, true); w(36, "data"); v.setUint32(40, n, true);
    for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
    let bin = ""; new Uint8Array(buf).forEach((b) => (bin += String.fromCharCode(b)));
    return "data:audio/wav;base64," + btoa(bin);
  }
  function unlock() {
    if (current) return; // đã có bài đang mở thì không cần
    audio.src = silentWav();
    audio.play().then(() => audio.pause()).catch(() => {});
  }

  function play(item) {
    if (!current || current.src !== item.src) {
      current = item;
      audio.src = item.src;
      title.textContent = item.title;
      title.href = item.href;
      bar.hidden = false;
      document.body.classList.add("has-player");
    }
    return audio.play().catch(() => {});
  }
  function toggle() { audio.paused ? audio.play().catch(() => {}) : audio.pause(); }

  btn.addEventListener("click", toggle);
  audio.addEventListener("play", () => { icon.setAttribute("d", PAUSE); emit(); });
  audio.addEventListener("pause", () => { icon.setAttribute("d", PLAY); emit(); });
  audio.addEventListener("ended", () => { icon.setAttribute("d", PLAY); emit(); endedListeners.forEach((fn) => fn(current)); });
  audio.addEventListener("loadedmetadata", () => { tDur.textContent = fmt(audio.duration); });
  audio.addEventListener("timeupdate", () => {
    tNow.textContent = fmt(audio.currentTime);
    if (audio.duration) seek.value = (audio.currentTime / audio.duration) * 100;
  });
  seek.addEventListener("input", () => {
    if (audio.duration) audio.currentTime = (seek.value / 100) * audio.duration;
  });

  return {
    play, toggle, unlock,
    onChange: (fn) => listeners.push(fn),
    onEnded: (fn) => endedListeners.push(fn),
    get current() { return current; },
    get playing() { return !audio.paused; },
    isPlaying: (src) => current && current.src === src && !audio.paused,
  };
})();
