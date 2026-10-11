import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MapMarker, RouteMap } from '../../../components/route-map/route-map';
import { PRICING, RULES } from '../../../config/config';
import { Customer } from '../../../model/customer';
import { OrderGetResponse } from '../../../model/order';
import { CustomerApi } from '../../../services/api/customer-api';
import { OrderApi } from '../../../services/api/order-api';
import { Notify } from '../../../services/notify';
import {
  cleanPhone,
  distanceFromShopKm,
  formatPhone,
  LatLng,
  thaiDate,
  todayStr,
} from '../../../services/helpers';

@Component({
  selector: 'app-orders',
  imports: [FormsModule, RouterModule, DecimalPipe, DatePipe, RouteMap],
  templateUrl: './orders.html',
  styleUrl: './orders.css',
})
export class Orders {
  customerApi = inject(CustomerApi);
  orderApi = inject(OrderApi);
  notify = inject(Notify);

  today = todayStr();
  todayText = thaiDate();
  rules = RULES;
  pricing = PRICING;
  formatPhone = formatPhone;
  distance = distanceFromShopKm;
  quantities = Array.from({ length: RULES.maxBoxesPerOrder }, (_, i) => i + 1);

  orders = signal<OrderGetResponse[]>([]);
  loading = signal(true);
  busy = signal(false);
  focus = signal<LatLng | null>(null);
  highlightId = signal<number | null>(null);

  // ฟอร์มรับออเดอร์
  phone = signal('');
  lookup = signal<'idle' | 'searching' | 'found' | 'new'>('idle');
  found = signal<Customer | null>(null);
  newName = signal('');
  newAddress = signal('');
  newPoint = signal<LatLng | null>(null);
  quantity = signal(1);
  note = signal('');
  submitted = signal(false);

  boxes = computed(() => this.orders().reduce((s, o) => s + o.quantity, 0));
  foundTodayBoxes = computed(() => {
    const c = this.found();
    return c ? this.orders().filter((o) => o.customerId === c.id).reduce((s, o) => s + o.quantity, 0) : 0;
  });

  markers = computed<MapMarker[]>(() =>
    this.orders().map((o, i) => ({
      id: String(o.id),
      lat: o.customer.lat,
      lng: o.customer.lng,
      kind: 'customer' as const,
      label: String(o.quantity),
      title: `#${i + 1} ${o.customer.name}`,
      subtitle: `${o.quantity} กล่อง · ${formatPhone(o.customer.phone)}`,
      active: o.id === this.highlightId(),
    })),
  );

  ngOnInit() {
    this.load();
  }

  async load() {
    try {
      this.orders.set(await this.orderApi.getOrders(this.today));
    } catch (e) {
      this.notify.error(e);
    } finally {
      this.loading.set(false);
    }
  }

  // ลูกค้าเก่า ใส่เบอร์โทรก็เจอ
  onPhoneChange(value: string) {
    this.phone.set(value);
    const p = cleanPhone(value);
    if (p.length >= 9) {
      this.searchPhone();
    } else {
      this.lookup.set('idle');
      this.found.set(null);
    }
  }

  async searchPhone() {
    const p = cleanPhone(this.phone());
    if (!/^0\d{8,9}$/.test(p)) {
      this.notify.show('กรุณากรอกเบอร์โทรให้ครบ 9-10 หลัก', 'error');
      return;
    }
    this.lookup.set('searching');
    try {
      const c = await this.customerApi.findByPhone(p);
      if (cleanPhone(this.phone()) !== p) return; // ผู้ใช้พิมพ์ต่อแล้ว
      this.found.set(c);
      this.lookup.set(c ? 'found' : 'new');
      if (c) {
        this.focus.set({ lat: c.lat, lng: c.lng });
      } else {
        this.newName.set('');
        this.newAddress.set('');
        this.newPoint.set(null);
      }
    } catch (e) {
      this.lookup.set('idle');
      this.notify.error(e);
    }
  }

  onPicked(p: LatLng) {
    if (this.lookup() === 'new') this.newPoint.set(p);
  }

  resetForm() {
    this.phone.set('');
    this.lookup.set('idle');
    this.found.set(null);
    this.quantity.set(1);
    this.note.set('');
    this.newPoint.set(null);
    this.submitted.set(false);
  }

  async addOrder() {
    this.submitted.set(true);
    let customer = this.found();
    try {
      if (this.lookup() === 'new') {
        if (!this.newName().trim() || !this.newPoint()) return;
        this.busy.set(true);
        customer = await this.customerApi.addCustomer({
          name: this.newName().trim(),
          phone: cleanPhone(this.phone()),
          address: this.newAddress().trim(),
          lat: this.newPoint()!.lat,
          lng: this.newPoint()!.lng,
        });
      }
      if (!customer) {
        this.notify.show('กรุณาค้นหาลูกค้าด้วยเบอร์โทรก่อน', 'error');
        return;
      }
      this.busy.set(true);
      const order = await this.orderApi.addOrder({
        customerId: customer.id,
        quantity: this.quantity(),
        orderDate: this.today,
        note: this.note().trim(),
      });
      this.notify.show(`รับออเดอร์ ${customer.name} ${order.quantity} กล่อง แล้ว`);
      this.resetForm();
      await this.load();
      this.highlightId.set(order.id);
    } catch (e) {
      this.notify.error(e);
    } finally {
      this.busy.set(false);
    }
  }

  async changeQuantity(o: OrderGetResponse, delta: number) {
    const q = o.quantity + delta;
    if (q < 1 || q > RULES.maxBoxesPerOrder) return;
    try {
      await this.orderApi.updateQuantity(o.id, q);
      this.orders.update((rows) => rows.map((r) => (r.id === o.id ? { ...r, quantity: q } : r)));
    } catch (e) {
      this.notify.error(e);
    }
  }

  async remove(o: OrderGetResponse) {
    const ok = await this.notify.confirm({
      title: 'ลบออเดอร์นี้?',
      message: `${o.customer.name} · ${o.quantity} กล่อง`,
      confirmText: 'ลบ',
      danger: true,
    });
    if (!ok) return;
    try {
      await this.orderApi.deleteOrder(o.id);
      this.orders.update((rows) => rows.filter((r) => r.id !== o.id));
      this.notify.show('ลบออเดอร์แล้ว');
    } catch (e) {
      this.notify.error(e);
    }
  }

  async simulate() {
    this.busy.set(true);
    try {
      const count = 20 + Math.floor(Math.random() * 11);
      const added = await this.orderApi.simulateOrders(this.today, count);
      this.notify.show(added ? `จำลองออเดอร์เข้ามา ${added} รายการ` : 'ลูกค้าทุกคนสั่งไปแล้ววันนี้');
      await this.load();
    } catch (e) {
      this.notify.error(e);
    } finally {
      this.busy.set(false);
    }
  }

  async clearAll() {
    const ok = await this.notify.confirm({
      title: 'ล้างออเดอร์วันนี้ทั้งหมด?',
      message: `ออเดอร์ ${this.orders().length} รายการของวันนี้จะถูกลบทั้งหมด`,
      confirmText: 'ล้างทั้งหมด',
      danger: true,
    });
    if (!ok) return;
    try {
      await this.orderApi.clearOrders(this.today);
      this.orders.set([]);
      this.notify.show('ล้างออเดอร์วันนี้แล้ว');
    } catch (e) {
      this.notify.error(e);
    }
  }

  show(o: OrderGetResponse) {
    this.highlightId.set(o.id);
    this.focus.set({ lat: o.customer.lat, lng: o.customer.lng });
  }
}
