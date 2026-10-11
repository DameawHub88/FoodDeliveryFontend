import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { Api } from '../../config/api';
import { MockDb } from '../mock-db';
import { Customer, CustomerPostRequest } from '../../model/customer';
import { cleanPhone } from '../helpers';

@Injectable({
  providedIn: 'root',
})
export class CustomerApi {
  http = inject(HttpClient);
  api = inject(Api);
  db = inject(MockDb);
  apiEndpoint = this.api.API_ENDPOINT;

  // GET /customers
  public async getCustomers(): Promise<Customer[]> {
    if (this.api.USE_MOCK) {
      return this.db.getCustomers();
    }
    const url = `${this.apiEndpoint}/customers`;
    const response = await lastValueFrom(this.http.get(url));
    return response as Customer[];
  }

  // GET /customers/search?phone=xxx  (ลูกค้าเก่า ใส่เบอร์โทรก็เจอ)
  public async findByPhone(phone: string): Promise<Customer | null> {
    const p = cleanPhone(phone);
    if (this.api.USE_MOCK) {
      return this.db.getCustomers().find((c) => cleanPhone(c.phone) === p) ?? null;
    }
    const url = `${this.apiEndpoint}/customers/search`;
    const response = await lastValueFrom(this.http.get(url, { params: { phone: p } }));
    const rows = response as Customer[];
    return rows.length ? rows[0] : null;
  }

  // POST /customers
  public async addCustomer(data: CustomerPostRequest): Promise<Customer> {
    if (this.api.USE_MOCK) {
      const rows = this.db.getCustomers();
      if (rows.some((c) => cleanPhone(c.phone) === cleanPhone(data.phone))) {
        throw new Error('เบอร์โทรนี้มีอยู่ในระบบแล้ว');
      }
      const customer: Customer = { ...data, id: this.db.nextId(rows) };
      this.db.saveCustomers([...rows, customer]);
      return customer;
    }
    const url = `${this.apiEndpoint}/customers`;
    const response = await lastValueFrom(this.http.post(url, data));
    return response as Customer;
  }

  // PUT /customers/:id
  public async updateCustomer(id: number, data: CustomerPostRequest): Promise<Customer> {
    if (this.api.USE_MOCK) {
      const rows = this.db.getCustomers();
      if (rows.some((c) => c.id !== id && cleanPhone(c.phone) === cleanPhone(data.phone))) {
        throw new Error('เบอร์โทรนี้เป็นของลูกค้าคนอื่นแล้ว');
      }
      const customer: Customer = { ...data, id };
      this.db.saveCustomers(rows.map((c) => (c.id === id ? customer : c)));
      return customer;
    }
    const url = `${this.apiEndpoint}/customers/${id}`;
    const response = await lastValueFrom(this.http.put(url, data));
    return response as Customer;
  }

  // DELETE /customers/:id  (ลบออเดอร์ของลูกค้าคนนี้ด้วย)
  public async deleteCustomer(id: number): Promise<void> {
    if (this.api.USE_MOCK) {
      this.db.saveCustomers(this.db.getCustomers().filter((c) => c.id !== id));
      this.db.saveOrders(this.db.getOrders().filter((o) => o.customerId !== id));
      return;
    }
    const url = `${this.apiEndpoint}/customers/${id}`;
    await lastValueFrom(this.http.delete(url));
  }
}
