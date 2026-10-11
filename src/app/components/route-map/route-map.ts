import {
  afterNextRender,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type * as Leaflet from 'leaflet';
import { SHOP } from '../../config/config';
import { escapeHtml, LatLng } from '../../services/helpers';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  kind: 'customer' | 'stop';
  label?: string; // ตัวเลขบนหมุด
  color?: string;
  title?: string;
  subtitle?: string;
  active?: boolean;
  dim?: boolean;
}

export interface MapRoute {
  id: number; // หมายเลขไรเดอร์
  color: string;
  points: LatLng[]; // จุดส่งตามลำดับ (เริ่มจากร้านอัตโนมัติ)
}

@Component({
  selector: 'app-route-map',
  imports: [],
  templateUrl: './route-map.html',
  styleUrl: './route-map.css',
  host: { class: 'block relative isolate overflow-clip bg-neutral-100' },
})
export class RouteMap {
  markers = input<MapMarker[]>([]);
  routes = input<MapRoute[]>([]);
  activeRoute = input<number | null>(null);
  pickable = input(false); // คลิกบนแผนที่เพื่อเลือกพิกัด
  pickedPoint = input<LatLng | null>(null);
  focus = input<LatLng | null>(null);

  picked = output<LatLng>();
  markerClick = output<string>();
  routeClick = output<number>();

  private mapEl = viewChild.required<ElementRef<HTMLDivElement>>('mapEl');
  private L!: typeof Leaflet;
  private map?: Leaflet.Map;
  private dataLayer?: Leaflet.LayerGroup;
  private pickLayer?: Leaflet.LayerGroup;
  private lastFitKey = '';
  ready = signal(false);

  constructor() {
    // Leaflet ใช้ window จึงโหลดหลังแสดงผลบน browser แล้วเท่านั้น
    afterNextRender(() => this.init());

    effect(() => {
      const markers = this.markers();
      const routes = this.routes();
      const active = this.activeRoute();
      if (!this.ready()) return;
      untracked(() => this.draw(markers, routes, active));
    });

    effect(() => {
      const p = this.pickedPoint();
      if (!this.ready()) return;
      untracked(() => this.drawPicked(p));
    });

    effect(() => {
      const f = this.focus();
      if (!this.ready() || !f) return;
      untracked(() => this.map!.flyTo([f.lat, f.lng], Math.max(this.map!.getZoom(), 16), { duration: 0.6 }));
    });

    effect(() => {
      const pickable = this.pickable();
      if (!this.ready()) return;
      this.mapEl().nativeElement.style.cursor = pickable ? 'crosshair' : '';
    });

    inject(DestroyRef).onDestroy(() => this.map?.remove());
  }

  private async init() {
    const mod: any = await import('leaflet');
    this.L = (mod.default ?? mod) as typeof Leaflet;
    const L = this.L;
    const el = this.mapEl().nativeElement;

    this.map = L.map(el, { zoomControl: false, attributionControl: true }).setView([SHOP.lat, SHOP.lng], 14);
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.map);

    this.dataLayer = L.layerGroup().addTo(this.map);
    this.pickLayer = L.layerGroup().addTo(this.map);

    L.marker([SHOP.lat, SHOP.lng], { icon: this.shopIcon(), zIndexOffset: 3000 })
      .bindPopup(`<b>${escapeHtml(SHOP.name)}</b><br><span style="color:#666">${escapeHtml(SHOP.address)}</span>`)
      .addTo(this.map);

    this.map.on('click', (e: Leaflet.LeafletMouseEvent) => {
      if (this.pickable()) {
        this.picked.emit({ lat: Number(e.latlng.lat.toFixed(6)), lng: Number(e.latlng.lng.toFixed(6)) });
      }
    });

    // ปรับขนาดแผนที่เมื่อกล่องที่ครอบเปลี่ยนขนาด
    const ro = new ResizeObserver(() => this.map?.invalidateSize());
    ro.observe(el);
    this.map.on('unload', () => ro.disconnect());

