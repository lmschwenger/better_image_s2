import { useState, useEffect, useRef } from 'react';
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
        width: '100%',
        height: '140px',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid #334155',
      }}
    />
  );
}

function JobHistoryPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
  const token = localStorage.getItem('coastal_token');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    const fetchJobs = async () => {
      try {
        const res = await fetch(`${apiUrl}/jobs`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch jobs');
        const data = await res.json();
        setJobs(data);
      } catch (err) {
        setError('Failed to load job history.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchJobs();
  }, []);

  const handleLoadResults = async (jobId) => {
    try {
      const res = await fetch(`${apiUrl}/jobs/${jobId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load job');
      const data = await res.json();

      // Store into localStorage and navigate to results page
      localStorage.setItem('coastal_results', JSON.stringify(data.results));
      localStorage.setItem('coastal_job', JSON.stringify({
        startDate: data.start_date,
        endDate: data.end_date,
        taskType: data.task_type,
        resultCount: data.result_count,
        executedAt: data.created_at,
      }));
      navigate('/results');
    } catch (err) {
      alert('Failed to load job results.');
    }
  };

  const handleShowOnMap = (job) => {
    // Store the AOI so App.jsx can pick it up and display it
    localStorage.setItem('coastal_load_aoi', JSON.stringify(job.aoi_geojson));
    navigate('/');
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
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
          }}
        >
          ← Back to Map
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#f1f5f9' }}>📂 Job History</h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
            Your past imagery searches
          </p>
        </div>
      </div>

      {isLoading && (
        <div style={{ textAlign: 'center', padding: '60px', color: '#475569' }}>
          ⏳ Loading your jobs...
        </div>
      )}

      {error && (
        <div style={{ textAlign: 'center', padding: '60px', color: '#fca5a5' }}>{error}</div>
      )}

      {!isLoading && !error && jobs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px', color: '#475569' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🌊</div>
          <p>No jobs yet. Go search some satellite imagery!</p>
        </div>
      )}

      {!isLoading && jobs.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '20px',
        }}>
          {jobs.map((job) => (
            <div
              key={job.id}
              style={{
                background: 'rgba(30, 41, 59, 0.7)',
                border: '1px solid #334155',
                borderRadius: '12px',
                overflow: 'hidden',
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#6366f1'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#334155'}
            >
              {/* Mini Map */}
              <MiniMap geojson={job.aoi_geojson} />

              {/* Info */}
              <div style={{ padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{
                    background: 'rgba(99,102,241,0.15)',
                    color: '#a5b4fc',
                    padding: '3px 10px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                  }}>
                    {job.task_type}
                  </span>
                  <span style={{
                    color: job.result_count > 0 ? '#22c55e' : '#94a3b8',
                    fontSize: '0.82rem',
                    fontWeight: '600',
                  }}>
                    {job.result_count} scenes
                  </span>
                </div>

                <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '12px' }}>
                  <span>📅 {job.start_date} → {job.end_date}</span>
                  <span>⏱ {job.created_at ? new Date(job.created_at).toLocaleString() : '—'}</span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {job.result_count > 0 && (
                    <button
                      onClick={() => handleLoadResults(job.id)}
                      style={{
                        flex: 1,
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        border: 'none',
                        borderRadius: '6px',
                        color: 'white',
                        cursor: 'pointer',
                        padding: '8px',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                      }}
                    >
                      View Results
                    </button>
                  )}
                  <button
                    onClick={() => handleShowOnMap(job)}
                    style={{
                      flex: 1,
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid #475569',
                      borderRadius: '6px',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: '8px',
                      fontSize: '0.8rem',
                      fontWeight: '500',
                    }}
                  >
                    Show on Map
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default JobHistoryPage;
