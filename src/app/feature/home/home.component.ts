import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FactonetService } from '../../shared/services/factonet/factonet.service';

interface DashboardStats {
  totalInvoices: number;
  totalAmount: number;
  pendingInvoices: number;
  paidInvoices: number;
  overdueInvoices: number;
  totalContracts: number;
  activeContracts: number;
  monthlyRevenue: number;
  averageInvoiceValue: number;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  userRol: string | null = null;
  userName: string | null = null;
  stats: DashboardStats = {
    totalInvoices: 0,
    totalAmount: 0,
    pendingInvoices: 0,
    paidInvoices: 0,
    overdueInvoices: 0,
    totalContracts: 0,
    activeContracts: 0,
    monthlyRevenue: 0,
    averageInvoiceValue: 0
  };

  constructor(private factonetService: FactonetService) {}

  ngOnInit(): void {
    this.userRol = sessionStorage.getItem('user_rol');
    this.userName = sessionStorage.getItem('user_name');
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.factonetService.getInvoices().subscribe({
      next: (invoices) => {
        this.stats.totalInvoices = invoices.length;
        this.stats.totalAmount = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
        this.stats.pendingInvoices = invoices.filter(inv => inv.estado === 'Issued' || inv.estado === 'Unconfirmed').length;
        this.stats.paidInvoices = invoices.filter(inv => inv.estado === 'Paid').length;
        this.stats.overdueInvoices = invoices.filter(inv => inv.estado === 'In arrears' || inv.estado === 'Suspended').length;
        this.stats.averageInvoiceValue = this.stats.totalInvoices > 0 ? this.stats.totalAmount / this.stats.totalInvoices : 0;
        
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        this.stats.monthlyRevenue = invoices
          .filter(inv => {
            const invDate = new Date(inv.fechaEmision);
            return invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear && inv.estado === 'Paid';
          })
          .reduce((sum, inv) => sum + (inv.total || 0), 0);
      },
      error: (error) => {
        console.error('Error loading dashboard data:', error);
      }
    });

    if (this.userRol === 'adminFactonet') {
      this.factonetService.getContracts().subscribe({
        next: (contracts) => {
          this.stats.totalContracts = contracts.length;
          this.stats.activeContracts = contracts.filter(c => c.status === 'ACTIVE').length;
        },
        error: (error) => {
          console.error('Error loading contracts:', error);
        }
      });
    }
  }
}
