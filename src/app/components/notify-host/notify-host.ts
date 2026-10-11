import { Component, inject } from '@angular/core';
import { Notify } from '../../services/notify';

@Component({
  selector: 'app-notify-host',
  imports: [],
  templateUrl: './notify-host.html',
  styleUrl: './notify-host.css',
  host: { '(document:keydown.escape)': 'notify.dialog() && notify.close(false)' },
})
export class NotifyHost {
  notify = inject(Notify);
}
