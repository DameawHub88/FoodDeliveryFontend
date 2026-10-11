export interface Customer {
  id: number;
  name: string;
  phone: string;
  address: string; // จุดสังเกต / รายละเอียดที่อยู่
  lat: number;
  lng: number;
}

// ข้อมูลที่ส่งไปตอนเพิ่ม / แก้ไขลูกค้า
export type CustomerPostRequest = Omit<Customer, 'id'>;
