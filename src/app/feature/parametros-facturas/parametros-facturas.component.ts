import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ParametrosGlobalesService } from '../../shared/services/parametros-globales/parametros-globales.service';
import Swal from 'sweetalert2';

interface GlobalParameterPeriod {
  id: string;
  value: string;
  status: string;
  showInDocs: boolean;
  aplicaFacturas?: boolean;
  globalParameter: {
    id: string;
    name: string;
    description: string;
    dataType: string;
  };
}

@Component({
  selector: 'app-parametros-facturas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './parametros-facturas.component.html',
  styleUrls: ['./parametros-facturas.component.css']
})
export class ParametrosFacturasComponent implements OnInit {
  parametrosActivos: GlobalParameterPeriod[] = [];
  parametrosFiltrados: GlobalParameterPeriod[] = [];
  loading = false;
  
  // Paginación
  currentPage = 0;
  pageSize = 8;
  
  // Filtros
  showFilters = false;
  filtroNombre = '';
  filtroTipo = '';
  filtroEstado = '';

  constructor(
    private parametrosService: ParametrosGlobalesService
  ) {}

  ngOnInit() {
    this.cargarParametrosActivos();
  }

  async cargarParametrosActivos() {
    this.loading = true;
    try {
      const response = await this.parametrosService.getParametrosActivosPeriodo();
      
      if (Array.isArray(response) && response.length > 0) {
        this.parametrosActivos = response.map((param: GlobalParameterPeriod) => ({
          ...param,
          aplicaFacturas: false
        }));
      } else {
        this.parametrosActivos = [];
      }
      
      this.aplicarFiltros();
      await this.cargarConfiguracionExistente();
    } catch (error) {
      console.error('Error loading active parameters:', error);
      this.parametrosActivos = [];
    } finally {
      this.loading = false;
    }
  }

  async cargarConfiguracionExistente() {
    try {
      const configuracion = await this.parametrosService.getParametrosFacturas();
      configuracion.forEach((config: any) => {
        const param = this.parametrosActivos.find(p => p.id === config.globalParameterPeriodId);
        if (param) {
          param.aplicaFacturas = true;
          param.showInDocs = config.showInDocs || false;
        }
      });
    } catch (error) {
      console.error('Error loading existing configuration:', error);
    }
  }

  get allSelected(): boolean {
    return this.parametrosActivos.length > 0 && 
           this.parametrosActivos.every(p => p.aplicaFacturas);
  }

  get someSelected(): boolean {
    return this.parametrosActivos.some(p => p.aplicaFacturas);
  }

  toggleAll(event: any) {
    const checked = event.target.checked;
    this.parametrosActivos.forEach(param => {
      param.aplicaFacturas = checked;
    });
  }

  onParameterChange(param: GlobalParameterPeriod) {
    // La lógica se maneja automáticamente por el two-way binding
  }

  aplicarFiltros() {
    this.parametrosFiltrados = this.parametrosActivos.filter(param => {
      const matchNombre = !this.filtroNombre || 
        param.globalParameter.name.toLowerCase().includes(this.filtroNombre.toLowerCase());
      const matchTipo = !this.filtroTipo || 
        param.globalParameter.dataType === this.filtroTipo;
      const matchEstado = !this.filtroEstado || 
        (this.filtroEstado === 'applied' && param.aplicaFacturas) ||
        (this.filtroEstado === 'not-applied' && !param.aplicaFacturas);
      
      return matchNombre && matchTipo && matchEstado;
    });
    this.currentPage = 0; // Reset a primera página
  }

  get parametrosPaginados() {
    const start = this.currentPage * this.pageSize;
    return this.parametrosFiltrados.slice(start, start + this.pageSize);
  }

  get totalPages() {
    return Math.ceil(this.parametrosFiltrados.length / this.pageSize);
  }

  nextPage() {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
    }
  }

  prevPage() {
    if (this.currentPage > 0) {
      this.currentPage--;
    }
  }

  limpiarFiltros() {
    this.filtroNombre = '';
    this.filtroTipo = '';
    this.filtroEstado = '';
    this.aplicarFiltros();
  }

  async guardarConfiguracion() {
    this.loading = true;
    try {
      const parametrosSeleccionados = this.parametrosActivos
        .filter(p => p.aplicaFacturas)
        .map(p => ({ 
          globalParameterPeriodId: p.id,
          showInDocs: p.showInDocs 
        }));

      await this.parametrosService.guardarParametrosFacturas(parametrosSeleccionados);
      
      Swal.fire({
        title: '¡Listo!',
        text: 'Configuración guardada.',
        icon: 'success',
        confirmButtonText: 'Aceptar'
      });
    } catch (error) {
      console.error('Error saving configuration:', error);
      Swal.fire({
        title: 'Error',
        text: 'No se pudo guardar la configuración. Intenta de nuevo.',
        icon: 'error',
        confirmButtonText: 'Aceptar'
      });
    } finally {
      this.loading = false;
    }
  }

  openParamInfo(param: any) {
    Swal.fire({
      title: param.globalParameter.name,
      html: `
        <div style="text-align:left;font-size:14px;">
          <div class="mb-2"><strong>Valor:</strong> <span class="badge bg-primary">${param.value}</span></div>
          <div class="mb-2"><strong>Descripción:</strong> ${param.globalParameter.description || 'N/A'}</div>
          <div class="mb-2"><strong>Tipo:</strong> ${param.globalParameter.dataType === 'number' ? 'Numeric' : 'Text'}</div>
          <div class="mb-2"><strong>Estado:</strong> ${param.aplicaFacturas ? '✅ Aplicado' : '⬜ No aplicado'}</div>
          <div class="mb-2"><strong>Mostrar en documentos:</strong> ${param.showInDocs ? '✅ Sí' : '⬜ No'}</div>
        </div>
      `,
      confirmButtonText: 'Cerrar',
    });
  }
}