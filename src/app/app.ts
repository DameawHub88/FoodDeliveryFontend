import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NotifyHost } from './components/notify-host/notify-host';

@Component({
  imports: [RouterOutlet, NotifyHost],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('FoodDelivery');
}
