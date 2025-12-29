import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { OptionMenu } from '../../model/option_menu';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit, OnChanges {
  @Input() optionsMenu: OptionMenu[] = [];
  showToolbox: boolean = false;

  ngOnInit() {
    console.log('Opciones en navbar ngOnInit:', this.optionsMenu);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['optionsMenu']) {
      console.log('Opciones cambiaron en navbar:', this.optionsMenu);
      console.log('Cantidad de opciones:', this.optionsMenu.length);
      const parametersCount = this.optionsMenu.filter(opt => opt.url === '/parametros-globales').length;
      console.log('Cantidad de Parameters:', parametersCount);
    }
  }

  toggleToolbox(event: Event) {
    event.preventDefault();
    this.showToolbox = !this.showToolbox;
  }

  openCalculator() {
    // Funcionalidad de calculadora
  }

  trackByOptionId(index: number, option: OptionMenu): string {
    return option.id || index.toString();
  }
}