import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { RouterModule, RouterOutlet } from '@angular/router';
import { 
  HEADER_BACKGROUND_COLOR, 
  HEADER_ICON_COLOR, 
  NAME_APP_LONG, 
  PRIMARY_ACTIVE_TEXT_COLOR, 
  PRIMARY_BACKGROUND_COLOR, 
  PRIMARY_TEXT_COLOR, 
  NAVBAR_BACKGROUND_COLOR, // <-- ¡CORREGIDO! Usamos el nuevo nombre
  PRIMARY_ACCENT_COLOR     // <-- ¡AÑADIDO! Si lo necesitas para el acento
} from './config/config';
import { HeaderComponent } from "./shared/components/header/header.component";
import { FooterComponent } from "./shared/components/footer/footer.component";
// import { SidebarComponent } from "./shared/components/sidebar/sidebar.component"; // <-- ¡ELIMINADO! Ya no existe la barra lateral
import LayoutComponent from "./shared/components/layout/layout.component";
import { LoginComponent } from './shared/components/login/login.component';
import { isPlatformBrowser } from '@angular/common';
// import { OptionMenu } from './shared/model/option_menu'; // <-- Importación innecesaria aquí
import { IdleTimeoutService } from './shared/services/idle-timeout.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet, 
    HeaderComponent, 
    FooterComponent, 
    // SidebarComponent, // <-- ¡ELIMINADO de imports!
    LayoutComponent, 
    LoginComponent, 
    RouterModule
],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit{
  
  title = NAME_APP_LONG;
  
  constructor(@Inject(PLATFORM_ID) private platformId: object, private idleTimeoutService: IdleTimeoutService ) {
    if (isPlatformBrowser(this.platformId)) {
        this.idleTimeoutService.startWatching();
    }
}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.setPrimaryColors();
    }
  }

  setPrimaryColors() {
    // Definición de colores principales
    document.documentElement.style.setProperty('--primary-text-color', PRIMARY_TEXT_COLOR);
    document.documentElement.style.setProperty('--primary-background-color', PRIMARY_BACKGROUND_COLOR);
    document.documentElement.style.setProperty('--primary-active-text-color', PRIMARY_ACTIVE_TEXT_COLOR);
    
    // Header y Navbar (Barra superior)
    document.documentElement.style.setProperty('--navbar-background-color', NAVBAR_BACKGROUND_COLOR); // <-- ¡CORREGIDO!
    document.documentElement.style.setProperty('--header-background-color', HEADER_BACKGROUND_COLOR);
    document.documentElement.style.setProperty('--header-icon-color', HEADER_ICON_COLOR);
    
    // Añadir el color de acento principal si se usa en el CSS (para las pestañas activas)
    document.documentElement.style.setProperty('--primary-accent-color', PRIMARY_ACCENT_COLOR); 

    // ELIMINAMOS la propiedad que ya no existe en el config
    // document.documentElement.style.setProperty('--sidebar-background-color', SIDEBAR_BACKGROUND_COLOR); 
  }
}
