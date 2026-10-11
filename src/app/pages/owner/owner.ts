import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { BrandLogo } from '../../components/brand-logo/brand-logo';
import { Api } from '../../config/api';
import { RULES } from '../../config/config';
import { MockDb } from '../../services/mock-db';
import { Notify } from '../../services/notify';
import { RoutePlanner } from '../../services/route-planner';
import { deadlineTime } from '../../services/helpers';

@Component({
  selector: 'app-owner',
  imports: [RouterModule, BrandLogo],
  templateUrl: './owner.html',
  styleUrl: './owner.css',
})
export class Owner {
  private router = inject(Router);
  private db = inject(MockDb);
  private planner = inject(RoutePlanner);
  private notify = inject(Notify);
  api = inject(Api);

  menus = [
    { path: '/owner', icon: 'space_dashboard', label: 'ภาพรวม', exact: true },
    { path: '/owner/customers', icon: 'group', label: 'ลูกค้า', exact: false },
    { path: '/owner/orders', icon: 'receipt_long', label: 'ออเดอร์', exact: false },
    { path: '/owner/routes', icon: 'route', label: 'จัดเส้นทาง', exact: false },
  ];

  drawerOpen = signal(false);
  now = signal(new Date());
  departTime = RULES.departTime;
  deadline = deadlineTime();

  // นับถอยหลังถึงเวลาออกส่ง 11:30
  countdown = computed(() => {
    const now = this.now();
    const [h, m] = RULES.departTime.split(':').map(Number);
    const depart = new Date(now);
    depart.setHours(h, m, 0, 0);
    const diff = Math.round((depart.getTime() - now.getTime()) / 60000);
    if (diff > 0) {
      const hh = Math.floor(diff / 60);
      const mm = diff % 60;
      return { before: true, text: hh > 0 ? `อีก ${hh} ชม. ${mm} นาที` : `อีก ${mm} นาที` };
    }
    if (diff > -RULES.deadlineMin) return { before: false, text: `อยู่ระหว่างส่ง ถึง ${this.deadline}` };
    return { before: false, text: 'รอบวันนี้จบแล้ว' };
  });

  clock = computed(() =>
    this.now().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
  );

  constructor() {
    const timer = setInterval(() => this.now.set(new Date()), 15000);
    const sub = this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) this.drawerOpen.set(false);
    });
    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer);
      sub.unsubscribe();
    });
  }

  async resetData() {
    const ok = await this.notify.confirm({
      title: 'รีเซ็ตข้อมูลตัวอย่าง?',
      message: 'ลูกค้า ออเดอร์ และแผนการส่งทั้งหมดในเครื่องนี้จะถูกล้าง แล้วเริ่มใหม่ด้วยลูกค้าตัวอย่าง',
      confirmText: 'รีเซ็ต',
      danger: true,
    });
    if (!ok) return;
    this.db.reset();
    this.planner.clear();
    this.notify.show('รีเซ็ตข้อมูลเรียบร้อย');
    await this.router.navigateByUrl('/', { skipLocationChange: true });
    await this.router.navigate(['/owner']);
  }
}
