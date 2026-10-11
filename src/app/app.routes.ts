import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { Owner } from './pages/owner/owner';
import { Dashboard } from './pages/owner/dashboard/dashboard';
import { Customers } from './pages/owner/customers/customers';
import { Orders } from './pages/owner/orders/orders';
import { RoutePlanning } from './pages/owner/route-planning/route-planning';
import { Rider } from './pages/rider/rider';
import { RiderLogin } from './pages/rider/rider-login/rider-login';
import { JobSheet } from './pages/rider/job-sheet/job-sheet';
import { Pagenotfound } from './pages/pagenotfound/pagenotfound';

export const routes: Routes = [
  { path: '', component: Home, title: 'ส่งด่วนมื้อเที่ยง' },
  // หน้าจอสำหรับเจ้าของร้าน
  {
    path: 'owner',
    component: Owner,
    children: [
      { path: '', component: Dashboard, title: 'ภาพรวม · ส่งด่วนมื้อเที่ยง' },
      { path: 'customers', component: Customers, title: 'ลูกค้า · ส่งด่วนมื้อเที่ยง' },
      { path: 'orders', component: Orders, title: 'ออเดอร์ · ส่งด่วนมื้อเที่ยง' },
      { path: 'routes', component: RoutePlanning, title: 'จัดเส้นทาง · ส่งด่วนมื้อเที่ยง' },
    ],
  },
  // หน้าจอสำหรับไรเดอร์ (มือถือ)
  {
    path: 'rider',
    component: Rider,
    children: [
      { path: '', component: RiderLogin, title: 'ไรเดอร์ · ส่งด่วนมื้อเที่ยง' },
      { path: ':code', component: JobSheet, title: 'ใบงานไรเดอร์ · ส่งด่วนมื้อเที่ยง' },
    ],
  },
  //Wild Card Route for 404 request
  { path: '**', component: Pagenotfound, title: 'ไม่พบหน้า · ส่งด่วนมื้อเที่ยง' },
];
