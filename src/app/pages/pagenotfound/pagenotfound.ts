import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { BrandLogo } from '../../components/brand-logo/brand-logo';

@Component({
  selector: 'app-pagenotfound',
  imports: [RouterModule, BrandLogo],
  templateUrl: './pagenotfound.html',
  styleUrl: './pagenotfound.css',
})
export class Pagenotfound {}
