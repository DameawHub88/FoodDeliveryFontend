import { Customer } from './customer';

export interface Order {
  id: number;
  customerId: number;
  quantity: number; // 1 - 3 กล่อง
  orderDate: string; // YYYY-MM-DD
  createdAt: string; // ISO date time
  note: string;
}

// ออเดอร์ที่ join ข้อมูลลูกค้ามาแล้ว (ใช้แสดงผลและจัดเส้นทาง)
export interface OrderGetResponse extends Order {
  customer: Customer;
}

export interface OrderPostRequest {
  customerId: number;
  quantity: number;
  orderDate: string;
  note?: string;
}
