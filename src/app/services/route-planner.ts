import { Injectable, signal } from '@angular/core';
import { PRICING, RIDER_COLORS, RULES, SHOP } from '../config/config';
import { OrderGetResponse } from '../model/order';
import { PlanStrategy, PlanSummary, RiderRoute, RoutePlan, RouteStop } from '../model/route-plan';
import { addMinutes, LatLng, roadKm, seededRandom } from './helpers';

interface StrategyDef {
  strategy: PlanStrategy;
  label: string;
  // น้ำหนัก (บาท / นาทีที่ลูกค้ารอ) ยิ่งมากยิ่งเน้นส่งเร็ว ยิ่งน้อยยิ่งเน้นประหยัด
  lambda: number;
}

export const STRATEGIES: StrategyDef[] = [
  { strategy: 'cheapest', label: 'ประหยัดที่สุด', lambda: 0 },
  { strategy: 'balanced', label: 'สมดุล', lambda: 0.6 },
  { strategy: 'fastest', label: 'ส่งเร็วที่สุด', lambda: 2.5 },
];

interface RouteEval {
  seq: number[]; // index ของออเดอร์ตามลำดับการวิ่ง
  km: number;
  arrivals: number[];
  boxes: number;
  riderCost: number;
  late: boolean;
  obj: number;
}

// ตัวคำนวณสำหรับออเดอร์ชุดหนึ่ง (เก็บตารางระยะทางไว้ใช้ซ้ำ)
class Solver {
  private readonly dist: number[][]; // index 0 = ร้าน, i+1 = ออเดอร์ i
  private readonly cache = new Map<string, RouteEval>();
  private readonly minPerKm = 60 / RULES.riderSpeedKmh;

  constructor(
    private orders: OrderGetResponse[],
    private lambda: number,
  ) {
    const pts: LatLng[] = [SHOP, ...orders.map((o) => o.customer)];
    this.dist = pts.map((a) => pts.map((b) => roadKm(a, b)));
  }

  // คำนวณค่าใช้จ่าย/เวลาของเส้นทางตามลำดับที่กำหนด
  evalSeq(seq: number[]): RouteEval {
    let prev = 0;
    let km = 0;
    let t = 0;
    let boxes = 0;
    const arrivals: number[] = [];
    for (const i of seq) {
      const leg = this.dist[prev][i + 1];
      km += leg;
      t += leg * this.minPerKm;
      arrivals.push(t);
      t += RULES.serviceMinPerStop;
      boxes += this.orders[i].quantity;
      prev = i + 1;
    }
    const riderCost = PRICING.riderBaseFee + PRICING.riderFeePerKmPerBox * boxes * km;
    const lateMin = arrivals.reduce((s, a) => s + Math.max(0, a - RULES.deadlineMin), 0);
    const waiting = arrivals.reduce((s, a) => s + a, 0);
    const obj = riderCost + this.lambda * waiting + (lateMin > 0 ? 10000 + lateMin * 100 : 0);
    return { seq, km, arrivals, boxes, riderCost, late: lateMin > 0, obj };
  }

  // หาลำดับการวิ่งที่ดีที่สุดของกลุ่มออเดอร์ (ไม่เกิน 3 จุด ลองทุกลำดับได้)
  best(group: number[]): RouteEval {
    const key = [...group].sort((a, b) => a - b).join(',');
    const hit = this.cache.get(key);
    if (hit) return hit;
    let best: RouteEval | null = null;
    for (const seq of permutations(group)) {
      const e = this.evalSeq(seq);
      if (!best || e.obj < best.obj - 1e-9) best = e;
    }
    this.cache.set(key, best!);
    return best!;
  }

  objOf(group: number[]): number {
    return group.length ? this.best(group).obj : 0;
  }

  // 1) เริ่มจากทุกออเดอร์แยกคันกัน แล้วรวมคู่ที่ประหยัดที่สุดก่อน (Savings)
  // 2) ปรับปรุงด้วยการย้าย/สลับออเดอร์ระหว่างไรเดอร์ (Local search)
  solve(rand: () => number, noise: number): number[][] {
    let routes: number[][] = this.orders.map((_, i) => [i]);

    while (true) {
      let bestScore = 0;
      let pair: [number, number] | null = null;
      for (let a = 0; a < routes.length; a++) {
        for (let b = a + 1; b < routes.length; b++) {
          if (routes[a].length + routes[b].length > RULES.maxOrdersPerRider) continue;
          const merged = this.objOf([...routes[a], ...routes[b]]);
          const saving = this.objOf(routes[a]) + this.objOf(routes[b]) - merged;
          if (saving <= 1e-9) continue;
          const score = saving * (1 + noise * (rand() * 2 - 1));
          if (score > bestScore) {
            bestScore = score;
            pair = [a, b];
          }
        }
      }
      if (!pair) break;
      const [a, b] = pair;
      routes[a] = [...routes[a], ...routes[b]];
      routes.splice(b, 1);
    }

    routes = this.improve(routes);
    return routes.map((r) => this.best(r).seq);
  }

