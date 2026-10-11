import { RULES, SHOP } from '../config/config';

export interface LatLng {
  lat: number;
  lng: number;
}

// ระยะทางเส้นตรงระหว่าง 2 พิกัด (กม.)
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ระยะทางถนนโดยประมาณ (กม.)
export function roadKm(a: LatLng, b: LatLng): number {
  return haversineKm(a, b) * RULES.roadFactor;
}

export function distanceFromShopKm(p: LatLng): number {
  return haversineKm(SHOP, p);
}

// วันที่วันนี้แบบ YYYY-MM-DD (เวลาท้องถิ่น)
export function todayStr(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// '11:30' + 42 นาที => '12:12'
export function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + Math.round(minutes);
  const hh = Math.floor(total / 60) % 24;
  return `${String(hh).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function deadlineTime(): string {
  return addMinutes(RULES.departTime, RULES.deadlineMin);
}

export function thaiDate(date: string | Date = new Date()): string {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
  return d.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// เบอร์โทรเหลือแต่ตัวเลข
export function cleanPhone(phone: string): string {
  return (phone || '').replace(/\D/g, '');
}

export function formatPhone(phone: string): string {
  const p = cleanPhone(phone);
  return p.length === 10 ? `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6)}` : phone;
}

// กันข้อความที่ผู้ใช้กรอกไม่ให้กลายเป็น HTML (ใช้ใน popup แผนที่)
export function escapeHtml(text: string): string {
  return String(text ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

// ตัวสุ่มแบบกำหนด seed ได้ (ให้ผลซ้ำเดิมเมื่อ seed เดิม)
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ลิงก์นำทาง Google Maps (หลายจุดได้)
export function googleMapsDirUrl(points: LatLng[], origin: LatLng = SHOP): string {
  const fmt = (p: LatLng) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
  const destination = points[points.length - 1];
  const waypoints = points.slice(0, -1).map(fmt).join('|');
  let url =
    'https://www.google.com/maps/dir/?api=1&travelmode=driving' +
    `&origin=${encodeURIComponent(fmt(origin))}&destination=${encodeURIComponent(fmt(destination))}`;
  if (waypoints) {
    url += `&waypoints=${encodeURIComponent(waypoints)}`;
  }
  return url;
}

export function googleMapsPointUrl(p: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
}
