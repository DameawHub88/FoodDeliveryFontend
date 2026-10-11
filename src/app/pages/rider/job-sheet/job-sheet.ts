import { Component, computed, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MapMarker, MapRoute, RouteMap } from '../../../components/route-map/route-map';
import { JobSheet as Job, RouteStop } from '../../../model/route-plan';
import { PlanApi } from '../../../services/api/plan-api';
import { Notify } from '../../../services/notify';
import {
  addMinutes,
  formatPhone,
  googleMapsDirUrl,
  googleMapsPointUrl,
  thaiDate,
} from '../../../services/helpers';
import { RULES } from '../../../config/config';
import { RECENT_JOBS_KEY } from '../rider-login/rider-login';

@Component({
  selector: 'app-job-sheet',
  imports: [RouterModule, DecimalPipe, RouteMap],
  templateUrl: './job-sheet.html',
  styleUrl: './job-sheet.css',
})
export class JobSheet {
  private planApi = inject(PlanApi);
  private notify = inject(Notify);

  // รับเลขใบงานจาก path param /rider/:code
  code = input.required<string>();

  job = signal<Job | null>(null);
  loading = signal(true);
  formatPhone = formatPhone;
  pointUrl = googleMapsPointUrl;

  route = computed(() => this.job()?.route ?? null);
  deliveredCount = computed(() => this.route()?.stops.filter((s) => s.delivered).length ?? 0);
  allDone = computed(() => !!this.route() && this.deliveredCount() === this.route()!.stops.length);
  deadline = computed(() => addMinutes(this.job()?.departTime ?? RULES.departTime, RULES.deadlineMin));
  dateText = computed(() => (this.job() ? thaiDate(this.job()!.planDate) : ''));

  // ลิงก์ Google Maps นำทางทุกจุดที่ยังไม่ได้ส่ง ตามลำดับ
  navigateAllUrl = computed(() => {
    const r = this.route();
    if (!r) return '';
    const left = r.stops.filter((s) => !s.delivered);
    return googleMapsDirUrl(left.length ? left : r.stops);
  });

  markers = computed<MapMarker[]>(() => {
    const r = this.route();
    if (!r) return [];
    return r.stops.map((s) => ({
      id: String(s.orderId),
      lat: s.lat,
      lng: s.lng,
      kind: 'stop' as const,
      label: String(s.seq),
      color: s.delivered ? '#9e9e9e' : r.color,
      title: `จุดที่ ${s.seq} · คุณ${s.customerName}`,
      subtitle: `${s.quantity} กล่อง · ${s.address}`,
    }));
  });
  mapRoutes = computed<MapRoute[]>(() => {
    const r = this.route();
    return r ? [{ id: r.riderNo, color: r.color, points: r.stops }] : [];
  });

  ngOnInit() {
    this.load();
  }

  async load() {
    this.loading.set(true);
    try {
      const job = await this.planApi.getJob(this.code());
      this.job.set(job);
      if (job) this.remember(job.jobCode);
    } catch (e) {
      this.notify.error(e);
    } finally {
      this.loading.set(false);
    }
  }

  async toggleDelivered(s: RouteStop) {
    const job = this.job();
    if (!job) return;
    const delivered = !s.delivered;
    try {
      await this.planApi.setDelivered(job.jobCode, s.orderId, delivered);
      this.job.set({
        ...job,
        route: {
          ...job.route,
          stops: job.route.stops.map((x) => (x.orderId === s.orderId ? { ...x, delivered } : x)),
        },
      });
      if (delivered) this.notify.show(`ส่งจุดที่ ${s.seq} เรียบร้อย`);
    } catch (e) {
      this.notify.error(e);
    }
  }

  private remember(code: string) {
    try {
      const raw = localStorage.getItem(RECENT_JOBS_KEY);
      const list: string[] = raw ? JSON.parse(raw) : [];
      localStorage.setItem(RECENT_JOBS_KEY, JSON.stringify([code, ...list.filter((c) => c !== code)].slice(0, 5)));
    } catch {
      // ignore
    }
  }
}
