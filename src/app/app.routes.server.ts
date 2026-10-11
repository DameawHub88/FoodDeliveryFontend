import { RenderMode, ServerRoute } from '@angular/ssr';

// แอปนี้ใช้แผนที่และ localStorage ซึ่งมีเฉพาะบน browser จึงให้ render ฝั่ง client ทุกหน้า
export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
