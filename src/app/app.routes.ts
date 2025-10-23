import { Routes } from '@angular/router';
import { provideRouter } from '@angular/router';

// Asegúrate de que ROOT_INVOICES y ROOT_CONTRACTS estén definidos en './config/config'
import { ROOT_CONFIGURATION, ROOT_LOGIN, ROOT_REGISTER, ROOT_INVOICES, ROOT_CONTRACTS } from './config/config';
import { AuthGuard } from './shared/guards/auth.guard';

import LayoutComponent from './shared/components/layout/layout.component';
// ELIMINADAS: import { HomeComponent } from './feature/home/home.component';
// ELIMINADAS: import { MaterialsComponent } from './feature/materials/materials.component';

// NUEVOS COMPONENTES: Asegúrate de que la ruta de importación sea correcta
import { FacturasComponent } from './feature/facturas/facturas.component'; 
import { ContratosComponent } from './feature/contratos/contratos.component';
import { SetupComponent } from './feature/setup/setup.component';
import { LoginComponent } from './shared/components/login/login.component';
import { RegisterComponent } from './shared/components/register/register.component';

export const routes: Routes = [
    { path: ROOT_LOGIN, component: LoginComponent },
    { path: ROOT_REGISTER, component: RegisterComponent },
    {
        path: '',
        component: LayoutComponent,
        //canActivate: [AuthGuard],
        children: [
            // RUTAS DE FUNCIONALIDAD PRINCIPAL
            { path: ROOT_INVOICES, component: FacturasComponent, canActivate: [AuthGuard] },
            { path: ROOT_CONTRACTS, component: ContratosComponent, canActivate: [AuthGuard] },
            
            // RUTA DE CONFIGURACIÓN
            { path: ROOT_CONFIGURATION, component: SetupComponent, canActivate: [AuthGuard] },
            
            // REDIRECCIÓN POR DEFECTO: Apunta a Facturas (ya no hay Home)
            { path: '', redirectTo: ROOT_INVOICES, pathMatch: 'full' }
        ]
    },
    {
        path: '**',
        redirectTo: ROOT_INVOICES // Redirige cualquier cosa desconocida a Facturas
    }
];

export const appRouting = provideRouter(routes);
