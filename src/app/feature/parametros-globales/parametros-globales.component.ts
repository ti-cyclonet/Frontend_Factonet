import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ParametrosGlobalesService } from '../../shared/services/parametros-globales/parametros-globales.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-parametros-globales',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './parametros-globales.component.html',
  styleUrl: './parametros-globales.component.css'
})
export class ParametrosGlobalesComponent implements OnInit {
  periodos: any[] = [];
  periodoActivo: any = null;
  periodoSeleccionado: any = null;
  parametros: any[] = [];
  loading = false;
  showCreateForm = false;
  showParametros = false;
  nuevoPeriodoForm: FormGroup;
  nuevoPeriodo = { nombre: '', fechaInicio: '', fechaFin: '' };
  
  parametrosDisponibles: any[] = [];
  parametrosDisponiblesFiltrados: any[] = [];
  filtroNombre: string = '';
  filtroTipo: string = '';
  
  // Paginación períodos
  periodosPage = 0;
  periodosPageSize = 8;
  
  // Paginación parámetros
  parametrosPage = 0;
  parametrosPageSize = 5;

  constructor(private parametrosService: ParametrosGlobalesService, private fb: FormBuilder) {
    this.nuevoPeriodoForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      fechaInicio: ['', Validators.required],
      fechaFin: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadPeriodos();
    this.loadPeriodoActivo();
    this.loadParametros();
  }

  loadPeriodos(): void {
    this.parametrosService.getPeriodos().subscribe({
      next: (periodos) => {

        // Mapear los datos de la API a la estructura esperada por el template
        this.periodos = periodos.map(periodo => ({
          id: periodo.id,
          codigo: periodo.code,
          nombre: periodo.name || periodo.code || `Período ${periodo.id.substring(0, 8)}`,
          fechaInicio: periodo.startDate,
          fechaFin: periodo.endDate,
          activo: periodo.status === 'ACTIVE'
        }));
      },

    });
  }

  loadPeriodoActivo(): void {
    this.parametrosService.getPeriodoActivo().subscribe({
      next: (periodo) => this.periodoActivo = periodo,

    });
  }

  loadParametros(): void {
    this.parametrosService.getParametrosGlobales().subscribe({
      next: (parametros) => {

        this.parametros = parametros;
      },

    });
  }



  guardarParametros(): void {
    this.loading = true;
    this.parametrosService.guardarParametros(this.parametros).subscribe({
      next: () => {
        this.loading = false;
        // Cerrar modal
        const modal = document.getElementById('parametersModal');
        if (modal) {
          const bootstrapModal = (window as any).bootstrap.Modal.getInstance(modal);
          if (bootstrapModal) bootstrapModal.hide();
        }
        Swal.fire({
          title: '¡Éxito!',
          text: 'Parámetros guardados correctamente',
          icon: 'success',
          confirmButtonText: 'OK'
        });
      },
      error: (error: any) => {
        this.loading = false;

        Swal.fire({
          title: 'Error',
          text: 'No se pudieron guardar los parámetros',
          icon: 'error',
          confirmButtonText: 'OK'
        });
      }
    });
  }

  crearPeriodo(): void {
    if (this.nuevoPeriodoForm.invalid) {
      this.nuevoPeriodoForm.markAllAsTouched();
      return;
    }

    const fechaInicio = new Date(this.nuevoPeriodoForm.value.fechaInicio);
    const fechaFin = new Date(this.nuevoPeriodoForm.value.fechaFin);
    
    if (fechaFin <= fechaInicio) {
      Swal.fire({
        title: 'Error de validación',
        text: 'La fecha fin debe ser posterior a la fecha inicio',
        icon: 'error',
        confirmButtonText: 'OK'
      });
      return;
    }

    this.loading = true;
    const periodoData = {
      nombre: this.nuevoPeriodoForm.value.nombre,
      fechaInicio: this.nuevoPeriodoForm.value.fechaInicio,
      fechaFin: this.nuevoPeriodoForm.value.fechaFin
    };
    
    this.parametrosService.crearPeriodo(periodoData).subscribe({
      next: () => {
        this.loading = false;
        this.nuevoPeriodoForm.reset();
        this.loadPeriodos();
        // Cerrar modal
        const modal = document.getElementById('createPeriodModal');
        if (modal) {
          const bootstrapModal = (window as any).bootstrap.Modal.getInstance(modal);
          if (bootstrapModal) bootstrapModal.hide();
        }
        Swal.fire({
          title: '¡Éxito!',
          text: 'Período creado correctamente',
          icon: 'success',
          confirmButtonText: 'OK'
        });
      },
      error: (error: any) => {
        this.loading = false;
        Swal.fire({
          title: 'Error',
          text: 'No se pudo crear el período',
          icon: 'error',
          confirmButtonText: 'OK'
        });
      }
    });
  }



  configurarPeriodo(periodo: any): void {
    this.periodoSeleccionado = periodo;
    this.parametrosPage = 0;
    this.loadParametrosPorPeriodo(periodo.id);
  }
  
