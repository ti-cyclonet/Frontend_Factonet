import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';

@NgModule({
  declarations: [
   // ✅ Único componente declarado
  ],
  imports: [
    BrowserModule // ✅ Módulo base necesario
  ],
  providers: [],
  bootstrap: [] // ✅ App inicia desde AppComponent
})
export class AppModule { }
