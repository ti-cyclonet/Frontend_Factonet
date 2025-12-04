import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ParametrosGlobalesService } from '../../shared/services/parametros-globales/parametros-globales.service';

@Component({
  selector: 'app-parametros-globales',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './parametros-globales.component.html',
  styleUrl: './parametros-globales.component.css'
})
export class ParametrosGlobalesComponent implements OnInit {
  periodos: any[] = [];
  periodoActivo: any = null;
  parametros: any[] = [];
  loading = false;
  showCreateForm = false;
  nuevoPeriodo = { nombre: '', fechaInicio: '', fechaFin: '' };
  
  // Paginación períodos
  periodosPage = 0;
  periodosPageSize = 5;
  
  // Paginación parámetros
  parametrosPage = 0;
  parametrosPageSize = 5;

  constructor(private parametrosService: ParametrosGlobalesService) {}

  ngOnInit(): void {
    this.loadPeriodos();
    this.loadPeriodoActivo();
    this.loadParametros();
  }

  loadPeriodos(): void {
    this.parametrosService.getPeriodos().subscribe({
      next: (periodos) => {
        console.log('Períodos cargados:', periodos);
        this.periodos = periodos;
      },
      error: (error: any) => console.error('Error loading periodos:', error)
    });
  }

  loadPeriodoActivo(): void {
    this.parametrosService.getPeriodoActivo().subscribe({
      next: (periodo) => this.periodoActivo = periodo,
      error: (error: any) => console.error('Error loading periodo activo:', error)
    });
  }

  loadParametros(): void {
    this.parametrosService.getParametrosGlobales().subscribe({
      next: (parametros) => {
        console.log('Parámetros cargados:', parametros);
        this.parametros = parametros;
      },
      error: (error: any) => console.error('Error loading parametros:', error)
    });
  }



  guardarParametros(): void {
    this.loading = true;
    this.parametrosService.guardarParametros(this.parametros).subscribe({
      next: () => {
        this.loading = false;
        alert('Parámetros guardados correctamente');
      },
      error: (error: any) => {
        this.loading = false;
        console.error('Error guardando parámetros:', error);
      }
    });
  }

  crearPeriodo(): void {
    this.loading = true;
    this.parametrosService.crearPeriodo(this.nuevoPeriodo).subscribe({
      next: () => {
        this.loading = false;
        this.showCreateForm = false;
        this.nuevoPeriodo = { nombre: '', fechaInicio: '', fechaFin: '' };
        this.loadPeriodos();
        alert('Período creado correctamente');
      },
      error: (error: any) => {
        this.loading = false;
        console.error('Error creando período:', error);
      }
    });
  }



  configurarPeriodo(periodo: any): void {
    this.parametrosPage = 0;
    this.loadParametrosPorPeriodo(periodo.id);
  }
  
  agregarParametro(): void {
    console.log('Agregar nuevo parámetro');
    // Lógica para agregar parámetro
  }
  
  editarParametro(param: any): void {
    console.log('Editar parámetro:', param);
    // Lógica para editar parámetro
  }
  
  eliminarParametro(param: any): void {
    if (confirm(`¿Está seguro de eliminar el parámetro "${param.nombre}"?`)) {
      console.log('Eliminar parámetro:', param);
      // Lógica para eliminar parámetro
    }
  }
  
  eliminarPeriodo(periodo: any): void {
    if (confirm(`¿Está seguro de eliminar el período "${periodo.nombre}"?`)) {
      this.loading = true;
      this.parametrosService.eliminarPeriodo(periodo.id).subscribe({
        next: () => {
          this.loading = false;
          this.loadPeriodos();
          alert('Período eliminado correctamente');
        },
        error: (error: any) => {
          this.loading = false;
          console.error('Error eliminando período:', error);
        }
      });
    }
  }
  
  get periodosPaginados() {
    const start = this.periodosPage * this.periodosPageSize;
    return this.periodos.slice(start, start + this.periodosPageSize);
  }
  
  get parametrosPaginados() {
    const start = this.parametrosPage * this.parametrosPageSize;
    return this.parametros.slice(start, start + this.parametrosPageSize);
  }
  
  get totalPeriodosPages() {
    return Math.ceil(this.periodos.length / this.periodosPageSize);
  }
  
  get totalParametrosPages() {
    return Math.ceil(this.parametros.length / this.parametrosPageSize);
  }
  
  nextPeriodosPage() {
    if (this.periodosPage < this.totalPeriodosPages - 1) {
      this.periodosPage++;
    }
  }
  
  prevPeriodosPage() {
    if (this.periodosPage > 0) {
      this.periodosPage--;
    }
  }
  
  nextParametrosPage() {
    if (this.parametrosPage < this.totalParametrosPages - 1) {
      this.parametrosPage++;
    }
  }
  
  prevParametrosPage() {
    if (this.parametrosPage > 0) {
      this.parametrosPage--;
    }
  }

  loadParametrosPorPeriodo(periodoId: string): void {
    this.parametrosService.getParametrosPorPeriodo(periodoId).subscribe({
      next: (parametros) => {
        console.log('Parámetros del período:', parametros);
        this.parametros = parametros;
      },
      error: (error: any) => console.error('Error loading parametros por periodo:', error)
    });
  }
}