import { AutomaticAuditApp } from './app';
import './styles/main.scss';
import 'bootstrap';
import 'bootstrap/scss/bootstrap.scss';

// Initialize the application
const app = new AutomaticAuditApp();

// Make app globally available for the modal close function
declare global {
  interface Window {
    app: AutomaticAuditApp;
  }
}

window.app = app; 