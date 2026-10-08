import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ReportesComponent } from './reportes.component';

describe('ReportesComponent', () => {
  let fixture: ComponentFixture<ReportesComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReportesComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ReportesComponent);
    fixture.detectChanges();
  });

  it('al abrir pide los indicadores de gestión', () => {
    expect(fixture.componentInstance).toBeTruthy();
    http.expectOne(r => r.url.endsWith('/reports/management-indicators'));
  });

  it('al cambiar de pestaña pide ese reporte', () => {
    http.match(() => true);
    fixture.componentInstance.setActiveTab('invoices');
    http.expectOne(r => r.url.endsWith('/reports/invoices'));
  });
});
