import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { Chart, registerables } from 'chart.js';
import { FactonetService } from '../../shared/services/factonet/factonet.service';

Chart.register(...registerables);

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
  imports: [CommonModule, RouterModule, BaseChartDirective],
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

  // Chart: Monthly Invoice Totals (Bar)
  monthlyChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [{
      data: [],
      label: 'Invoice Amount',
      backgroundColor: 'rgba(39, 130, 216, 0.6)',
      borderColor: '#2782d8',
      borderWidth: 1
    }]
  };

  monthlyChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Monthly Invoice Totals', font: { size: 14 } }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => '$' + Number(value).toLocaleString()
        }
      }
    }
  };

  // Chart: Invoice Status (Doughnut)
  statusChartData: ChartData<'doughnut'> = {
    labels: ['Paid', 'Pending', 'Overdue', 'Unconfirmed'],
    datasets: [{
      data: [0, 0, 0, 0],
      backgroundColor: ['#28a745', '#ffc107', '#dc3545', '#6c757d'],
      borderWidth: 2
    }]
  };

  statusChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { padding: 15 } },
      title: { display: true, text: 'Invoice Status Distribution', font: { size: 14 } }
    }
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

        // Build charts data
        this.buildMonthlyChart(invoices);
        this.buildStatusChart(invoices);
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

  private buildMonthlyChart(invoices: any[]): void {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyTotals: { [key: string]: number } = {};

    // Aggregate invoice totals by month (last 6 months)
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      monthlyTotals[key] = 0;
    }

    invoices.forEach(inv => {
      const date = new Date(inv.fechaEmision);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      if (monthlyTotals.hasOwnProperty(key)) {
        monthlyTotals[key] += (inv.total || 0);
      }
    });

    const labels: string[] = [];
    const data: number[] = [];

    Object.keys(monthlyTotals).forEach(key => {
      const [year, month] = key.split('-').map(Number);
      labels.push(`${monthNames[month]} ${year}`);
      data.push(monthlyTotals[key]);
    });

    this.monthlyChartData = {
      labels,
      datasets: [{
        data,
        label: 'Invoice Amount',
        backgroundColor: 'rgba(39, 130, 216, 0.6)',
        borderColor: '#2782d8',
        borderWidth: 1
      }]
    };
  }

  private buildStatusChart(invoices: any[]): void {
    const paid = invoices.filter(inv => inv.estado === 'Paid').length;
    const pending = invoices.filter(inv => inv.estado === 'Issued').length;
    const overdue = invoices.filter(inv => inv.estado === 'In arrears' || inv.estado === 'Suspended' || inv.estado === 'Notification1' || inv.estado === 'Notification2').length;
    const unconfirmed = invoices.filter(inv => inv.estado === 'Unconfirmed').length;

    this.statusChartData = {
      labels: ['Paid', 'Issued', 'Overdue', 'Unconfirmed'],
      datasets: [{
        data: [paid, pending, overdue, unconfirmed],
        backgroundColor: ['#28a745', '#ffc107', '#dc3545', '#6c757d'],
        borderWidth: 2
      }]
    };
  }
}
