import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FactonetService } from '../../shared/services/factonet/factonet.service';

interface ReportFilters {
  startDate: string;
  endDate: string;
  contractId?: string;
  customerId?: string;
  status?: string;
}

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reportes.component.html',
  styleUrls: ['./reportes.component.css']
})
export class ReportesComponent implements OnInit {
  activeTab: string = 'management';
  loading: boolean = false;
  showFilters: boolean = true;

  filters: ReportFilters = {
    startDate: this.getFirstDayOfMonth(),
    endDate: this.getLastDayOfMonth()
  };

  // Indicadores de Gestión
  managementIndicators: any = null;

  // Reportes
  clientsReport: any = null;
  contractsReport: any = null;
  invoicesReport: any = null;
  profitsReport: any = null;
  taxesReport: any = null;
  globalParametersReport: any = null;

  constructor(private factonetService: FactonetService) {}

  ngOnInit(): void {
    this.loadManagementIndicators();
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
    this.loadReportData();
  }

  loadReportData(): void {
    switch (this.activeTab) {
      case 'management':
        this.loadManagementIndicators();
        break;
      case 'clients':
        this.loadClientsReport();
        break;
      case 'contracts':
        this.loadContractsReport();
        break;
      case 'invoices':
        this.loadInvoicesReport();
        break;
      case 'profits':
        this.loadProfitsReport();
        break;
      case 'taxes':
        this.loadTaxesReport();
        break;
      case 'parameters':
        this.loadGlobalParametersReport();
        break;
    }
  }

  loadManagementIndicators(): void {
    this.loading = true;
    this.factonetService.getManagementIndicators(this.filters).subscribe({
      next: (data) => {
        this.managementIndicators = data;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading management indicators:', error);
        this.loading = false;
      }
    });
  }

  loadClientsReport(): void {
    this.loading = true;
    this.factonetService.getClientsReport(this.filters).subscribe({
      next: (data) => {
        this.clientsReport = data;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading clients report:', error);
        this.loading = false;
      }
    });
  }

  loadContractsReport(): void {
    this.loading = true;
    this.factonetService.getContractsReport(this.filters).subscribe({
      next: (data) => {
        this.contractsReport = data;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading contracts report:', error);
        this.loading = false;
      }
    });
  }

  loadInvoicesReport(): void {
    this.loading = true;
    this.factonetService.getInvoicesReport(this.filters).subscribe({
      next: (data) => {
        this.invoicesReport = data;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading invoices report:', error);
        this.loading = false;
      }
    });
  }

  loadProfitsReport(): void {
    this.loading = true;
    this.factonetService.getProfitsReport(this.filters).subscribe({
      next: (data) => {
        this.profitsReport = data;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading profits report:', error);
        this.loading = false;
      }
    });
  }

  loadTaxesReport(): void {
    this.loading = true;
    this.factonetService.getTaxesReport(this.filters).subscribe({
      next: (data) => {
        this.taxesReport = data;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading taxes report:', error);
        this.loading = false;
      }
    });
  }

  loadGlobalParametersReport(): void {
    this.loading = true;
    this.factonetService.getGlobalParametersReport(this.filters).subscribe({
      next: (data) => {
        this.globalParametersReport = data;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading global parameters report:', error);
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    this.loadReportData();
  }

  resetFilters(): void {
    this.filters = {
      startDate: this.getFirstDayOfMonth(),
      endDate: this.getLastDayOfMonth()
    };
    this.loadReportData();
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  exportToCSV(reportType: string): void {
    let data: any[] = [];
    let filename = '';

    switch (reportType) {
      case 'clients':
        data = this.clientsReport?.clients || [];
        filename = 'reporte_clientes.csv';
        break;
      case 'contracts':
        data = this.contractsReport?.contracts || [];
        filename = 'reporte_contratos.csv';
        break;
      case 'invoices':
        data = this.invoicesReport?.invoices || [];
        filename = 'reporte_facturas.csv';
        break;
      case 'profits':
        data = this.profitsReport?.details || [];
        filename = 'reporte_ganancias.csv';
        break;
      case 'taxes':
        data = this.taxesReport?.byType || [];
        filename = 'reporte_impuestos.csv';
        break;
      case 'parameters':
        data = this.globalParametersReport?.parameters || [];
        filename = 'reporte_parametros.csv';
        break;
    }

    if (data.length === 0) {
      alert('No hay datos para exportar');
      return;
    }

    const csv = this.convertToCSV(data);
    this.downloadCSV(csv, filename);
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [];

    csvRows.push(headers.join(','));

    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        return typeof value === 'object' ? JSON.stringify(value) : value;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }

  private downloadCSV(csv: string, filename: string): void {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  private getFirstDayOfMonth(): string {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
  }

  private getLastDayOfMonth(): string {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
  }

  formatPercentage(value: number): string {
    return `${value.toFixed(2)}%`;
  }

  getStatusClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      'Paid': 'status-paid',
      'Issued': 'status-issued',
      'Unconfirmed': 'status-unconfirmed',
      'In arrears': 'status-overdue',
      'Suspended': 'status-suspended',
      'ACTIVE': 'status-active',
      'INACTIVE': 'status-inactive',
      'PENDING': 'status-pending'
    };
    return statusMap[status] || 'status-default';
  }
}
