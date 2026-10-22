import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './main.js';

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(<App />);
}
