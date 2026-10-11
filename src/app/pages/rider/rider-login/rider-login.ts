import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PlanApi } from '../../../services/api/plan-api';
import { RULES } from '../../../config/config';
import { deadlineTime } from '../../../services/helpers';

export const RECENT_JOBS_KEY = 'fd_recent_jobs';

@Component({
  selector: 'app-rider-login',
  imports: [FormsModule],
  templateUrl: './rider-login.html',
  styleUrl: './rider-login.css',
})
export class RiderLogin {
  private router = inject(Router);
  private planApi = inject(PlanApi);

  rules = RULES;
  deadline = deadlineTime();
  code = signal('');
  error = signal('');
  checking = signal(false);
  recent = signal<string[]>([]);

  ngOnInit() {
    try {
      const raw = localStorage.getItem(RECENT_JOBS_KEY);
      if (raw) this.recent.set(JSON.parse(raw));
    } catch {
      // ไม่มีประวัติก็ไม่เป็นไร
    }
  }

  onInput(value: string) {
    this.code.set(value.replace(/\D/g, '').slice(0, 6));
    this.error.set('');
  }

  async open(code = this.code()) {
    if (code.length !== 6) {
      this.error.set('เลขใบงานมี 6 หลัก');
      return;
    }
    this.checking.set(true);
    try {
      const job = await this.planApi.getJob(code);
      if (!job) {
        this.error.set('ไม่พบใบงานนี้ ตรวจสอบเลขกับร้านอีกครั้ง');
        return;
      }
      this.router.navigate(['/rider', code]);
    } catch {
      this.error.set('เชื่อมต่อระบบไม่ได้ ลองใหม่อีกครั้ง');
    } finally {
      this.checking.set(false);
    }
  }
}
