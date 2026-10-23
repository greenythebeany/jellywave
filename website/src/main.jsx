import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

const root = document.getElementById('root');
const app = <StrictMode><App /></StrictMode>;
// The build prerenders the page into #root (see build.js); the dev server doesn't.
if (root.firstElementChild) hydrateRoot(root, app);
else createRoot(root).render(app);
