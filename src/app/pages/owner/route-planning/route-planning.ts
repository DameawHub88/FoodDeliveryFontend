import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MapMarker, MapRoute, RouteMap } from '../../../components/route-map/route-map';
import { PRICING, RULES } from '../../../config/config';
import { OrderGetResponse } from '../../../model/order';
import { RoutePlan } from '../../../model/route-plan';
import { OrderApi } from '../../../services/api/order-api';
import { PlanApi } from '../../../services/api/plan-api';
import { Notify } from '../../../services/notify';
import { RoutePlanner } from '../../../services/route-planner';
import { deadlineTime, formatPhone, todayStr } from '../../../services/helpers';

@Component({
  selector: 'app-route-planning',
  imports: [RouterModule, DecimalPipe, RouteMap],
  templateUrl: './route-planning.html',
  styleUrl: './route-planning.css',
})
export class RoutePlanning {
  orderApi = inject(OrderApi);
  planApi = inject(PlanApi);
  planner = inject(RoutePlanner);
  notify = inject(Notify);

  today = todayStr();
  rules = RULES;
  pricing = PRICING;
  deadline = deadlineTime();
  formatPhone = formatPhone;

  orders = signal<OrderGetResponse[]>([]);
  confirmed = signal<RoutePlan | null>(null);
  loading = signal(true);
  computing = signal(false);
  saving = signal(false);
  activeRider = signal<number | null>(null);
  expanded = signal<number | null>(null);
  showAssumptions = signal(false);

  boxes = computed(() => this.orders().reduce((s, o) => s + o.quantity, 0));
  candidates = this.planner.candidates;

  // แผนที่กำลังแสดง: ทางเลือกที่เลือกอยู่ หรือแผนที่ยืนยันแล้ว
  shown = computed<RoutePlan | null>(() => {
    const c = this.candidates();
    if (c.length) return c[this.planner.selected()] ?? c[0];
    return this.confirmed();
  });
  isConfirmedView = computed(() => !this.candidates().length && !!this.confirmed());
  confirmedStale = computed(() => {
    const p = this.confirmed();
    return !!p && p.orderSignature !== this.planner.orderSignature(this.orders());
  });
  // กำไรที่ดีขึ้นเมื่อเทียบกับแบ่งงานตามลำดับออเดอร์แบบเดิม
  vsBaseline = computed(() => {
    const b = this.planner.baseline();
    const p = this.shown();
    return b && p && !this.isConfirmedView() ? Math.round((p.summary.profit - b.profit) * 100) / 100 : null;
  });

  markers = computed<MapMarker[]>(() => {
    const p = this.shown();
    const active = this.activeRider();
    if (p && !(this.isConfirmedView() && this.confirmedStale())) {
      return p.routes.flatMap((r) =>
        r.stops.map((s) => ({
          id: `${r.riderNo}-${s.orderId}`,
          lat: s.lat,
          lng: s.lng,
          kind: 'stop' as const,
          label: String(s.seq),
          color: r.color,
          title: `ไรเดอร์ ${r.riderNo} · จุดที่ ${s.seq} · ${s.customerName}`,
          subtitle: `${s.quantity} กล่อง · ถึงประมาณ ${s.arriveTime} น.`,
          active: active === r.riderNo,
          dim: active !== null && active !== r.riderNo,
        })),
      );
    }
    return this.orders().map((o) => ({
      id: `o${o.id}`,
      lat: o.customer.lat,
      lng: o.customer.lng,
      kind: 'customer' as const,
      label: String(o.quantity),
      title: o.customer.name,
      subtitle: `${o.quantity} กล่อง`,
    }));
  });

  mapRoutes = computed<MapRoute[]>(() => {
    const p = this.shown();
    if (!p || (this.isConfirmedView() && this.confirmedStale())) return [];
    return p.routes.map((r) => ({ id: r.riderNo, color: r.color, points: r.stops }));
  });

  ngOnInit() {
    this.load();
  }

