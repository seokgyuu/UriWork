import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { GoogleOAuthProvider } from '@react-oauth/google'

// Firebase 강제 초기화
import './firebase';

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "677208475739-337v40a1qu7h98usthcnjcdpkfoh645n.apps.googleusercontent.com";

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={clientId}>
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>,
)
