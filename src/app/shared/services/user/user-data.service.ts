import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface UserData {
  id: string;
  name: string;
  email: string;
  rol: string;
  rolDescription: string;
  image?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserDataService {
  private userDataSubject = new BehaviorSubject<UserData | null>(null);
  public userData$ = this.userDataSubject.asObservable();

  constructor() {
    this.loadUserFromSession();
  }

  private loadUserFromSession(): void {
    if (typeof window !== 'undefined') {
      const userData: UserData | null = this.getUserFromSession();
      this.userDataSubject.next(userData);
    }
  }

  getUserFromSession(): UserData | null {
    if (typeof window === 'undefined') return null;

    const id = sessionStorage.getItem('user_id');
    const email = sessionStorage.getItem('user_email');
    const rol = sessionStorage.getItem('user_rol');
    const rolDescription = sessionStorage.getItem('user_rolDescription');
    const image = sessionStorage.getItem('user_image');
    
    // Construir el nombre igual que en Authoriza
    const firstName = sessionStorage.getItem('user_firstName');
    const secondName = sessionStorage.getItem('user_secondName');
    const businessName = sessionStorage.getItem('user_businessName');
    
    const userName = sessionStorage.getItem('user_name') || '';
    const fallbackName = (userName && !userName.includes('@')) ? userName : '';
    
    const name = businessName
      ? businessName
      : `${firstName ?? ''} ${secondName ?? ''}`.trim() || fallbackName || 'Usuario';

    if (!id || !email || !rol) return null;

    return {
      id,
      name,
      email,
      rol,
      rolDescription: rolDescription || rol,
      image: image || undefined
    };
  }

  updateUserData(userData: UserData): void {
    this.userDataSubject.next(userData);
  }

  clearUserData(): void {
    this.userDataSubject.next(null);
  }

  getCurrentUser(): UserData | null {
    return this.userDataSubject.value;
  }
}