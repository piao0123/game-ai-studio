import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './js/levels/level1_airport.js';
import './js/levels/level2_subway.js';
import './js/levels/level3_bank.js';
import './js/levels/level0_test.js';
import './js/levels/level4_yacht.js';
import './js/levels/level5_hotel.js';
import './js/soundManager.js';
import './js/levelManager.js';
import './js/engine.js';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
