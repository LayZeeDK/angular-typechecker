import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NxWelcome } from './nx-welcome';

@Component({
  imports: [NxWelcome, RouterModule],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected title = 'ng-spike-app';
  // SPIKE (code-scanning-alert-probe): deliberate TS2322 to trigger a Code
  // Scanning alert. THROWAWAY -- must never merge to main.
  protected count: number = 'not a number';
}