  volverAPeriodos(): void {
    this.showParametros = false;
    this.periodoSeleccionado = null;
  }
  
  agregarParametro(): void {

    // Lógica para agregar parámetro
  }
  
  editarParametro(param: any): void {
    param.valorOriginal = param.valor; // Guardar valor original
    param.mostrarEnDocsOriginal = param.mostrarEnDocs; // Guardar mostrarEnDocs original
    param.editando = true;
  }

  guardarValor(param: any): void {
    param.editando = false;
    this.actualizarValorParametro(param);
    // Si cambió mostrarEnDocs, también actualizarlo
    if (param.mostrarEnDocs !== param.mostrarEnDocsOriginal) {
      this.actualizarMostrarEnDocs(param);
    }
  }

  cancelarEdicion(param: any): void {
    param.valor = param.valorOriginal; // Restaurar valor original
    param.mostrarEnDocs = param.mostrarEnDocsOriginal; // Restaurar mostrarEnDocs original
    param.editando = false;
  }
  
  eliminarParametro(param: any): void {
    Swal.fire({
      title: '¿Está seguro?',
      text: `¿Desea eliminar el parámetro "${param.nombre}" del período seleccionado?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result: any) => {
      if (result.isConfirmed) {
        this.loading = true;
        this.parametrosService.eliminarParametroDePeriodo(param.id).subscribe({
          next: () => {
            this.loading = false;
            // Recargar parámetros del período
            this.loadParametrosPorPeriodo(this.periodoSeleccionado.id);
            Swal.fire({
              title: '¡Eliminado!',
              text: `Parámetro "${param.nombre}" eliminado correctamente del período`,
              icon: 'success',
              confirmButtonText: 'OK'
            });
          },
          error: (error: any) => {
            this.loading = false;
            Swal.fire({
              title: 'Error',
              text: 'No se pudo eliminar el parámetro del período',
              icon: 'error',
              confirmButtonText: 'OK'
            });
          }
        });
      }
    });
  }
  
  eliminarPeriodo(periodo: any): void {
    // Validar si el período está activo
    if (periodo.activo) {
      Swal.fire({
        title: 'No se puede eliminar',
        text: 'No se puede eliminar un período activo',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      return;
    }

    // Validar fechas - solo si el período está activo
    if (periodo.activo) {
      const fechaActual = new Date();
      const fechaInicio = new Date(periodo.fechaInicio);
      const fechaFin = new Date(periodo.fechaFin);
      
      if (fechaActual >= fechaInicio && fechaActual <= fechaFin) {
        Swal.fire({
          title: 'No se puede eliminar',
          text: 'No se puede eliminar el período actual activo',
          icon: 'warning',
          confirmButtonText: 'OK'
        });
        return;
      }
    }
    
    // Validar períodos pasados
    const fechaActual = new Date();
    const fechaFin = new Date(periodo.fechaFin);
    
    if (fechaFin < fechaActual) {
      Swal.fire({
        title: 'No se puede eliminar',
        text: 'No se puede eliminar períodos pasados',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      return;
    }

    Swal.fire({
      title: '¿Está seguro?',
      text: `¿Desea eliminar el período "${periodo.nombre}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result: any) => {
      if (result.isConfirmed) {
        this.loading = true;
        this.parametrosService.eliminarPeriodo(periodo.id).subscribe({
          next: () => {
            this.loading = false;
            this.loadPeriodos();
            Swal.fire({
              title: '¡Eliminado!',
              text: 'Período eliminado correctamente',
              icon: 'success',
              confirmButtonText: 'OK'
            });
          },
          error: (error: any) => {
            this.loading = false;
            Swal.fire({
              title: 'Error',
              text: 'No se pudo eliminar el período',
              icon: 'error',
              confirmButtonText: 'OK'
            });
          }
        });
      }
    });
  }
  
