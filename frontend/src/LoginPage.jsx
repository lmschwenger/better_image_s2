import { useNavigate } from 'react-router-dom';

function LoginPage() {
  const navigate = useNavigate();
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

  const handleLogin = (provider) => {
    // Redirect the entire page to the backend to start the OAuth flow
    window.location.href = `${apiUrl}/auth/login/${provider}`;
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        background: 'rgba(30, 41, 59, 0.8)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(99, 102, 241, 0.2)',
        borderRadius: '16px',
        padding: '36px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🛰️</div>
          <h1 style={{ color: '#f1f5f9', margin: '0 0 8px', fontSize: '1.6rem', fontWeight: '700' }}>
            Better Image<span style={{ fontWeight: 800 }}>[S]2</span>
          </h1>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.9rem' }}>
            Sign in to save your coastal processing jobs
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Google Login Button */}
          <button
            onClick={() => handleLogin('google')}
            style={buttonStyle}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <img 
              src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" 
              alt="Google" 
              style={{ width: '20px', height: '20px' }} 
            />
            Continue with Google
          </button>

          {/* GitHub Login Button */}
          <button
            onClick={() => handleLogin('github')}
            style={{ ...buttonStyle, background: '#24292f', color: '#ffffff' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <svg height="20" viewBox="0 0 16 16" width="20" fill="white">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
            </svg>
            Continue with GitHub
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: '32px', borderTop: '1px solid #334155', paddingTop: '24px' }}>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: '500',
              transition: 'color 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#94a3b8'}
            onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
          >
            ← Back to Map (Anonymous)
          </button>
        </div>
      </div>
    </div>
  );
}

const buttonStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '12px',
  width: '100%',
  padding: '12px',
  background: 'white',
  border: 'none',
  borderRadius: '8px',
  color: '#1e293b',
  fontSize: '0.95rem',
  fontWeight: '600',
  cursor: 'pointer',
  transition: 'transform 0.2s, background-color 0.2s',
  boxSizing: 'border-box',
};

export default LoginPage;
