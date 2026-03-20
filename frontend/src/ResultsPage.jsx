import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function MiniMap({ geojson }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !geojson) return;

    // Create a non-interactive mini map
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      tap: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);

    // Draw the polygon
    const geometry = geojson.geometry || geojson;
    const layer = L.geoJSON(geometry, {
      style: {
        color: '#6366f1',
        weight: 2,
        fillColor: '#6366f1',
        fillOpacity: 0.15,
      },
    }).addTo(map);

    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [10, 10] });
    }

    mapRef.current = map;

    return () => {
      map.remove();
    };
  }, [geojson]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '200px',
        height: '140px',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid #334155',
        flexShrink: 0
      }}
    />
  );
}

function ScoreCalculationModal({ breakdown, onClose }) {
  if (!breakdown) return null;
  
  const items = [
    { label: "Initial Score", value: breakdown.initial_score, isBase: true },
    { label: "Cloud Penalty", value: breakdown.cloud_penalty, raw: breakdown.cloud_percent, unit: '%' },
    { label: "Sun Glint Penalty", value: breakdown.sun_glint_penalty, raw: breakdown.sun_elevation, unit: '°' },
    { label: "Snow/Ice Penalty", value: breakdown.snow_ice_penalty, raw: breakdown.snow_ice_percent, unit: '%' },
    { label: "Aerosol Penalty", value: breakdown.aerosol_penalty, raw: breakdown.aot_mean },
    { label: "Turbidity Penalty", value: breakdown.turbidity_penalty, raw: breakdown.turbidity_index },
    { label: "Tide Penalty", value: breakdown.tide_penalty, raw: breakdown.tide_level, unit: 'm' },
  ].filter(item => item.value !== undefined && item.value !== 0);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(2, 6, 23, 0.85)', backdropFilter: 'blur(8px)',
        zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px'
      }}
    >
      <div 
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0f172a', border: '1px solid rgba(99, 102, 241, 0.4)',
          borderRadius: '16px', width: '100%', maxWidth: '450px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', overflow: 'hidden'
        }}
      >
        <div style={{ padding: '20px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: '#f1f5f9', fontSize: '1.25rem' }}>🧮 Score Calculation</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {items.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: item.isBase ? '#cbd5e1' : '#94a3b8', fontSize: '0.9rem' }}>
                  {item.label} {item.raw !== undefined && <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>({item.raw}{item.unit || ''})</span>}
                </span>
                <span style={{ 
                  color: item.isBase ? '#22c55e' : '#ef4444', 
                  fontWeight: '600',
                  fontFamily: 'monospace'
                }}>
                  {item.isBase ? `+${item.value}` : `-${item.value}`}
                </span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold', color: '#f1f5f9' }}>Final Score</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#6366f1' }}>
              {Math.max(1, Math.min(100, Math.round(100 - items.filter(i => !i.isBase).reduce((acc, i) => acc + i.value, 0))))}/100
            </span>
          </div>
        </div>
        <button 
          onClick={onClose}
          style={{
            width: '100%', padding: '14px', background: 'rgba(99, 102, 241, 0.1)',
            border: 'none', borderTop: '1px solid #1e293b', color: '#818cf8',
            fontWeight: '600', cursor: 'pointer'
          }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}

function ResultsPage() {
  const navigate = useNavigate();
  const [previewImage, setPreviewImage] = useState(null);
  const [calcBreakdown, setCalcBreakdown] = useState(null);
  
  // Load results from localStorage (set by App.jsx after search)
// ... (rest of the code update will be in the next chunk if needed, but I'll try to fit it)
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
      {/* Header Area with Map */}
      <div style={{ display: 'flex', gap: '24px', marginBottom: '24px', alignItems: 'center' }}>
        {jobInfo.aoi_geojson && (
          <MiniMap geojson={jobInfo.aoi_geojson} />
        )}
        
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
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
          </div>
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
                <th style={thStyle}>Calculation</th>
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
                    {result.thumbnail_url ? (
                      <div
                        onClick={() => setPreviewImage(result.thumbnail_url)}
                        title="View Enlarged Preview"
                        style={{
                          width: '72px',
                          height: '72px',
                          borderRadius: '8px',
                          backgroundImage: `url(${result.thumbnail_url})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          cursor: 'pointer',
                          border: '1px solid #334155',
                          flexShrink: 0,
                        }}
                      />
                    ) : (
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
                    )}
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
                  <td style={tdStyle}>
                    {result.score_breakdown ? (
                      <button
                        onClick={() => setCalcBreakdown(result.score_breakdown)}
                        style={{
                          background: 'rgba(99,102,241,0.1)',
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                          color: '#a5b4fc',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        🔍 Details
                      </button>
                    ) : (
                      <span style={{ color: '#475569', fontSize: '0.75rem' }}>N/A</span>
                    )}
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

      {/* Score Calculation Modal */}
      {calcBreakdown && (
        <ScoreCalculationModal
          breakdown={calcBreakdown}
          onClose={() => setCalcBreakdown(null)}
        />
      )}

      {/* Lightbox Overlay */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'zoom-out',
            padding: '40px',
            backdropFilter: 'blur(4px)',
          }}
        >
          {/* Close button (top right) */}
          <button
            onClick={() => setPreviewImage(null)}
            style={{
              position: 'absolute',
              top: '20px',
              right: '25px',
              background: 'none',
              border: 'none',
              color: '#cbd5e1',
              fontSize: '2.5rem',
              cursor: 'pointer',
              padding: '10px',
              lineHeight: 1,
            }}
          >
            ×
          </button>
          
          <img
            src={previewImage}
            alt="Enlarged TCI Preview"
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: '8px',
              border: '2px solid #334155',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              cursor: 'default',
            }}
            onClick={(e) => e.stopPropagation()}
          />
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
