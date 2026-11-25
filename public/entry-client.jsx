import { createElement } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { App } from './main.jsx';

const pages = {
  '/': () => import('./pages/HomePage.jsx'),
  '/catalogo': () => import('./pages/CatalogPage.jsx'),
  '/nosotros': () => import('./pages/AboutPage.jsx'),
  '/faqs': () => import('./pages/FaqPage.jsx'),
  '/como-funciona': () => import('./pages/HowItWorksPage.jsx'),
  '/aviso-legal': () => import('./pages/LegalPage.jsx'),
};

const initialPath = window.location.pathname.replace(/\/$/, '') || '/';
const isServiceDetailPath = /^\/catalogo\/[a-f0-9]{16}:[a-z0-9-]+$/.test(initialPath);
const pageModule = pages[initialPath]
  ? await pages[initialPath]()
  : isServiceDetailPath ? await import('./pages/ServiceDetailPage.jsx') : null;
hydrateRoot(document.getElementById('root'), createElement(App, {
  initialPath,
  ...(pageModule ? { initialPage: pageModule.default } : {}),
}));