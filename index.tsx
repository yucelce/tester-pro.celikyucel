import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './src/App';
import { Analytics } from '@vercel/analytics/react'; // 1. BURAYI EKLEYİN


const root = createRoot(document.getElementById('root')!);
root.render(
  <>
    <App />
    <Analytics /> {/* 2. BURAYI EKLEYİN */}
  </>
);