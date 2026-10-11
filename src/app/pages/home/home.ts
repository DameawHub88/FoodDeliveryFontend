import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { BrandLogo } from '../../components/brand-logo/brand-logo';
import { PRICING, RULES, SHOP } from '../../config/config';
import { deadlineTime } from '../../services/helpers';

@Component({
  selector: 'app-home',
  imports: [RouterModule, BrandLogo],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  shop = SHOP;
  rules = RULES;
  pricing = PRICING;
  deadline = deadlineTime();
}
