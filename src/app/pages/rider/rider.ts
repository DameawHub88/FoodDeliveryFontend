import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { BrandLogo } from '../../components/brand-logo/brand-logo';

// Layout หน้าจอไรเดอร์ (ออกแบบสำหรับมือถือ)
@Component({
  selector: 'app-rider',
  imports: [RouterModule, BrandLogo],
  templateUrl: './rider.html',
  styleUrl: './rider.css',
})
export class Rider {}
