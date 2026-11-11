import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider, useAuth } from './AuthContext.tsx';
import LoginPage from './LoginPage.tsx';
import CargaRegras from './apuracao/CargaRegras';

function Root() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#001F3F] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#F5C000] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return <LoginPage />;
  // Carga única das regras da apuração (endereço sem link no app: /#carga-regras)
  if (window.location.hash === '#carga-regras') return <CargaRegras />;
  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </StrictMode>,
);
