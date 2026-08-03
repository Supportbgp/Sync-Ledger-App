import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import BinderView from './components/BinderView.jsx';
import { UIProvider } from './context/UIContext.jsx';
import './styles/index.css';

// A binder QR code links to ?binder=<location> — that's the entire "routing"
// this app needs, so a router library would be overkill. The public binder
// view is intentionally a separate render tree from the authenticated app:
// no session check, no UIProvider (no confirm/toast/lightbox needed for a
// read-only page), nothing shared with the logged-in experience.
const binderParam = new URLSearchParams(window.location.search).get('binder');

const root = ReactDOM.createRoot(document.getElementById('root'));

if (binderParam) {
  root.render(
    <React.StrictMode>
      <BinderView location={binderParam} />
    </React.StrictMode>
  );
} else {
  root.render(
    <React.StrictMode>
      <UIProvider>
        <App />
      </UIProvider>
    </React.StrictMode>
  );
}
