import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import BinderView from './components/BinderView.jsx';
import StaffDocs from './components/docs/StaffDocs.jsx';
import { UIProvider } from './context/UIContext.jsx';
import './styles/index.css';

// A binder QR code links to ?binder=<location>, and the staff docs page
// (footer link, or bookmarked/printed directly) links to ?help=1 — that's
// the entire "routing" this app needs, so a router library would be
// overkill. Both are intentionally separate render trees from the
// authenticated app: no session check, no UIProvider (no confirm/toast/
// lightbox needed for a read-only page), nothing shared with the logged-in
// experience. Staff docs deliberately needs no login — it should be
// reachable on a phone before ever signing in, or bookmarked/printed.
const params = new URLSearchParams(window.location.search);
const binderParam = params.get('binder');
const helpParam = params.get('help');

const root = ReactDOM.createRoot(document.getElementById('root'));

if (binderParam) {
  root.render(
    <React.StrictMode>
      <BinderView location={binderParam} />
    </React.StrictMode>
  );
} else if (helpParam) {
  root.render(
    <React.StrictMode>
      <StaffDocs />
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