  private improve(routes: number[][]): number[][] {
    const max = RULES.maxOrdersPerRider;
    let improved = true;
    let guard = 0;
    while (improved && guard++ < 200) {
      improved = false;
      // ย้ายออเดอร์ไปคันอื่น หรือแยกไปคันใหม่
      outer: for (let a = 0; a < routes.length; a++) {
        for (const s of routes[a]) {
          const restA = routes[a].filter((x) => x !== s);
          const before = this.objOf(routes[a]);
          for (let b = -1; b < routes.length; b++) {
            if (b === a) continue;
            const target = b === -1 ? [] : routes[b];
            if (b === -1 && restA.length === 0) continue;
            if (target.length >= max) continue;
            const delta =
              this.objOf(restA) + this.objOf([...target, s]) - before - this.objOf(target);
            if (delta < -1e-6) {
              routes[a] = restA;
              if (b === -1) routes.push([s]);
              else routes[b] = [...target, s];
              routes = routes.filter((r) => r.length);
              improved = true;
              break outer;
            }
          }
        }
      }
      if (improved) continue;
      // สลับออเดอร์ระหว่าง 2 คัน
      swap: for (let a = 0; a < routes.length; a++) {
        for (let b = a + 1; b < routes.length; b++) {
          const before = this.objOf(routes[a]) + this.objOf(routes[b]);
          for (const s of routes[a]) {
            for (const t of routes[b]) {
              const na = routes[a].map((x) => (x === s ? t : x));
              const nb = routes[b].map((x) => (x === t ? s : x));
              if (this.objOf(na) + this.objOf(nb) < before - 1e-6) {
                routes[a] = na;
                routes[b] = nb;
                improved = true;
                break swap;
              }
            }
          }
        }
      }
    }
    return routes;
  }
}

function permutations(arr: number[]): number[][] {
  if (arr.length <= 1) return [arr];
  const out: number[][] = [];
  arr.forEach((x, i) => {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permutations(rest)) out.push([x, ...p]);
  });
  return out;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

@Injectable({
  providedIn: 'root',
})
export class RoutePlanner {
  // เก็บผลการคำนวณไว้ใน service เพื่อแชร์ข้ามหน้า (กลับมาหน้าเดิมแล้วข้อมูลยังอยู่)
  candidates = signal<RoutePlan[]>([]);
  selected = signal(0);
  baseline = signal<PlanSummary | null>(null);
  attempt = signal(0);
  private seen = new Set<string>();

  // กด "จัดเส้นทาง" (attempt = 0) หรือ "คำนวณใหม่" (attempt > 0) ได้ 3 ทางเลือก
  generate(orders: OrderGetResponse[], planDate: string, recalc = false): RoutePlan[] {
    if (!recalc) {
      this.seen.clear();
      this.attempt.set(0);
    } else {
      this.attempt.update((n) => n + 1);
    }
    const attempt = this.attempt();
    const rand = seededRandom(Date.now() % 1_000_000_007);
    const plans: RoutePlan[] = [];

    STRATEGIES.forEach((st, idx) => {
      const solver = new Solver(orders, st.lambda);
      const pool: { routes: number[][]; obj: number; sig: string }[] = [];
      const restarts = attempt === 0 ? 8 : 14;
      for (let r = 0; r < restarts; r++) {
        // รอบแรกแบบไม่สุ่ม = คำตอบที่ดีที่สุด, รอบต่อๆ ไปสุ่มเพื่อหาเส้นทางทางเลือก
        const noise = r === 0 && attempt === 0 ? 0 : 0.25 + 0.15 * Math.min(attempt, 4);
        const routes = solver.solve(rand, noise);
        const obj = routes.reduce((s, g) => s + solver.objOf(g), 0);
        pool.push({ routes, obj, sig: signature(orders, routes) });
      }
      pool.sort((a, b) => a.obj - b.obj);
      // เลือกคำตอบที่ดีที่สุดที่ยังไม่เคยเสนอ
      const pick = pool.find((p) => !this.seen.has(p.sig)) ?? pool[0];
      this.seen.add(pick.sig);
      plans.push(
        this.buildPlan(orders, pick.routes, planDate, st, -(attempt * 10 + idx + 1), solver),
      );
    });

    this.candidates.set(plans);
    this.selected.set(0);
    this.baseline.set(this.buildBaseline(orders, planDate));
    return plans;
  }

  clear() {
    this.candidates.set([]);
    this.selected.set(0);
    this.baseline.set(null);
    this.attempt.set(0);
    this.seen.clear();
  }

