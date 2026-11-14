import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './ui/project'; // snapshot the page before React renders
import App from './App';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

// debugging / automated-test hook
import * as runtime from './runtime';
import { useUI } from './store';
import { view } from './render/SceneView';
import { SPECS } from './physics/components';
(window as unknown as Record<string, unknown>).__ts = { runtime, useUI, view, showroom() {
  runtime.clearScene(); const types = Object.keys(SPECS).filter((t) => t !== 'pipe'); let i = 0;
  for (const t of types) { runtime.addComponent(t, [(i % 5) * 6 - 12, 0, Math.floor(i / 5) * 6 - 6], 0); i++; }
  return types;
} };
