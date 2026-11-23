import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { EsLabelPipe } from '../../pipes/es-label.pipe';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { OptionMenu } from '../../model/option_menu';
import { CalculatorPanelService } from '../../services/calculator-panel.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [EsLabelPipe, CommonModule, RouterModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit, OnChanges {
  @Input() optionsMenu: OptionMenu[] = [];
  showToolbox: boolean = false;

  constructor(readonly calculator: CalculatorPanelService) {}

  ngOnInit() {
    // Inicialización del navbar
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['optionsMenu']) {
      // Opciones de menú actualizadas
    }
  }

  toggleToolbox(event: Event) {
    event.preventDefault();
    this.showToolbox = !this.showToolbox;
  }

  openCalculator() {
    this.showToolbox = false;
    this.calculator.toggle();
  }

  trackByOptionId(index: number, option: OptionMenu): string {
    return option.id || index.toString();
  }
}