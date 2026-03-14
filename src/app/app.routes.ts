import { Routes } from '@angular/router';
import { provideRouter } from '@angular/router';

// Asegúrate de que ROOT_INVOICES y ROOT_CONTRACTS estén definidos en './config/config'
import { ROOT_CONFIGURATION, ROOT_LOGIN, ROOT_REGISTER, ROOT_HOME, ROOT_INVOICES, ROOT_CONTRACTS, ROOT_PARAMETROS, ROOT_PARAMETROS_FACTURAS, ROOT_REPORTES } from './config/config';
import { AuthGuard } from './shared/guards/auth.guard';
import { ActivePeriodGuard } from './shared/guards/active-period.guard';

import LayoutComponent from './shared/components/layout/layout.component';

import { HomeComponent } from './feature/home/home.component';
import { FacturasComponent } from './feature/facturas/facturas.component'; 
import { ContratosComponent } from './feature/contratos/contratos.component';
import { ReportesComponent } from './feature/reportes/reportes.component';
import { SetupComponent } from './feature/setup/setup.component';
import { ParametrosGlobalesComponent } from './feature/parametros-globales/parametros-globales.component';
import { ParametrosFacturasComponent } from './feature/parametros-facturas/parametros-facturas.component';
import { LoginComponent } from './shared/components/login/login.component';
import { RegisterComponent } from './shared/components/register/register.component';

export const routes: Routes = [
    { path: ROOT_LOGIN, component: LoginComponent },
    { path: ROOT_REGISTER, component: RegisterComponent },
    {
        path: '',
        component: LayoutComponent,
        canActivate: [AuthGuard],
        children: [
    // RUTAS DE FUNCIONALIDAD PRINCIPAL
    { path: ROOT_HOME, component: HomeComponent },
    { path: ROOT_CONTRACTS, component: ContratosComponent, canActivate: [ActivePeriodGuard] },
    { path: ROOT_INVOICES, component: FacturasComponent, canActivate: [ActivePeriodGuard] },
    { path: ROOT_REPORTES, component: ReportesComponent },
    
    // RUTAS DE CONFIGURACIÓN
    { path: ROOT_CONFIGURATION, component: SetupComponent },
    { path: ROOT_PARAMETROS, component: ParametrosGlobalesComponent },
    { path: ROOT_PARAMETROS_FACTURAS, component: ParametrosFacturasComponent },
    
    // REDIRECCIÓN POR DEFECTO: Apunta a Home
    { path: '', redirectTo: ROOT_HOME, pathMatch: 'full' }
]

    },
    {
        path: '**',
        redirectTo: ROOT_HOME // Redirige cualquier cosa desconocida a Home
    }
];

export const appRouting = provideRouter(routes);
