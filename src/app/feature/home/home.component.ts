import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { Chart, registerables } from 'chart.js';
import { FactonetService } from '../../shared/services/factonet/factonet.service';
import Swal from 'sweetalert2';

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

  activeContract: { code: string; packageName: string; description: string; monthlyValue: number; startDate: string; endDate: string; status: string; id?: string; clientSignedAt?: string } | null = null;

  // Pending actions for admin
  pendingActions: { type: string; icon: string; title: string; description: string; route: string }[] = [];

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
    if (this.userRol === 'adminFactonet') {
      this.loadPendingActions();
    }
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

    // Load active contract for adminInvoices
    if (this.userRol === 'adminInvoices') {
      this.factonetService.getContracts().subscribe({
        next: (contracts) => {
          const contract = contracts[0]; // Only one contract per user
          if (contract) {
            const value = typeof contract.value === 'string' ? parseFloat(contract.value) : contract.value;
            this.activeContract = {
              id: contract.id,
              code: contract.code,
              packageName: contract.package?.name || contract.packageName || 'N/A',
              description: contract.package?.description || '',
              monthlyValue: contract.mode === 'MONTHLY' ? value / 12 : value,
              startDate: contract.startDate,
              endDate: contract.endDate,
              status: contract.status,
              clientSignedAt: contract.clientSignedAt || null
            };
          }
        },
        error: () => {}
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

  loadPendingActions(): void {
    this.pendingActions = [];

    // 1. Contracts pending admin signature
    this.factonetService.getContracts().subscribe({
      next: (contracts) => {
        const pendingSignature = contracts.filter(
          (c: any) => c.clientSignedAt && !c.adminSignedAt && c.status !== 'ACTIVE'
        );
        pendingSignature.forEach((c: any) => {
          this.pendingActions.push({
            type: 'signature',
            icon: 'pen',
            title: `Contract ${c.code} pending your signature`,
            description: `Client already signed. Requires your signature to activate.`,
            route: '/contracts'
          });
        });

        // 2. Contracts PENDING that need PDF generation
        const needsPdf = contracts.filter(
          (c: any) => c.status === 'PENDING' && !c.pdfUrl
        );
        needsPdf.forEach((c: any) => {
          this.pendingActions.push({
            type: 'contract',
            icon: 'file-earmark-pdf',
            title: `Contract ${c.code} without PDF`,
            description: `Generate the PDF to issue and sign.`,
            route: '/contracts'
          });
        });

        // 3. Contracts PENDING that need to be issued
        const needsIssue = contracts.filter(
          (c: any) => c.status === 'PENDING' && c.pdfUrl && !c.issuedAt
        );
        needsIssue.forEach((c: any) => {
          this.pendingActions.push({
            type: 'contract',
            icon: 'send',
            title: `Contract ${c.code} pending issuance`,
            description: `PDF is ready. Issue it to send to the client.`,
            route: '/contracts'
          });
        });
      },
      error: () => {}
    });

    // 4. Invoices that need to be issued (Unconfirmed)
    this.factonetService.getInvoices().subscribe({
      next: (invoices) => {
        const unconfirmed = invoices.filter((inv: any) => inv.estado === 'Unconfirmed');
        if (unconfirmed.length > 0) {
          this.pendingActions.push({
            type: 'invoice',
            icon: 'receipt',
            title: `${unconfirmed.length} invoice${unconfirmed.length > 1 ? 's' : ''} to confirm`,
            description: `Generated invoices pending issuance.`,
            route: '/facturas'
          });
        }

        const overdue = invoices.filter((inv: any) => inv.estado === 'In arrears' || inv.estado === 'Suspended');
        if (overdue.length > 0) {
          this.pendingActions.push({
            type: 'invoice',
            icon: 'exclamation-triangle',
            title: `${overdue.length} overdue invoice${overdue.length > 1 ? 's' : ''}`,
            description: `Require collection follow-up.`,
            route: '/facturas'
          });
        }
      },
      error: () => {}
    });
  }

  signMyContract(): void {
    if (!this.activeContract?.id) return;

    const clientName = sessionStorage.getItem('user_name') || sessionStorage.getItem('user_email') || 'Cliente';

    Swal.fire({
      title: 'Firmar Contrato',
      html: `
        <div style="text-align: left; font-size: 14px;">
          <p>Al firmar, aceptas los términos del contrato <strong>${this.activeContract.code}</strong>.</p>
          <div style="padding: 12px; background: #f8f9fa; border-radius: 8px; font-size: 13px; margin-bottom: 12px;">
            <p style="margin:0;"><strong>Paquete:</strong> ${this.activeContract.packageName}</p>
            <p style="margin:4px 0 0;"><strong>Valor:</strong> $${this.activeContract.monthlyValue.toLocaleString('es-CO')} COP/mes</p>
          </div>
          <label style="font-size: 13px; cursor: pointer;">
            <input type="checkbox" id="swal-accept-terms" style="margin-right: 6px;">
            Acepto los términos y condiciones del contrato
          </label>
        </div>
      `,
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: 'Firmar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#198754',
      preConfirm: () => {
        const accepted = (document.getElementById('swal-accept-terms') as HTMLInputElement)?.checked;
        if (!accepted) {
          Swal.showValidationMessage('Debes aceptar los términos para firmar');
          return false;
        }
        return true;
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.factonetService.signAsClient(this.activeContract!.id!, clientName).subscribe({
          next: (response) => {
            if (this.activeContract) {
              this.activeContract.clientSignedAt = new Date().toISOString();
              this.activeContract.status = response.status || this.activeContract.status;
            }
            const msg = response.status === 'ACTIVE'
              ? '¡Contrato firmado y activado!'
              : '¡Firma registrada!';
            Swal.fire({
              icon: 'success',
              title: msg,
              html: response.status === 'ACTIVE'
                ? '<p>Ambas partes han firmado. Tu cuenta está activa.</p>'
                : '<p>Tu firma fue registrada. Pendiente firma del administrador.</p>',
              confirmButtonColor: '#0d6efd',
            });
          },
          error: (error) => {
            Swal.fire('Error', error.error?.message || 'No se pudo registrar la firma.', 'error');
          }
        });
      }
    });
  }
}
