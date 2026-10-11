import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { RouteMap, MapMarker, MapRoute } from '../../../components/route-map/route-map';
import { PRICING, RULES } from '../../../config/config';
import { Customer } from '../../../model/customer';
import { OrderGetResponse } from '../../../model/order';
import { RoutePlan } from '../../../model/route-plan';
import { CustomerApi } from '../../../services/api/customer-api';
import { OrderApi } from '../../../services/api/order-api';
import { PlanApi } from '../../../services/api/plan-api';
import { RoutePlanner } from '../../../services/route-planner';
import { Notify } from '../../../services/notify';
import { deadlineTime, thaiDate, todayStr } from '../../../services/helpers';

@Component({
  selector: 'app-dashboard',
  imports: [RouterModule, DecimalPipe, RouteMap],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  customerApi = inject(CustomerApi);
  orderApi = inject(OrderApi);
  planApi = inject(PlanApi);
  planner = inject(RoutePlanner);
  notify = inject(Notify);

  today = todayStr();
  todayText = thaiDate();
  rules = RULES;
  pricing = PRICING;
  deadline = deadlineTime();

  loading = signal(true);
  customers = signal<Customer[]>([]);
  orders = signal<OrderGetResponse[]>([]);
  plan = signal<RoutePlan | null>(null);
  simulating = signal(false);

  boxes = computed(() => this.orders().reduce((s, o) => s + o.quantity, 0));
  revenue = computed(() => this.boxes() * PRICING.pricePerBox);
  grossMargin = computed(() => this.boxes() * (PRICING.pricePerBox - PRICING.costPerBox));
  planStale = computed(() => {
    const p = this.plan();
    return !!p && p.orderSignature !== this.planner.orderSignature(this.orders());
  });

  markers = computed<MapMarker[]>(() => {
    const p = this.plan();
    if (p && !this.planStale()) {
      return p.routes.flatMap((r) =>
        r.stops.map((s) => ({
          id: `s${s.orderId}`,
          lat: s.lat,
          lng: s.lng,
          kind: 'stop' as const,
          label: String(s.seq),
          color: r.color,
          title: `ไรเดอร์ ${r.riderNo} · จุดที่ ${s.seq}`,
          subtitle: `${s.customerName} · ${s.quantity} กล่อง · ถึง ${s.arriveTime}`,
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
    const p = this.plan();
    if (!p || this.planStale()) return [];
    return p.routes.map((r) => ({ id: r.riderNo, color: r.color, points: r.stops }));
  });

  ngOnInit() {
    this.load();
  }

  async load() {
    this.loading.set(true);
    try {
      const [customers, orders, plan] = await Promise.all([
        this.customerApi.getCustomers(),
        this.orderApi.getOrders(this.today),
        this.planApi.getConfirmedPlan(this.today),
      ]);
      this.customers.set(customers);
      this.orders.set(orders);
      this.plan.set(plan);
    } catch (e) {
      this.notify.error(e);
    } finally {
      this.loading.set(false);
    }
  }

  async simulate() {
    this.simulating.set(true);
    try {
      const count = 20 + Math.floor(Math.random() * 11); // 20 - 30 ออเดอร์
      const added = await this.orderApi.simulateOrders(this.today, count);
      this.notify.show(added ? `จำลองออเดอร์เข้ามา ${added} รายการ` : 'ลูกค้าทุกคนสั่งไปแล้ววันนี้');
      await this.load();
    } catch (e) {
      this.notify.error(e);
    } finally {
      this.simulating.set(false);
    }
  }
}
