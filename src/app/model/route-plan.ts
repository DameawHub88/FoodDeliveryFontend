export type PlanStrategy = 'cheapest' | 'balanced' | 'fastest';

// จุดส่งของแต่ละจุดในเส้นทางของไรเดอร์
export interface RouteStop {
  seq: number; // จุดที่ 1, 2, 3
  orderId: number;
  customerId: number;
  customerName: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
  quantity: number;
  legKm: number; // ระยะจากจุดก่อนหน้า
  arriveMin: number; // นาทีหลังออกจากร้าน
  arriveTime: string; // HH:mm
  delivered: boolean;
}

// เส้นทาง (ใบงาน) ของไรเดอร์ 1 คน
export interface RiderRoute {
  riderNo: number;
  color: string;
  jobCode: string; // เลขใบงาน (ได้หลังยืนยันแผน)
  stops: RouteStop[];
  totalBoxes: number;
  distanceKm: number;
  durationMin: number;
  revenue: number;
  foodCost: number;
  riderCost: number;
  profit: number;
  late: boolean;
}

export interface PlanSummary {
  orders: number;
  boxes: number;
  riders: number;
  revenue: number;
  foodCost: number;
  riderCost: number;
  profit: number;
  totalKm: number;
  avgArriveMin: number;
  maxArriveMin: number;
  finishTime: string;
  lateCount: number;
}

export interface RoutePlan {
  id: number;
  label: string;
  strategy: PlanStrategy;
  planDate: string;
  departTime: string;
  createdAt: string;
  orderSignature: string; // ใช้ตรวจว่าออเดอร์เปลี่ยนหลังจัดเส้นทางหรือไม่
  routes: RiderRoute[];
  summary: PlanSummary;
  confirmed: boolean;
}

// ใบงานที่ไรเดอร์เปิดดูด้วยเลขใบงาน
export interface JobSheet {
  jobCode: string;
  planId: number;
  planDate: string;
  departTime: string;
  route: RiderRoute;
}
