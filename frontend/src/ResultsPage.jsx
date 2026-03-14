import { useNavigate } from 'react-router-dom';

function ResultsPage() {
  const navigate = useNavigate();
  
  // Load results from localStorage (set by App.jsx after search)
  let results = [];
  let jobInfo = {};
  try {
    results = JSON.parse(localStorage.getItem('coastal_results') || '[]');
    jobInfo = JSON.parse(localStorage.getItem('coastal_job') || '{}');
  } catch (e) {
    console.error('Failed to load results from storage', e);
  }

  const getScoreStyle = (score) => {
    if (score >= 80) return { background: '#22c55e', color: 'white' };
    if (score >= 50) return { background: '#f59e0b', color: 'white' };
    return { background: '#ef4444', color: 'white' };
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      color: '#e2e8f0',
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      padding: '24px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid #334155',
            borderRadius: '8px',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '8px 16px',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          ← Back to Map
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#f1f5f9' }}>🛰️ Coastal Sentinel — Results</h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
            {jobInfo.taskType || 'Search'} · {jobInfo.startDate} → {jobInfo.endDate} · {results.length} scenes · Executed: {jobInfo.executedAt || '—'}
          </p>
        </div>
      </div>

      {results.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px', color: '#475569' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🌊</div>
          <p>No results found. Go back and run a new search.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid #334155' }}>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Preview</th>
                <th style={thStyle}>Datetime</th>
                <th style={thStyle}>Tidal Level (m)</th>
                <th style={thStyle}>☁️ Cloud Cover</th>
                <th style={thStyle}>Score</th>
                <th style={thStyle}>Scene ID</th>
                <th style={thStyle}>Copernicus</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: '1px solid #1e293b',
                    background: idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'}
                >
                  <td style={tdStyle}>{idx + 1}</td>
                  <td style={tdStyle}>
                    {/* Stylized preview placeholder */}
                    <div
                      onClick={() => window.open(result.copernicus_url, '_blank')}
                      title="Open in Copernicus Browser"
                      style={{
                        width: '72px',
                        height: '72px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #1e40af 0%, #0ea5e9 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.5rem',
                        cursor: 'pointer',
                        border: '1px solid #334155',
                        flexShrink: 0,
                      }}
                    >
                      🛰️
                    </div>
                  </td>
                  <td style={tdStyle}>{result.datetime || '—'}</td>
                  <td style={{...tdStyle, fontVariantNumeric: 'tabular-nums'}}>
                    {typeof result.tide_level === 'number' ? result.tide_level.toFixed(2) : '—'}
                  </td>
                  <td style={tdStyle}>{typeof result.cloud_cover === 'number' ? `${result.cloud_cover.toFixed(1)}%` : '—'}</td>
                  <td style={tdStyle}>
                    <span style={{
                      ...getScoreStyle(result.score),
                      padding: '3px 10px',
                      borderRadius: '12px',
                      fontWeight: 'bold',
                      fontSize: '0.85rem',
                    }}>
                      {result.score}/100
                    </span>
                  </td>
                  <td style={{ ...tdStyle, maxWidth: '200px' }}>
                    <span title={result.scene_id} style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {result.scene_id}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <a
                      href={result.copernicus_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        background: 'rgba(99,102,241,0.15)',
                        border: '1px solid #6366f1',
                        color: '#818cf8',
                        borderRadius: '6px',
                        padding: '5px 10px',
                        fontSize: '0.8rem',
                        textDecoration: 'none',
                        whiteSpace: 'nowrap',
                        display: 'inline-block',
                      }}
                    >
                      Open →
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const thStyle = {
  padding: '12px 16px',
  textAlign: 'left',
  fontSize: '0.75rem',
  fontWeight: '600',
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '12px 16px',
  verticalAlign: 'middle',
};

export default ResultsPage;