    this.ready.set(true);
  }

  private draw(markers: MapMarker[], routes: MapRoute[], active: number | null) {
    const L = this.L;
    this.dataLayer!.clearLayers();

    for (const r of routes) {
      const dim = active !== null && active !== r.id;
      const pts: Leaflet.LatLngExpression[] = [SHOP, ...r.points].map((p) => [p.lat, p.lng]);
      L.polyline(pts, { color: '#ffffff', weight: 9, opacity: dim ? 0.25 : 0.95, interactive: false }).addTo(
        this.dataLayer!,
      );
      L.polyline(pts, {
        color: r.color,
        weight: active === r.id ? 7 : 5,
        opacity: dim ? 0.2 : 1,
        lineJoin: 'round',
        lineCap: 'round',
      })
        .on('click', () => this.routeClick.emit(r.id))
        .addTo(this.dataLayer!);
    }

    for (const m of markers) {
      const marker = L.marker([m.lat, m.lng], {
        icon: m.kind === 'stop' ? this.stopIcon(m) : this.customerIcon(m),
        zIndexOffset: m.active ? 2000 : m.dim ? -100 : 0,
        opacity: m.dim ? 0.45 : 1,
      });
      if (m.title) {
        marker.bindPopup(
          `<b>${escapeHtml(m.title)}</b>` +
            (m.subtitle ? `<br><span style="color:#555">${escapeHtml(m.subtitle)}</span>` : ''),
        );
      }
      marker.on('click', () => this.markerClick.emit(m.id)).addTo(this.dataLayer!);
    }

    // ซูมให้เห็นทุกจุด เมื่อชุดข้อมูลเปลี่ยน
    const key = markers.map((m) => m.id).join(',') + '#' + routes.map((r) => r.id + ':' + r.points.length).join(',');
    if (key !== this.lastFitKey) {
      this.lastFitKey = key;
      const all: Leaflet.LatLngTuple[] = [[SHOP.lat, SHOP.lng], ...markers.map((m) => [m.lat, m.lng] as Leaflet.LatLngTuple)];
      if (all.length > 1) {
        this.map!.fitBounds(L.latLngBounds(all), { padding: [48, 48], maxZoom: 16 });
      }
    }
  }

  private drawPicked(p: LatLng | null) {
    this.pickLayer!.clearLayers();
    if (!p) return;
    const html =
      '<div style="position:relative;width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);' +
      'background:#c2185b;border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.35)"></div>' +
      '<div style="position:absolute;top:9px;left:9px;width:16px;height:16px;border-radius:50%;background:#fff"></div>';
    this.L.marker([p.lat, p.lng], {
      icon: this.L.divIcon({ className: 'map-pin', html, iconSize: [34, 34], iconAnchor: [17, 41] }),
      zIndexOffset: 5000,
    }).addTo(this.pickLayer!);
  }

  private shopIcon() {
    const html =
      '<div style="display:grid;place-items:center;width:42px;height:42px;border-radius:9999px;background:#121212;' +
      'border:3px solid #fff;box-shadow:0 3px 12px rgba(0,0,0,.4)">' +
      '<span class="icon icon-fill" style="color:#f48fb1;font-size:22px">storefront</span></div>';
    return this.L.divIcon({ className: 'map-pin', html, iconSize: [42, 42], iconAnchor: [21, 21] });
  }

  private customerIcon(m: MapMarker) {
    const size = m.active ? 32 : 26;
    const color = m.color ?? '#c2185b';
    const html =
      `<div style="width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);` +
      `background:${color};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:grid;place-items:center">` +
      `<span style="transform:rotate(45deg);color:#fff;font-size:12px;font-weight:700">${escapeHtml(m.label ?? '')}</span></div>`;
    return this.L.divIcon({
      className: 'map-pin',
      html,
      iconSize: [size, size],
      iconAnchor: [size / 2, size * 1.2],
      popupAnchor: [0, -size],
    });
  }

  private stopIcon(m: MapMarker) {
    const size = m.active ? 34 : 28;
    const html =
      `<div style="display:grid;place-items:center;width:${size}px;height:${size}px;border-radius:9999px;` +
      `background:${m.color ?? '#c2185b'};color:#fff;font-weight:700;font-size:13px;border:2.5px solid #fff;` +
      `box-shadow:0 2px 6px rgba(0,0,0,.35)">${escapeHtml(m.label ?? '')}</div>`;
    return this.L.divIcon({ className: 'map-pin', html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
  }
}
