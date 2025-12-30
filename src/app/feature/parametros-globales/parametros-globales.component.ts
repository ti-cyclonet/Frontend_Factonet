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
  nuevoParametroForm: FormGroup;
  nuevoSubperiodoForm: FormGroup;
  nuevoPeriodo = { nombre: '', fechaInicio: '', fechaFin: '' };
  
  parametrosDisponibles: any[] = [];
  parametrosDisponiblesFiltrados: any[] = [];
  filtroNombre: string = '';
  filtroTipo: string = '';
  
  // Filtros para períodos
  filtroNombrePeriodo = '';
  filtroFecha = '';
  periodosFiltrados: any[] = [];
  
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
    
    this.nuevoParametroForm = this.fb.group({
      name: ['', Validators.required],
      description: ['', Validators.required],
      dataType: ['', Validators.required]
    });
    
    this.nuevoSubperiodoForm = this.fb.group({
      nombre: ['', Validators.required],
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
          activo: periodo.status === 'ACTIVE',
          parentPeriodId: periodo.parentPeriodId // Agregar este campo
        }));
        
        // Encontrar período activo para el botón flotante
        this.periodoActivo = this.periodos.find(p => p.activo);
        this.aplicarFiltrosPeriodos();
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

  validateParameterName(): void {
    const nameControl = this.nuevoParametroForm.get('name');
    if (nameControl?.value && nameControl.value.trim()) {
      this.parametrosService.validateParameterName(nameControl.value.trim()).subscribe({
        next: (exists) => {
          if (exists) {
            nameControl.setErrors({ nameExists: true });
          } else {
            const currentErrors = nameControl.errors;
            if (currentErrors) {
              delete currentErrors['nameExists'];
              nameControl.setErrors(Object.keys(currentErrors).length ? currentErrors : null);
            }
          }
        },
        error: () => {
          // En caso de error, no bloquear la validación
        }
      });
    }
  }

  configurarSubperiodo(periodo: any): void {
    this.periodoSeleccionado = periodo;
    // Establecer fechas mínimas y máximas basadas en el período padre
    const startDate = new Date(periodo.fechaInicio).toISOString().slice(0, 16);
    const endDate = new Date(periodo.fechaFin).toISOString().slice(0, 16);
    
    // Configurar límites en los inputs
    setTimeout(() => {
      const startInput = document.getElementById('subperiodStartDate') as HTMLInputElement;
      const endInput = document.getElementById('subperiodEndDate') as HTMLInputElement;
      if (startInput && endInput) {
        startInput.min = startDate;
        startInput.max = endDate;
        endInput.min = startDate;
        endInput.max = endDate;
      }
    }, 100);
  }

  crearSubperiodo(): void {
    if (this.nuevoSubperiodoForm.invalid) {
      this.nuevoSubperiodoForm.markAllAsTouched();
      return;
    }

    const fechaInicio = new Date(this.nuevoSubperiodoForm.value.fechaInicio);
    const fechaFin = new Date(this.nuevoSubperiodoForm.value.fechaFin);
    const periodoInicio = new Date(this.periodoSeleccionado.fechaInicio);
    const periodoFin = new Date(this.periodoSeleccionado.fechaFin);
    
    // Validaciones
    if (fechaFin <= fechaInicio) {
      Swal.fire({
        title: 'Validation Error',
        text: 'End date must be after start date',
        icon: 'error',
        confirmButtonText: 'OK'
      });
      return;
    }
    
    if (fechaInicio < periodoInicio || fechaFin > periodoFin) {
      Swal.fire({
        title: 'Validation Error',
        text: 'Subperiod must be within the parent period dates',
        icon: 'error',
        confirmButtonText: 'OK'
      });
      return;
    }

    this.loading = true;
    const subperiodoData = {
      nombre: this.nuevoSubperiodoForm.value.nombre,
      fechaInicio: this.nuevoSubperiodoForm.value.fechaInicio,
      fechaFin: this.nuevoSubperiodoForm.value.fechaFin,
      parentPeriodId: this.periodoSeleccionado.id
    };
    
    this.parametrosService.crearSubperiodo(subperiodoData).subscribe({
      next: () => {
        this.loading = false;
        this.nuevoSubperiodoForm.reset();
        this.loadPeriodos();
        // Cerrar modal
        const modal = document.getElementById('createSubperiodModal');
        if (modal) {
          const bootstrapModal = (window as any).bootstrap.Modal.getInstance(modal);
          if (bootstrapModal) bootstrapModal.hide();
        }
        Swal.fire({
          title: 'Success!',
          text: 'Subperiod created successfully',
          icon: 'success',
          confirmButtonText: 'OK'
        });
      },
      error: (error: any) => {
        this.loading = false;
        Swal.fire({
          title: 'Error',
          text: 'Could not create subperiod',
          icon: 'error',
          confirmButtonText: 'OK'
        });
      }
    });
  }

  crearParametroGlobal(): void {
    if (this.nuevoParametroForm.invalid) {
      this.nuevoParametroForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    const parametroData = {
      code: this.nuevoParametroForm.value.name.toUpperCase().replace(/\s+/g, '_'),
      name: this.nuevoParametroForm.value.name,
      description: this.nuevoParametroForm.value.description,
      dataType: this.nuevoParametroForm.value.dataType,
      value: this.nuevoParametroForm.value.dataType === 'number' ? '0' : '',
      isActive: true
    };
    
    this.parametrosService.crearParametroGlobal(parametroData).subscribe({
      next: () => {
        this.loading = false;
        this.nuevoParametroForm.reset();
        // NO cerrar el modal para permitir agregar más parámetros
        // Recargar parámetros disponibles y parámetros del período
        this.loadAvailableParameters();
        if (this.periodoSeleccionado) {
          this.loadParametrosPorPeriodo(this.periodoSeleccionado.id);
        }
        Swal.fire({
          title: 'Success!',
          text: 'Global parameter created successfully',
          icon: 'success',
          confirmButtonText: 'OK'
        });
      },
      error: (error: any) => {
        this.loading = false;
        Swal.fire({
          title: 'Error',
          text: 'Could not create global parameter',
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
    param.valorOriginal = param.valor;
    param.editando = true;
  }

  guardarValor(param: any): void {
    param.editando = false;
    this.actualizarValorParametro(param);
  }

  cancelarEdicion(param: any): void {
    param.valor = param.valorOriginal;
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
    const fechaActual = new Date();
    const fechaInicio = new Date(periodo.fechaInicio);
    const fechaFin = new Date(periodo.fechaFin);
    
    // Para períodos principales (no subperíodos)
    if (!periodo.parentPeriodId) {
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
    }
    
    // Para subperíodos, permitir activación si es futuro o actual
    if (periodo.parentPeriodId && fechaInicio >= fechaActual && fechaFin < fechaActual) {
      Swal.fire({
        title: 'No se puede activar',
        text: 'No se puede activar un subperíodo expirado',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      return;
    }

    Swal.fire({
      title: '¿Está seguro?',
      text: `¿Desea activar el ${periodo.parentPeriodId ? 'subperíodo' : 'período'} "${periodo.nombre}"?`,
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
            // Iniciar monitoreo de expiración para subperíodos
            if (periodo.parentPeriodId) {
              this.monitorearExpiracionSubperiodo(periodo);
            }
            Swal.fire({
              title: '¡Activado!',
              text: `${periodo.parentPeriodId ? 'Subperíodo' : 'Período'} activado correctamente`,
              icon: 'success',
              confirmButtonText: 'OK'
            });
          },
          error: (error: any) => {
            this.loading = false;
            Swal.fire({
              title: 'Error',
              text: `No se pudo activar el ${periodo.parentPeriodId ? 'subperíodo' : 'período'}`,
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
    return this.periodosFiltrados.slice(start, start + this.periodosPageSize);
  }
  
  get parametrosPaginados() {
    const start = this.parametrosPage * this.parametrosPageSize;
    return this.parametros.slice(start, start + this.parametrosPageSize);
  }
  
  get totalPeriodosPages() {
    return Math.ceil(this.periodosFiltrados.length / this.periodosPageSize);
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
        // Obtener IDs de parámetros ya configurados en el período
        const parametrosConfigurados = this.parametros.map(p => p.globalParameterId || p.id);
        
        // Filtrar parámetros disponibles excluyendo los ya configurados
        const parametrosFiltrados = parametros.filter(p => !parametrosConfigurados.includes(p.id));
        
        // No usar spread operator para mantener referencias
        this.parametrosDisponibles = parametrosFiltrados.map(p => {
          return {
            id: p.id,
            code: p.code,
            name: p.name,
            description: p.description,
            dataType: p.dataType,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
            selected: false,
            value: ''
          };
        });
        this.aplicarFiltros();
      },

    });
  }

  aplicarFiltros(): void {
    // No recrear objetos, solo filtrar referencias existentes
    this.parametrosDisponiblesFiltrados = this.parametrosDisponibles.filter(param => {
      const matchNombre = !this.filtroNombre || param.name.toLowerCase().includes(this.filtroNombre.toLowerCase());
      const matchTipo = !this.filtroTipo || param.dataType === this.filtroTipo;
      return matchNombre && matchTipo;
    });
  }

  aplicarFiltrosPeriodos(): void {
    this.periodosFiltrados = this.periodos.filter(periodo => {
      const matchNombre = !this.filtroNombrePeriodo || 
        periodo.nombre.toLowerCase().includes(this.filtroNombrePeriodo.toLowerCase());
      
      const matchFecha = !this.filtroFecha || (
        new Date(periodo.fechaInicio) <= new Date(this.filtroFecha) &&
        new Date(periodo.fechaFin) >= new Date(this.filtroFecha)
      );
      
      return matchNombre && matchFecha;
    });
    this.periodosPage = 0; // Reset a primera página
  }

  limpiarFiltrosPeriodos() {
    this.filtroNombrePeriodo = '';
    this.filtroFecha = '';
    this.aplicarFiltrosPeriodos();
  }

  trackByParamId(index: number, param: any): string {
    return param.id;
  }

  onParameterSelectionChange(param: any): void {
    // Actualizar también en el array original
    const originalParam = this.parametrosDisponibles.find(p => p.id === param.id);
    if (originalParam) {
      originalParam.selected = param.selected;
      originalParam.value = param.value;
    }
  }

  agregarParametrosSeleccionados(): void {
    // Buscar directamente en la tabla los checkboxes marcados
    const checkboxes = document.querySelectorAll('#addParameterModal input[type="checkbox"]:checked');
    const seleccionados: any[] = [];
    
    checkboxes.forEach((checkbox: any) => {
      const paramId = checkbox.id.replace('param-', '');
      const param = this.parametrosDisponibles.find(p => p.id === paramId);
      if (param) {
        // Obtener el valor del input correspondiente
        const valueInput = document.querySelector(`#addParameterModal tr:has(#${checkbox.id}) input[type="text"]`) as HTMLInputElement;
        if (valueInput && valueInput.value.trim()) {
          seleccionados.push({
            ...param,
            value: valueInput.value.trim()
          });
        }
      }
    });
    
    if (seleccionados.length === 0) {
      Swal.fire({
        title: 'Advertencia',
        text: 'Debe seleccionar al menos un parámetro con valor',
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
      next: (response) => {
        // Limpiar checkboxes y valores del DOM
        checkboxes.forEach((checkbox: any) => {
          checkbox.checked = false;
          const valueInput = document.querySelector(`#addParameterModal tr:has(#${checkbox.id}) input[type="text"]`) as HTMLInputElement;
          if (valueInput) valueInput.value = '';
        });
        
        // Recargar parámetros del período
        this.loadParametrosPorPeriodo(this.periodoSeleccionado.id);
        // Volver al modal anterior
        this.volverAConfigureParameters();
        Swal.fire({
          title: '¡Éxito!',
          text: `${seleccionados.length} parámetros agregados correctamente`,
          icon: 'success',
          confirmButtonText: 'OK'
        });
      },
      error: (error: any) => {
        console.log('Error del backend:', error);
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

        this.parametros = parametros.map(param => ({
          id: param.id,
          globalParameterId: param.globalParameter.id,
          nombre: param.globalParameter.name,
          valor: param.value,
          valorOriginal: param.value,
          descripcion: param.globalParameter.description,
          estado: param.status,
          editando: false
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

  volverAConfigureParameters(): void {
    // Cerrar modal Add Parameters
    const addModal = document.getElementById('addParameterModal');
    if (addModal) {
      const bootstrapModal = (window as any).bootstrap.Modal.getInstance(addModal);
      if (bootstrapModal) bootstrapModal.hide();
    }
    
    // Abrir modal Configure Parameters
    setTimeout(() => {
      const configModal = document.getElementById('parametersModal');
      if (configModal) {
        const bootstrapModal = new (window as any).bootstrap.Modal(configModal);
        bootstrapModal.show();
      }
    }, 300);
  }

  monitorearExpiracionSubperiodo(subperiodo: any): void {
    const fechaFin = new Date(subperiodo.fechaFin);
    const ahora = new Date();
    const tiempoRestante = fechaFin.getTime() - ahora.getTime();
    
    if (tiempoRestante > 0) {
      setTimeout(() => {
        // Desactivar subperíodo automáticamente
        this.parametrosService.desactivarPeriodo(subperiodo.id).subscribe({
          next: () => {
            this.loadPeriodos();
            Swal.fire({
              title: 'Subperiod Expired',
              text: `Subperiod "${subperiodo.nombre}" has been automatically deactivated`,
              icon: 'info',
              timer: 5000,
              showConfirmButton: true,
              confirmButtonText: 'OK'
            });
          },
          error: () => {
            // Silencioso en caso de error
          }
        });
      }, tiempoRestante);
    }
  }

  getParentPeriodName(parentPeriodId: string): string {
    const parentPeriod = this.periodos.find(p => p.id === parentPeriodId);
    return parentPeriod ? parentPeriod.nombre : 'Unknown';
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


}