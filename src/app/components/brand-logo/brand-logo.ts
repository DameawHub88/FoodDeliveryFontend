import { Component, input } from '@angular/core';

@Component({
  selector: 'app-brand-logo',
  imports: [],
  templateUrl: './brand-logo.html',
  styleUrl: './brand-logo.css',
  host: { class: 'inline-flex items-center' },
})
export class BrandLogo {
  size = input<'sm' | 'lg'>('sm');
  dark = input(false); // ใช้บนพื้นดำ
  showText = input(true);
}
