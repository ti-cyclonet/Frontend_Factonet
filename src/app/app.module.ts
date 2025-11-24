import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { AppComponent } from './app.component';
import { AuthInterceptor } from './interceptors/auth.interceptor';

@NgModule({
  declarations: [
    AppComponent // ✅ Componente principal declarado
  ],
  imports: [
    BrowserModule, // ✅ Módulo base necesario
    HttpClientModule // ✅ Para comunicación HTTP con el backend
  ],
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    }
  ],
  bootstrap: [AppComponent] // ✅ App inicia desde AppComponent
})
export class AppModule { }
