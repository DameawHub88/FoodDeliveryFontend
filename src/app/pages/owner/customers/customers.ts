import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapMarker, RouteMap } from '../../../components/route-map/route-map';
import { RULES } from '../../../config/config';
import { Customer } from '../../../model/customer';
import { CustomerApi } from '../../../services/api/customer-api';
import { OrderApi } from '../../../services/api/order-api';
import { Notify } from '../../../services/notify';
import { cleanPhone, distanceFromShopKm, formatPhone, LatLng, todayStr } from '../../../services/helpers';

@Component({
  selector: 'app-customers',
  imports: [FormsModule, DecimalPipe, RouteMap],
  templateUrl: './customers.html',
  styleUrl: './customers.css',
})
export class Customers {
  customerApi = inject(CustomerApi);
  orderApi = inject(OrderApi);
  notify = inject(Notify);

  rules = RULES;
  formatPhone = formatPhone;
  distance = distanceFromShopKm;

  customers = signal<Customer[]>([]);
  orderedToday = signal<Map<number, number>>(new Map()); // customerId => จำนวนกล่องวันนี้
  keyword = signal('');
  selectedId = signal<number | null>(null);
  focus = signal<LatLng | null>(null);
  loading = signal(true);

  // ฟอร์มเพิ่ม/แก้ไข
  formOpen = signal(false);
  editId = signal<number | null>(null);
  name = signal('');
  phone = signal('');
  address = signal('');
  point = signal<LatLng | null>(null);
  submitted = signal(false);
  saving = signal(false);

  filtered = computed(() => {
    const k = this.keyword().trim().toLowerCase();
    const kPhone = cleanPhone(k);
    return this.customers()
      .filter(
        (c) =>
          !k ||
          c.name.toLowerCase().includes(k) ||
          c.address.toLowerCase().includes(k) ||
          (kPhone.length > 0 && cleanPhone(c.phone).includes(kPhone)),
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'th'));
  });

  markers = computed<MapMarker[]>(() =>
    this.filtered().map((c) => ({
      id: String(c.id),
      lat: c.lat,
      lng: c.lng,
      kind: 'customer' as const,
      label: this.orderedToday().has(c.id) ? String(this.orderedToday().get(c.id)) : '',
      color: this.orderedToday().has(c.id) ? '#c2185b' : '#121212',
      title: c.name,
      subtitle: `${formatPhone(c.phone)} · ${c.address}`,
      active: c.id === this.selectedId(),
      dim: this.formOpen() && c.id !== this.editId(),
    })),
  );

  // ตรวจความถูกต้องของฟอร์ม
  errors = computed(() => {
    const e: Record<string, string> = {};
    if (!this.name().trim()) e['name'] = 'กรุณากรอกชื่อลูกค้า';
    const p = cleanPhone(this.phone());
    if (!/^0\d{8,9}$/.test(p)) e['phone'] = 'เบอร์โทรต้องขึ้นต้นด้วย 0 และมี 9-10 หลัก';
    if (!this.point()) e['point'] = 'คลิกบนแผนที่เพื่อปักหมุดบ้านลูกค้า';
    return e;
  });
  pointKm = computed(() => (this.point() ? distanceFromShopKm(this.point()!) : 0));

  ngOnInit() {
    this.load();
  }

  async load() {
    this.loading.set(true);
    try {
      const [customers, orders] = await Promise.all([
        this.customerApi.getCustomers(),
        this.orderApi.getOrders(todayStr()),
      ]);
      this.customers.set(customers);
      const map = new Map<number, number>();
      orders.forEach((o) => map.set(o.customerId, (map.get(o.customerId) ?? 0) + o.quantity));
      this.orderedToday.set(map);
    } catch (e) {
      this.notify.error(e);
    } finally {
      this.loading.set(false);
    }
  }

  select(c: Customer) {
    this.selectedId.set(c.id);
    this.focus.set({ lat: c.lat, lng: c.lng });
  }

  onMarkerClick(id: string) {
    const c = this.customers().find((x) => String(x.id) === id);
    if (c && !this.formOpen()) {
      this.selectedId.set(c.id);
      document.getElementById('customer-' + c.id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  openNew() {
    this.editId.set(null);
    this.name.set('');
    this.phone.set('');
    this.address.set('');
    this.point.set(null);
    this.submitted.set(false);
    this.formOpen.set(true);
  }

  openEdit(c: Customer) {
    this.editId.set(c.id);
    this.name.set(c.name);
    this.phone.set(c.phone);
    this.address.set(c.address);
    this.point.set({ lat: c.lat, lng: c.lng });
    this.submitted.set(false);
    this.formOpen.set(true);
    this.selectedId.set(c.id);
    this.focus.set({ lat: c.lat, lng: c.lng });
  }

  closeForm() {
    this.formOpen.set(false);
  }

  onPicked(p: LatLng) {
    if (this.formOpen()) this.point.set(p);
  }

  useMyLocation() {
    if (!navigator.geolocation) {
      this.notify.show('เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง', 'error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) };
        this.point.set(p);
        this.focus.set(p);
      },
      () => this.notify.show('ไม่สามารถอ่านตำแหน่งปัจจุบันได้', 'error'),
    );
  }

  async save() {
    this.submitted.set(true);
    if (Object.keys(this.errors()).length) return;
    this.saving.set(true);
    try {
      const data = {
        name: this.name().trim(),
        phone: cleanPhone(this.phone()),
        address: this.address().trim(),
        lat: this.point()!.lat,
        lng: this.point()!.lng,
      };
      const id = this.editId();
      const saved = id
        ? await this.customerApi.updateCustomer(id, data)
        : await this.customerApi.addCustomer(data);
      this.notify.show(id ? 'บันทึกการแก้ไขแล้ว' : `เพิ่มลูกค้า “${saved.name}” แล้ว`);
      this.formOpen.set(false);
      await this.load();
      this.selectedId.set(saved.id);
    } catch (e) {
      this.notify.error(e);
    } finally {
      this.saving.set(false);
    }
  }

  async remove(c: Customer) {
    const boxes = this.orderedToday().get(c.id);
    const ok = await this.notify.confirm({
      title: `ลบ “${c.name}”?`,
      message: boxes
        ? `ลูกค้าคนนี้มีออเดอร์วันนี้ ${boxes} กล่อง ออเดอร์จะถูกลบไปด้วย`
        : 'ข้อมูลลูกค้าคนนี้จะถูกลบออกจากระบบ',
      confirmText: 'ลบ',
      danger: true,
    });
    if (!ok) return;
    try {
      await this.customerApi.deleteCustomer(c.id);
      this.notify.show('ลบลูกค้าแล้ว');
      if (this.editId() === c.id) this.formOpen.set(false);
      await this.load();
    } catch (e) {
      this.notify.error(e);
    }
  }
}
