import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { RouterModule, RouterOutlet } from '@angular/router';
import { 
  HEADER_BACKGROUND_COLOR, 
  HEADER_ICON_COLOR, 
  NAME_APP_LONG, 
  PRIMARY_ACTIVE_TEXT_COLOR, 
  PRIMARY_BACKGROUND_COLOR, 
  PRIMARY_TEXT_COLOR, 
  NAVBAR_BACKGROUND_COLOR,
  PRIMARY_ACCENT_COLOR
} from './config/config';

import { HeaderComponent } from "./shared/components/header/header.component";
import { FooterComponent } from "./shared/components/footer/footer.component";
import LayoutComponent from "./shared/components/layout/layout.component";
import { LoginComponent } from './shared/components/login/login.component';
import { isPlatformBrowser } from '@angular/common';
import { IdleTimeoutService } from './shared/services/idle-timeout.service';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet, 
    HeaderComponent, 
    FooterComponent,
    LayoutComponent, 
    LoginComponent, 
    RouterModule,
    
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  
  title = NAME_APP_LONG;
  
  constructor(
    @Inject(PLATFORM_ID) private platformId: object, 
    private idleTimeoutService: IdleTimeoutService
  ) {
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
    // Colores principales
    document.documentElement.style.setProperty('--primary-text-color', PRIMARY_TEXT_COLOR);
    document.documentElement.style.setProperty('--primary-background-color', PRIMARY_BACKGROUND_COLOR);
    document.documentElement.style.setProperty('--primary-active-text-color', PRIMARY_ACTIVE_TEXT_COLOR);
    
    // Header + Navbar
    document.documentElement.style.setProperty('--navbar-background-color', NAVBAR_BACKGROUND_COLOR);
    document.documentElement.style.setProperty('--header-background-color', HEADER_BACKGROUND_COLOR);
    document.documentElement.style.setProperty('--header-icon-color', HEADER_ICON_COLOR);
    
    // Color de acento
    document.documentElement.style.setProperty('--primary-accent-color', PRIMARY_ACCENT_COLOR); 
  }
}
