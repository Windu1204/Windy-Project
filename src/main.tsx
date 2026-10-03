import { LanguageProvider } from './lib/language';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
createRoot(document.getElementById('root')!).render(<StrictMode><LanguageProvider><App /></LanguageProvider></StrictMode>);

import './reference-shell.css';
import './reference-dashboard.css';
import './corporate-theme.css';
import './revisions.css';
