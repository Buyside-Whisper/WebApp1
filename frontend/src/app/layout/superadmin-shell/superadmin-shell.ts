import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LucideAngularModule, LogOut } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageSwitch } from '../../shared/language-switch/language-switch';
import { TranslatePipe } from '../../core/i18n/t.pipe';

@Component({
  selector: 'app-superadmin-shell',
  imports: [TranslatePipe, LanguageSwitch, RouterLink, RouterLinkActive, RouterOutlet, LucideAngularModule],
  templateUrl: './superadmin-shell.html',
})
export class SuperadminShell {
  protected readonly auth = inject(AuthService);
  protected readonly LogOutIcon = LogOut;
}