  activarPeriodo(periodo: any): void {
    // Validar si el período es futuro o pasado
    const fechaActual = new Date();
    const fechaInicio = new Date(periodo.fechaInicio);
    const fechaFin = new Date(periodo.fechaFin);
    
    if (fechaInicio > fechaActual) {
      Swal.fire({
        title: 'No se puede activar',
        text: 'No se puede activar un período futuro',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      return;
    }
    
    if (fechaFin < fechaActual) {
      Swal.fire({
        title: 'No se puede activar',
        text: 'No se puede activar un período pasado',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      return;
    }

    Swal.fire({
      title: '¿Está seguro?',
      text: `¿Desea activar el período "${periodo.nombre}"?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#28a745',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, activar',
      cancelButtonText: 'Cancelar'
    }).then((result: any) => {
      if (result.isConfirmed) {
        this.loading = true;
        this.parametrosService.activarPeriodo(periodo.id).subscribe({
          next: () => {
            this.loading = false;
            this.loadPeriodos();
            Swal.fire({
              title: '¡Activado!',
              text: 'Período activado correctamente',
              icon: 'success',
              confirmButtonText: 'OK'
            });
          },
          error: (error: any) => {
            this.loading = false;
            Swal.fire({
              title: 'Error',
              text: 'No se pudo activar el período',
              icon: 'error',
              confirmButtonText: 'OK'
            });
          }
        });
      }
    });
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

  loadAvailableParameters(): void {
    this.parametrosService.getParametrosDisponibles().subscribe({
      next: (parametros) => {
        this.parametrosDisponibles = parametros.map(p => ({ ...p, selected: false, value: '' }));
        this.aplicarFiltros();
      },

    });
  }

  aplicarFiltros(): void {
    this.parametrosDisponiblesFiltrados = this.parametrosDisponibles.filter(param => {
      const matchNombre = !this.filtroNombre || param.name.toLowerCase().includes(this.filtroNombre.toLowerCase());
      const matchTipo = !this.filtroTipo || param.dataType === this.filtroTipo;
      return matchNombre && matchTipo;
    });
  }

  agregarParametrosSeleccionados(): void {
    const seleccionados = this.parametrosDisponibles.filter(p => p.selected);
    if (seleccionados.length === 0) {
      Swal.fire({
        title: 'Advertencia',
        text: 'Debe seleccionar al menos un parámetro',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      return;
    }
    
    // Validar que todos los parámetros seleccionados tengan valor
    const sinValor = seleccionados.filter(p => !p.value || p.value.trim() === '');
    if (sinValor.length > 0) {
      Swal.fire({
        title: 'Advertencia',
        text: 'Todos los parámetros seleccionados deben tener un valor',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      return;
    }
    
    // Mapear a formato esperado por el backend
    const parametrosConValor = seleccionados.map(p => ({
      globalParameterId: p.id,
      value: p.value
    }));
    
    this.parametrosService.agregarParametrosAPeriodo(this.periodoSeleccionado.id, parametrosConValor).subscribe({
      next: () => {
        // Cerrar modal
        const modal = document.getElementById('addParameterModal');
        if (modal) {
          const bootstrapModal = (window as any).bootstrap.Modal.getInstance(modal);
          if (bootstrapModal) bootstrapModal.hide();
        }
        // Recargar parámetros del período
        this.loadParametrosPorPeriodo(this.periodoSeleccionado.id);
        Swal.fire({
          title: '¡Éxito!',
          text: `${seleccionados.length} parámetros agregados correctamente`,
          icon: 'success',
          confirmButtonText: 'OK'
        });
      },
      error: (error: any) => {

        Swal.fire({
          title: 'Error',
          text: 'No se pudieron agregar los parámetros',
          icon: 'error',
          confirmButtonText: 'OK'
        });
      }
    });
  }

  loadParametrosPorPeriodo(periodoId: string): void {

    this.parametrosService.getParametrosPorPeriodo(periodoId).subscribe({
      next: (parametros) => {

        // Mapear los datos del backend al formato esperado por el template
        this.parametros = parametros.map(param => ({
          id: param.id,
          nombre: param.globalParameter.name,
          valor: param.value,
          valorOriginal: param.value, // Guardar valor original para cancelar
          descripcion: param.globalParameter.description,
          estado: param.status,
          mostrarEnDocs: param.showInDocs !== undefined ? param.showInDocs : true,
          mostrarEnDocsOriginal: param.showInDocs !== undefined ? param.showInDocs : true,
          editando: false // Campo para controlar el modo edición
        }));

        this.parametrosPage = 0; // Reset paginación
      },
      error: (error: any) => {

        this.parametros = []; // Limpiar parámetros en caso de error
      }
    });
  }

  cambiarEstadoParametro(param: any): void {

    const nuevoEstado = param.estado === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    param.estado = nuevoEstado;
    
    this.parametrosService.actualizarEstadoParametro(param.id, nuevoEstado).subscribe({
      next: (response) => {

        Swal.fire({
          title: '¡Éxito!',
          text: `Estado del parámetro actualizado a ${nuevoEstado === 'ACTIVE' ? 'ACTIVO' : 'INACTIVO'}`,
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      },
      error: (error: any) => {

        // Revertir el cambio en caso de error
        param.estado = nuevoEstado === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        Swal.fire({
          title: 'Error',
          text: 'No se pudo actualizar el estado del parámetro',
          icon: 'error',
          confirmButtonText: 'OK'
        });
      }
    });
  }

  actualizarValorParametro(param: any): void {
    this.parametrosService.actualizarValorParametro(param.id, param.valor).subscribe({
      next: () => {
        Swal.fire({
          title: '¡Éxito!',
          text: 'Valor actualizado correctamente',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false
        });
      },
      error: (error: any) => {

        Swal.fire({
          title: 'Error',
          text: 'No se pudo actualizar el valor',
          icon: 'error',
          confirmButtonText: 'OK'
        });
      }
    });
  }

  actualizarMostrarEnDocs(param: any): void {
    this.parametrosService.actualizarMostrarEnDocs(param.id, param.mostrarEnDocs).subscribe({
      next: () => {
        param.mostrarEnDocsOriginal = param.mostrarEnDocs; // Actualizar valor original
      },
      error: (error: any) => {

        param.mostrarEnDocs = param.mostrarEnDocsOriginal; // Revertir en caso de error
      }
    });
  }
}