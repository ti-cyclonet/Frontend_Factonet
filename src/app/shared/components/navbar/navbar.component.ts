import { Component, Input } from '@angular/core';
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
export class NavbarComponent {
  @Input() optionsMenu: OptionMenu[] = [];
  showToolbox: boolean = false;

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