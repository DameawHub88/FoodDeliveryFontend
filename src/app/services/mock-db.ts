import { Injectable } from '@angular/core';
import { Customer } from '../model/customer';
import { Order } from '../model/order';
import { RoutePlan } from '../model/route-plan';
import { SHOP } from '../config/config';
import { seededRandom } from './helpers';

// ฐานข้อมูลจำลองเก็บใน LocalStorage (ใช้แทน Back end ระหว่างพัฒนา)
@Injectable({
  providedIn: 'root',
})
export class MockDb {
  private readonly KEYS = {
    customers: 'fd_customers',
    orders: 'fd_orders',
    plans: 'fd_plans',
  };
  private memory: Record<string, string> = {};

  getCustomers(): Customer[] {
    let rows = this.read<Customer>(this.KEYS.customers);
    if (rows === null) {
      rows = this.seedCustomers();
      this.saveCustomers(rows);
    }
    return rows;
  }
  saveCustomers(rows: Customer[]) {
    this.write(this.KEYS.customers, rows);
  }

  getOrders(): Order[] {
    return this.read<Order>(this.KEYS.orders) ?? [];
  }
  saveOrders(rows: Order[]) {
    this.write(this.KEYS.orders, rows);
  }

  getPlans(): RoutePlan[] {
    return this.read<RoutePlan>(this.KEYS.plans) ?? [];
  }
  savePlans(rows: RoutePlan[]) {
    this.write(this.KEYS.plans, rows);
  }

  nextId(rows: { id: number }[]): number {
    return rows.reduce((max, r) => Math.max(max, r.id), 0) + 1;
  }

  // ล้างข้อมูลทั้งหมดแล้วเริ่มจากข้อมูลตัวอย่างใหม่
  reset() {
    Object.values(this.KEYS).forEach((key) => this.remove(key));
  }

  private read<T>(key: string): T[] | null {
    let raw: string | null = null;
    try {
      raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : this.memory[key];
    } catch {
      raw = this.memory[key] ?? null;
    }
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T[];
    } catch {
      return null;
    }
  }

  private write(key: string, rows: unknown[]) {
    const raw = JSON.stringify(rows);
    this.memory[key] = raw;
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, raw);
    } catch {
      // ไม่มี localStorage ก็เก็บไว้ในหน่วยความจำแทน
    }
  }

  private remove(key: string) {
    delete this.memory[key];
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }

  // ลูกค้าตัวอย่าง กระจายรอบร้านในระยะไม่เกิน 3 กม.
  private seedCustomers(): Customer[] {
    const names = [
      'สมชาย ใจดี', 'กมลวรรณ ศรีสุข', 'ธนพล แก้วมณี', 'พิมพ์ชนก บุญมา', 'อนุชา ทองดี',
      'ศิริพร พรหมมา', 'วีรยุทธ ศักดิ์ดี', 'ณัฐธิดา คำแสน', 'ปิยะพงษ์ ภูมิใจ', 'สุดารัตน์ วงศ์ไทย',
      'กิตติพัฒน์ มีสุข', 'จิราพร แสงทอง', 'ชยพล นาคสวัสดิ์', 'อรอุมา จันทร์เพ็ญ', 'ภานุวัฒน์ สายบุญ',
      'รัตนาภรณ์ ดีมาก', 'ธีรวัฒน์ หอมจันทร์', 'นภัสสร ศรีวงศ์', 'พงศกร ไชยสิทธิ์', 'มาลัยพร ทองคำ',
      'เอกชัย ประเสริฐ', 'วรรณิศา ชาญชัย', 'สุริยา พิมพ์ทอง', 'กัญญาณัฐ อินทร์แก้ว', 'ภัทรพล ทองสุข',
      'ชลธิชา บุญเรือง', 'ศุภชัย คงมั่น', 'ปวีณา สุขเจริญ', 'ณัฐวุฒิ ปัญญาดี', 'อัญชลี พรมสุวรรณ',
      'ธนากร ศรีบุญ', 'ลลิตา วงศ์สวัสดิ์', 'วุฒิชัย สีดา', 'ปาริชาต มูลมาตย์', 'ก้องภพ ศรีสะอาด',
      'เบญจมาศ คำดี',
    ];
    const places = [
      'หอพักในมหาวิทยาลัย', 'หอพักหน้ามอ', 'อาคารสำนักงาน', 'ร้านถ่ายเอกสาร', 'บ้านพักบุคลากร',
      'คอนโดใกล้ตลาด', 'ซอยหลังมอ', 'อพาร์ตเมนต์ริมถนน', 'บ้านในหมู่บ้าน', 'ร้านกาแฟหน้าคณะ',
    ];
    const rand = seededRandom(20261011);
    return names.map((name, i) => {
      const angle = rand() * Math.PI * 2;
      const r = 0.35 + Math.sqrt(rand()) * 2.5; // 0.35 - 2.85 กม.
      const lat = SHOP.lat + (r / 110.574) * Math.cos(angle);
      const lng = SHOP.lng + (r / (111.32 * Math.cos((SHOP.lat * Math.PI) / 180))) * Math.sin(angle);
      const phone = '08' + String(Math.floor(10000000 + rand() * 89999999));
      return {
        id: i + 1,
        name,
        phone,
        address: `${places[i % places.length]} เลขที่ ${Math.floor(rand() * 200) + 1}`,
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
      };
    });
  }
}
