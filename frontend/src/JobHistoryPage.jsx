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
  const [isBooting, setIsBooting] = useState(false);
  const [jobLogs, setJobLogs] = useState(null);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isLogsLoading, setIsLogsLoading] = useState(false);

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
  const token = localStorage.getItem('coastal_token');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    const fetchJobs = async () => {
      const bootTimeout = setTimeout(() => setIsBooting(true), 3000);
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
        clearTimeout(bootTimeout);
        setIsBooting(false);
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
        aoi_geojson: data.aoi_geojson
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

  const handleDeleteJob = async (e, jobId) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to permanently delete this job from your history?")) return;
    
    try {
      const res = await fetch(`${apiUrl}/jobs/${jobId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to delete job");
      
      setJobs(jobs.filter(j => j.id !== jobId));
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleViewLogs = async (jobId) => {
    setIsLogsLoading(true);
    setIsLogModalOpen(true);
    setJobLogs(null);
    try {
      const res = await fetch(`${apiUrl}/jobs/${jobId}/logs`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      setJobLogs(data.logs);
    } catch (err) {
      console.error("Failed to fetch logs", err);
      setJobLogs("Failed to load logs.");
    } finally {
      setIsLogsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      color: '#e2e8f0',
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      padding: isBooting ? '68px 24px 24px 24px' : '24px',
      position: 'relative'
    }}>
      {/* Booting Banner */}
      {isBooting && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(90deg, #f59e0b, #d97706)',
          color: 'white',
          textAlign: 'center',
          padding: '12px',
          fontWeight: '600',
          fontSize: '0.9rem',
          zIndex: 9999,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
        }}>
          ⏳ The backend server is waking up from hibernation. This can take up to 50 seconds...
        </div>
      )}
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
              <div style={{ padding: '14px', position: 'relative' }}>
                <button 
                  onClick={(e) => handleDeleteJob(e, job.id)}
                  title="Delete Job"
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    cursor: 'pointer',
                    fontSize: '1.1rem',
                    opacity: 0.6,
                    padding: '4px',
                    transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = 1}
                  onMouseLeave={e => e.currentTarget.style.opacity = 0.6}
                >
                  🗑️
                </button>
              
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', paddingRight: '28px' }}>
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
                
                <button
                  onClick={() => handleViewLogs(job.id)}
                  style={{
                    marginTop: '10px',
                    width: '100%',
                    background: 'rgba(99, 102, 241, 0.1)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    borderRadius: '6px',
                    color: '#a5b4fc',
                    cursor: 'pointer',
                    padding: '6px',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                  }}
                >
                  📋 View Diagnostics
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Log Modal */}
      {isLogModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(2, 6, 23, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '800px',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(99, 102, 241, 0.2)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, color: '#e2e8f0', fontSize: '1.1rem' }}>Past Search Diagnostic Logs</h3>
              <button 
                onClick={() => setIsLogModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{
              padding: '20px',
              overflowY: 'auto',
              flex: 1,
              background: '#020617',
              margin: '0 20px 20px 20px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              {isLogsLoading ? (
                <div style={{ color: '#6366f1', textAlign: 'center', padding: '40px' }}>
                  ⏳ Loading legacy logs...
                </div>
              ) : (
                <pre style={{
                  margin: 0,
                  color: '#10b981',
                  fontFamily: '"Fira Code", monospace',
                  fontSize: '0.85rem',
                  lineHeight: '1.5',
                  whiteSpace: 'pre-wrap'
                }}>
                  {jobLogs || "No logs available for this past job."}
                </pre>
              )}
            </div>
            
            <div style={{
              padding: '16px 20px',
              borderTop: '1px solid rgba(99, 102, 241, 0.2)',
              textAlign: 'right'
            }}>
              <button 
                onClick={() => setIsLogModalOpen(false)}
                style={{
                  background: '#1e293b',
                  color: '#e2e8f0',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default JobHistoryPage;
