import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import './index.css';
import AppRoutes from './routes/AppRoutes';
import reportWebVitals from './reportWebVitals';
import { Toaster } from 'react-hot-toast';


const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Router>
    <Toaster />
      <AppRoutes />
    </Router>
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((reg) => console.log("Service Worker registered:", reg.scope))
      .catch((err) => console.log("Service Worker registration failed:", err));
  });
}


reportWebVitals();

