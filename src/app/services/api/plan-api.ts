import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { Api } from '../../config/api';
import { MockDb } from '../mock-db';
import { JobSheet, RoutePlan } from '../../model/route-plan';

@Injectable({
  providedIn: 'root',
})
export class PlanApi {
  http = inject(HttpClient);
  api = inject(Api);
  db = inject(MockDb);
  apiEndpoint = this.api.API_ENDPOINT;

  // GET /plans?date=YYYY-MM-DD  แผนที่ยืนยันแล้วของวันนั้น
  public async getConfirmedPlan(date: string): Promise<RoutePlan | null> {
    if (this.api.USE_MOCK) {
      return this.db.getPlans().find((p) => p.planDate === date && p.confirmed) ?? null;
    }
    const url = `${this.apiEndpoint}/plans`;
    const response = await lastValueFrom(this.http.get(url, { params: { date } }));
    const rows = response as RoutePlan[];
    return rows.length ? rows[0] : null;
  }

  // POST /plans  ยืนยันแผน + ออกเลขใบงานให้ไรเดอร์ทุกคน
  public async confirmPlan(plan: RoutePlan): Promise<RoutePlan> {
    if (this.api.USE_MOCK) {
      const plans = this.db.getPlans().filter((p) => !(p.planDate === plan.planDate && p.confirmed));
      const used = new Set(plans.flatMap((p) => p.routes.map((r) => r.jobCode)));
      const saved: RoutePlan = {
        ...plan,
        id: this.db.nextId(plans),
        confirmed: true,
        createdAt: new Date().toISOString(),
        routes: plan.routes.map((r) => ({ ...r, jobCode: this.newJobCode(used) })),
      };
      this.db.savePlans([...plans, saved]);
      return saved;
    }
    const url = `${this.apiEndpoint}/plans`;
    const response = await lastValueFrom(this.http.post(url, plan));
    return response as RoutePlan;
  }

  // DELETE /plans/:id  ยกเลิกแผน (ใบงานจะใช้ไม่ได้)
  public async cancelPlan(id: number): Promise<void> {
    if (this.api.USE_MOCK) {
      this.db.savePlans(this.db.getPlans().filter((p) => p.id !== id));
      return;
    }
    const url = `${this.apiEndpoint}/plans/${id}`;
    await lastValueFrom(this.http.delete(url));
  }

  // GET /jobs/:code  ไรเดอร์เปิดดูใบงานด้วยเลขใบงาน
  public async getJob(code: string): Promise<JobSheet | null> {
    if (this.api.USE_MOCK) {
      for (const plan of this.db.getPlans()) {
        const route = plan.routes.find((r) => r.jobCode === code);
        if (route) {
          return {
            jobCode: code,
            planId: plan.id,
            planDate: plan.planDate,
            departTime: plan.departTime,
            route,
          };
        }
      }
      return null;
    }
    const url = `${this.apiEndpoint}/jobs/${code}`;
    try {
      const response = await lastValueFrom(this.http.get(url));
      return response as JobSheet;
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status === 404) return null;
      throw e;
    }
  }

  // PUT /jobs/:code/stops/:orderId  ไรเดอร์กดว่าส่งแล้ว
  public async setDelivered(code: string, orderId: number, delivered: boolean): Promise<void> {
    if (this.api.USE_MOCK) {
      const plans = this.db.getPlans().map((p) => ({
        ...p,
        routes: p.routes.map((r) =>
          r.jobCode !== code
            ? r
            : { ...r, stops: r.stops.map((s) => (s.orderId === orderId ? { ...s, delivered } : s)) },
        ),
      }));
      this.db.savePlans(plans);
      return;
    }
    const url = `${this.apiEndpoint}/jobs/${code}/stops/${orderId}`;
    await lastValueFrom(this.http.put(url, { delivered }));
  }

  private newJobCode(used: Set<string>): string {
    let code = '';
    do {
      code = String(100000 + Math.floor(Math.random() * 900000));
    } while (used.has(code));
    used.add(code);
    return code;
  }
}
