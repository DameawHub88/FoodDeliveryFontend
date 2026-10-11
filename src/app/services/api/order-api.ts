import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { Api } from '../../config/api';
import { RULES } from '../../config/config';
import { MockDb } from '../mock-db';
import { Order, OrderGetResponse, OrderPostRequest } from '../../model/order';
import { CustomerApi } from './customer-api';

@Injectable({
  providedIn: 'root',
})
export class OrderApi {
  http = inject(HttpClient);
  api = inject(Api);
  db = inject(MockDb);
  customerApi = inject(CustomerApi);
  apiEndpoint = this.api.API_ENDPOINT;

  // GET /orders?date=YYYY-MM-DD  (join ข้อมูลลูกค้ามาด้วย)
  public async getOrders(date: string): Promise<OrderGetResponse[]> {
    if (this.api.USE_MOCK) {
      const customers = this.db.getCustomers();
      return this.db
        .getOrders()
        .filter((o) => o.orderDate === date)
        .map((o) => ({ ...o, customer: customers.find((c) => c.id === o.customerId)! }))
        .filter((o) => !!o.customer)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
    const url = `${this.apiEndpoint}/orders`;
    const response = await lastValueFrom(this.http.get(url, { params: { date } }));
    return response as OrderGetResponse[];
  }

  // POST /orders
  public async addOrder(data: OrderPostRequest): Promise<Order> {
    const quantity = this.checkQuantity(data.quantity);
    if (this.api.USE_MOCK) {
      const rows = this.db.getOrders();
      const order: Order = {
        id: this.db.nextId(rows),
        customerId: data.customerId,
        quantity,
        orderDate: data.orderDate,
        createdAt: new Date().toISOString(),
        note: data.note ?? '',
      };
      this.db.saveOrders([...rows, order]);
      return order;
    }
    const url = `${this.apiEndpoint}/orders`;
    const response = await lastValueFrom(this.http.post(url, { ...data, quantity }));
    return response as Order;
  }

  // PUT /orders/:id  (แก้ไขจำนวนที่สั่ง)
  public async updateQuantity(id: number, quantity: number): Promise<void> {
    quantity = this.checkQuantity(quantity);
    if (this.api.USE_MOCK) {
      this.db.saveOrders(this.db.getOrders().map((o) => (o.id === id ? { ...o, quantity } : o)));
      return;
    }
    const url = `${this.apiEndpoint}/orders/${id}`;
    await lastValueFrom(this.http.put(url, { quantity }));
  }

  // DELETE /orders/:id
  public async deleteOrder(id: number): Promise<void> {
    if (this.api.USE_MOCK) {
      this.db.saveOrders(this.db.getOrders().filter((o) => o.id !== id));
      return;
    }
    const url = `${this.apiEndpoint}/orders/${id}`;
    await lastValueFrom(this.http.delete(url));
  }

  // DELETE /orders?date=YYYY-MM-DD  (ล้างออเดอร์ทั้งวัน)
  public async clearOrders(date: string): Promise<void> {
    if (this.api.USE_MOCK) {
      this.db.saveOrders(this.db.getOrders().filter((o) => o.orderDate !== date));
      return;
    }
    const url = `${this.apiEndpoint}/orders`;
    await lastValueFrom(this.http.delete(url, { params: { date } }));
  }

  // จำลองการสั่งออเดอร์: สุ่มลูกค้าที่ยังไม่ได้สั่งวันนี้ สั่งคนละ 1-3 กล่อง
  public async simulateOrders(date: string, count: number): Promise<number> {
    const customers = await this.customerApi.getCustomers();
    const existing = await this.getOrders(date);
    const ordered = new Set(existing.map((o) => o.customerId));
    const pool = customers.filter((c) => !ordered.has(c.id));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const picked = pool.slice(0, count);
    for (const c of picked) {
      await this.addOrder({
        customerId: c.id,
        quantity: 1 + Math.floor(Math.random() * RULES.maxBoxesPerOrder),
        orderDate: date,
      });
    }
    return picked.length;
  }

  private checkQuantity(quantity: number): number {
    const q = Math.round(Number(quantity));
    if (!(q >= 1 && q <= RULES.maxBoxesPerOrder)) {
      throw new Error(`จำนวนต้องอยู่ระหว่าง 1 - ${RULES.maxBoxesPerOrder} กล่อง`);
    }
    return q;
  }
}
