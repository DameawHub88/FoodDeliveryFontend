import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class Api {
  public readonly API_ENDPOINT: string = 'http://localhost:3000';

  // true = ใช้ฐานข้อมูลจำลองใน localStorage (ระหว่างที่ Back end ยังไม่พร้อม)
  // false = เรียก Back end จริงผ่าน API_ENDPOINT
  public readonly USE_MOCK: boolean = true;
}