  async load() {
    this.loading.set(true);
    try {
      const [orders, confirmed] = await Promise.all([
        this.orderApi.getOrders(this.today),
        this.planApi.getConfirmedPlan(this.today),
      ]);
      this.orders.set(orders);
      this.confirmed.set(confirmed);
      // ถ้าออเดอร์เปลี่ยนไปจากตอนที่คำนวณไว้ ให้ล้างทางเลือกเดิมทิ้ง
      const first = this.candidates()[0];
      if (first && first.orderSignature !== this.planner.orderSignature(orders)) {
        this.planner.clear();
      }
    } catch (e) {
      this.notify.error(e);
    } finally {
      this.loading.set(false);
    }
  }

  // กดปุ่ม "จัดเส้นทาง" / "คำนวณใหม่"
  compute(recalc = false) {
    if (!this.orders().length) return;
    this.computing.set(true);
    this.activeRider.set(null);
    this.expanded.set(null);
    // ปล่อยให้หน้าจอแสดงสถานะกำลังคำนวณก่อน
    setTimeout(() => {
      try {
        this.planner.generate(this.orders(), this.today, recalc);
        this.notify.show(recalc ? 'คำนวณเส้นทางทางเลือกใหม่แล้ว' : 'จัดเส้นทางเรียบร้อย เลือกแผนที่ต้องการได้เลย');
      } catch (e) {
        this.notify.error(e);
      } finally {
        this.computing.set(false);
      }
    }, 30);
  }

  selectCandidate(i: number) {
    this.planner.selected.set(i);
    this.activeRider.set(null);
    this.expanded.set(null);
  }

  toggleRider(no: number) {
    const open = this.expanded() === no ? null : no;
    this.expanded.set(open);
    this.activeRider.set(open);
  }

  async confirmPlan() {
    const p = this.shown();
    if (!p) return;
    if (p.summary.lateCount > 0) {
      this.notify.show('แผนนี้มีจุดที่ส่งไม่ทัน กรุณาคำนวณใหม่', 'error');
      return;
    }
    if (this.confirmed()) {
      const ok = await this.notify.confirm({
        title: 'แทนที่แผนเดิม?',
        message: 'วันนี้มีแผนที่ยืนยันไปแล้ว เลขใบงานเดิมจะใช้ไม่ได้ และจะออกเลขใบงานใหม่ให้ไรเดอร์ทุกคน',
        confirmText: 'ยืนยันแผนใหม่',
      });
      if (!ok) return;
    }
    this.saving.set(true);
    try {
      const saved = await this.planApi.confirmPlan(p);
      this.confirmed.set(saved);
      this.planner.clear();
      this.activeRider.set(null);
      this.expanded.set(null);
      this.notify.show(`ยืนยันแผนแล้ว ออกใบงาน ${saved.routes.length} ใบ`);
    } catch (e) {
      this.notify.error(e);
    } finally {
      this.saving.set(false);
    }
  }

  async cancelConfirmed() {
    const p = this.confirmed();
    if (!p) return;
    const ok = await this.notify.confirm({
      title: 'ยกเลิกแผนที่ยืนยันแล้ว?',
      message: 'เลขใบงานของไรเดอร์ทั้งหมดในแผนนี้จะใช้ไม่ได้',
      confirmText: 'ยกเลิกแผน',
      danger: true,
    });
    if (!ok) return;
    try {
      await this.planApi.cancelPlan(p.id);
      this.confirmed.set(null);
      this.notify.show('ยกเลิกแผนแล้ว');
    } catch (e) {
      this.notify.error(e);
    }
  }

  discardCandidates() {
    this.planner.clear();
    this.activeRider.set(null);
    this.expanded.set(null);
  }

  jobUrl(code: string): string {
    return `${location.origin}/rider/${code}`;
  }

  async copyJob(code: string) {
    try {
      await navigator.clipboard.writeText(this.jobUrl(code));
      this.notify.show(`คัดลอกลิงก์ใบงาน #${code} แล้ว`);
    } catch {
      this.notify.show(`เลขใบงาน ${code}`);
    }
  }
}