  // แบบเดิม: แบ่งงานตามลำดับออเดอร์ที่เข้ามา คันละ 3 ออเดอร์ วิ่งตามลำดับที่สั่ง
  buildBaseline(orders: OrderGetResponse[], planDate: string): PlanSummary {
    const sorted = orders
      .map((o, i) => ({ o, i }))
      .sort((a, b) => a.o.createdAt.localeCompare(b.o.createdAt));
    const routes: number[][] = [];
    for (let k = 0; k < sorted.length; k += RULES.maxOrdersPerRider) {
      routes.push(sorted.slice(k, k + RULES.maxOrdersPerRider).map((x) => x.i));
    }
    const solver = new Solver(orders, 0);
    return this.buildPlan(orders, routes, planDate, STRATEGIES[0], 0, solver, false).summary;
  }

  orderSignature(orders: OrderGetResponse[]): string {
    return [...orders]
      .sort((a, b) => a.id - b.id)
      .map((o) => `${o.id}:${o.quantity}:${o.customer.lat},${o.customer.lng}`)
      .join('|');
  }

  private buildPlan(
    orders: OrderGetResponse[],
    groups: number[][],
    planDate: string,
    st: StrategyDef,
    id: number,
    solver: Solver,
    optimizeOrder = true,
  ): RoutePlan {
    // เรียงไรเดอร์ตามทิศรอบร้าน (ตามเข็มนาฬิกาจากทิศเหนือ) ให้ดูง่ายบนแผนที่
    const angle = (g: number[]) => {
      const c = g.reduce(
        (acc, i) => ({ lat: acc.lat + orders[i].customer.lat, lng: acc.lng + orders[i].customer.lng }),
        { lat: 0, lng: 0 },
      );
      const a = Math.atan2(c.lng / g.length - SHOP.lng, c.lat / g.length - SHOP.lat);
      return a < 0 ? a + Math.PI * 2 : a;
    };
    const sortedGroups = [...groups].sort((a, b) => angle(a) - angle(b));

    const routes: RiderRoute[] = sortedGroups.map((g, k) => {
      const e = optimizeOrder ? solver.best(g) : solver.evalSeq(g);
      let prev: LatLng = SHOP;
      const stops: RouteStop[] = e.seq.map((i, n) => {
        const o = orders[i];
        const legKm = roadKm(prev, o.customer);
        prev = o.customer;
        return {
          seq: n + 1,
          orderId: o.id,
          customerId: o.customer.id,
          customerName: o.customer.name,
          phone: o.customer.phone,
          address: o.customer.address,
          lat: o.customer.lat,
          lng: o.customer.lng,
          quantity: o.quantity,
          legKm: round2(legKm),
          arriveMin: Math.round(e.arrivals[n]),
          arriveTime: addMinutes(RULES.departTime, e.arrivals[n]),
          delivered: false,
        };
      });
      const revenue = e.boxes * PRICING.pricePerBox;
      const foodCost = e.boxes * PRICING.costPerBox;
      const riderCost = round2(e.riderCost);
      return {
        riderNo: k + 1,
        color: RIDER_COLORS[k % RIDER_COLORS.length],
        jobCode: '',
        stops,
        totalBoxes: e.boxes,
        distanceKm: round2(e.km),
        durationMin: Math.round(e.arrivals[e.arrivals.length - 1] ?? 0),
        revenue,
        foodCost,
        riderCost,
        profit: round2(revenue - foodCost - riderCost),
        late: e.late,
      };
    });

    const allStops = routes.flatMap((r) => r.stops);
    const sum = (f: (r: RiderRoute) => number) => routes.reduce((s, r) => s + f(r), 0);
    const maxArrive = allStops.reduce((m, s) => Math.max(m, s.arriveMin), 0);
    const summary: PlanSummary = {
      orders: allStops.length,
      boxes: sum((r) => r.totalBoxes),
      riders: routes.length,
      revenue: sum((r) => r.revenue),
      foodCost: sum((r) => r.foodCost),
      riderCost: round2(sum((r) => r.riderCost)),
      profit: round2(sum((r) => r.profit)),
      totalKm: round2(sum((r) => r.distanceKm)),
      avgArriveMin: allStops.length
        ? Math.round(allStops.reduce((s, x) => s + x.arriveMin, 0) / allStops.length)
        : 0,
      maxArriveMin: maxArrive,
      finishTime: addMinutes(RULES.departTime, maxArrive),
      lateCount: allStops.filter((s) => s.arriveMin > RULES.deadlineMin).length,
    };

    return {
      id,
      label: st.label,
      strategy: st.strategy,
      planDate,
      departTime: RULES.departTime,
      createdAt: new Date().toISOString(),
      orderSignature: this.orderSignature(orders),
      routes,
      summary,
      confirmed: false,
    };
  }
}

function signature(orders: OrderGetResponse[], routes: number[][]): string {
  return routes
    .map((r) => r.map((i) => orders[i].id).join('>'))
    .sort()
    .join('|');
}
