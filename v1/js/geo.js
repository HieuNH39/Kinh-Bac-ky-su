/* geo.js — Định vị GPS và tính khoảng cách.
   Vị trí chỉ được xử lý ngay trên điện thoại, không gửi đi đâu cả. */
const Geo = (() => {
  let watchId = null;
  let last = null; // {lat, lng, acc}
  let sim = null;  // vị trí giả lập (chế độ thử), khi có thì bỏ qua GPS thật
  const listeners = [];
  const notify = () => listeners.forEach((fn) => fn(last));

  // Công thức haversine: khoảng cách (mét) giữa 2 điểm trên mặt đất
  function distance(a, b) {
    const R = 6371000, rad = (x) => (x * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function format(m) {
    if (m < 1000) return `${Math.round(m / 10) * 10} m`;
    if (m < 10000) return `${(m / 1000).toFixed(1).replace(".", ",")} km`;
    return `${Math.round(m / 1000)} km`;
  }

  // Bắt đầu theo dõi vị trí; onError nhận "denied" hoặc "none"
  function start(onError) {
    if (!("geolocation" in navigator)) { onError && onError("none"); return false; }
    if (watchId !== null) return true;
    watchId = navigator.geolocation.watchPosition(
      (p) => {
        if (sim) return; // đang thử vị trí thì không ghi đè
        last = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy };
        notify();
      },
      (err) => { onError && onError(err.code === 1 ? "denied" : "none"); },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
    return true;
  }

  // Chế độ thử: đặt vị trí giả lập (để kiểm thử, trình diễn khi không ở di tích)
  function simulate(pos) {
    sim = pos;
    last = pos ? { lat: pos.lat, lng: pos.lng, acc: 5, sim: true } : null;
    if (last) notify();
  }

  return {
    start, distance, format, simulate,
    get simulated() { return sim !== null; },
    onUpdate: (fn) => listeners.push(fn),
    get position() { return last; },
    get active() { return watchId !== null; },
  };
})();
