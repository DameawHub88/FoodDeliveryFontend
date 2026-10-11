import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'error';
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
}

interface DialogState extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

// แจ้งเตือนแบบ Snackbar และกล่องยืนยันแบบ Google (แชร์ใช้ทุกหน้า)
@Injectable({
  providedIn: 'root',
})
export class Notify {
  toast = signal<Toast | null>(null);
  dialog = signal<DialogState | null>(null);
  private timer?: ReturnType<typeof setTimeout>;

  show(text: string, tone: Toast['tone'] = 'info') {
    clearTimeout(this.timer);
    this.toast.set({ id: Date.now(), text, tone });
    this.timer = setTimeout(() => this.toast.set(null), 3500);
  }

  error(e: unknown) {
    const text = e instanceof Error ? e.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่';
    this.show(text, 'error');
  }

  confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => this.dialog.set({ ...options, resolve }));
  }

  close(ok: boolean) {
    this.dialog()?.resolve(ok);
    this.dialog.set(null);
  }
}
