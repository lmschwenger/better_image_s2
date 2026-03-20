import { useState, useRef, useEffect } from 'react'
import { MapContainer, TileLayer, FeatureGroup, useMap, ZoomControl } from 'react-leaflet'
import { useNavigate } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'
// Leaflet Draw has a known bug where it tries to read a global `type` variable during tooltip rendering.
// Injecting a blank window.type polyfill prevents the Uncaught ReferenceError on some environments.
window.type = '';
import 'leaflet-draw'

// Custom component to add drawing control natively
function DrawControl({ setAoi, featureGroupRef }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !featureGroupRef.current) return;

    const drawControl = new L.Control.Draw({
      position: 'topright',
      edit: {
        featureGroup: featureGroupRef.current,
      },
      draw: {
        polyline: false,
        circle: false,
        circlemarker: false,
        marker: false,
        polygon: true,
        rectangle: true,
      },
    });

    map.addControl(drawControl);

    const handleCreated = (e) => {
      // Clear any existing layers first to enforce a single geometry
      featureGroupRef.current.clearLayers();
      const layer = e.layer;
      featureGroupRef.current.addLayer(layer);
      setAoi(layer.toGeoJSON());
      console.log("AOI created natively:", layer.toGeoJSON());
    };

    const handleEdited = (e) => {
      e.layers.eachLayer((layer) => {
        setAoi(layer.toGeoJSON());
      });
    };

    const handleDeleted = () => {
      setAoi(null);
    };

    map.on(L.Draw.Event.CREATED, handleCreated);
    map.on(L.Draw.Event.EDITED, handleEdited);
    map.on(L.Draw.Event.DELETED, handleDeleted);

    return () => {
      map.removeControl(drawControl);
      map.off(L.Draw.Event.CREATED, handleCreated);
      map.off(L.Draw.Event.EDITED, handleEdited);
      map.off(L.Draw.Event.DELETED, handleDeleted);
    };
  }, [map, setAoi, featureGroupRef]);

  return null;
}

// Helper component to handle map synchronization (zoom/visibility)
function MapUpdater({ aoi, featureGroupRef }) {
  const map = useMap();

  useEffect(() => {
    if (!aoi || !featureGroupRef.current) return;

    // Check if the layer is already in the feature group (to avoid duplicates from drawing)
    const existingLayers = featureGroupRef.current.getLayers();
    const isAlreadyPresent = existingLayers.some(layer => {
      try {
        return JSON.stringify(layer.toGeoJSON().geometry) === JSON.stringify(aoi.geometry || aoi);
      } catch (e) { return false; }
    });

    if (!isAlreadyPresent) {
      // Clear and add the imported AOI
      featureGroupRef.current.clearLayers();
      const geojsonLayer = L.geoJSON(aoi);
      geojsonLayer.eachLayer(layer => {
        featureGroupRef.current.addLayer(layer);
      });

      // Zoom to the new AOI
      const bounds = geojsonLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [20, 20] });
      }
    }
  }, [aoi, map, featureGroupRef]);

  return null;
}

function App() {
  const [taskType, setTaskType] = useState('SDB');
  const [startDate, setStartDate] = useState('2023-01-01');
  const [endDate, setEndDate] = useState('2023-12-31');
  const [aoi, setAoi] = useState(null);
  const [jobInfo, setJobInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [isBooting, setIsBooting] = useState(false);
  const [jobLogs, setJobLogs] = useState(null);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isLogsLoading, setIsLogsLoading] = useState(false);

  const featureGroupRef = useRef();
  const navigate = useNavigate();

  // Load user session on mount
  useEffect(() => {
    // Check for tokens in the URL first (coming back from OAuth)
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    const urlUser = urlParams.get('user');

    if (urlToken && urlUser) {
      localStorage.setItem('coastal_token', urlToken);
      localStorage.setItem('coastal_user', urlUser);
      // Clean up the URL so the token isn't visible
      window.history.replaceState({}, document.title, window.location.pathname);

      try {
        setUser(JSON.parse(urlUser));
      } catch (e) {
        console.error("Failed to parse user from URL", e);
      }
    } else {
      const storedUser = localStorage.getItem('coastal_user');
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch (e) {
          localStorage.removeItem('coastal_user');
        }
      }
    }

    // Always fetch fresh user data to get accurate credits and daily drip
    const currentToken = localStorage.getItem('coastal_token');
    if (currentToken) {
        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
        const bootTimeout = setTimeout(() => setIsBooting(true), 3000);
        
        fetch(`${apiUrl}/me`, {
            headers: { "Authorization": `Bearer ${currentToken}` }
        })
        .then(res => res.json())
        .then(data => {
            clearTimeout(bootTimeout);
            setIsBooting(false);
            if (data.id) setUser(data);
        })
        .catch(err => {
            clearTimeout(bootTimeout);
            setIsBooting(false);
            console.error("Failed to fetch fresh user data", err);
        });
    }

    // Check if we came from Job History with a "Show on Map" request
    const preloadedAoi = localStorage.getItem('coastal_load_aoi');
    if (preloadedAoi) {
      try {
        const parsedAoi = JSON.parse(preloadedAoi);
        setAoi(parsedAoi);
        localStorage.removeItem('coastal_load_aoi');
        // The MapUpdater will handle zooming/drawing
      } catch (e) {
        console.error("Failed to load preloaded AOI", e);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('coastal_token');
    localStorage.removeItem('coastal_user');
    setUser(null);
    navigate('/login');
  };

  const handleDeleted = (e) => {
    setAoi(null);
  };

  const handleViewLogs = async (jobId) => {
    setIsLogsLoading(true);
    setIsLogModalOpen(true);
    setJobLogs(null);
    try {
      const token = localStorage.getItem('coastal_token');
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
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

  const handleQuery = async () => {
    if (!aoi) {
      alert("Please draw an AOI on the map first.");
      return;
    }

    setIsLoading(true);
    setJobInfo(null);

    const queryPayload = {
      task_type: taskType,
      start_date: startDate,
      end_date: endDate,
      geojson: aoi
    };

    try {
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
      const token = localStorage.getItem('coastal_token');

      const headers = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${apiUrl}/query`, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(queryPayload)
      });
      
      if (response.status === 401) {
          alert("You must be logged in to search imagery. Please log in first.");
          return;
      }
      
      if (response.status === 402) {
          alert("You've run out of credits! Wait until tomorrow or buy a pack now.");
          return;
      }

      if (!response.ok) throw new Error("API Request Failed");
      
      // Update credits locally after successful query
      if (token) {
          fetch(`${apiUrl}/me`, { headers })
          .then(res => res.json())
          .then(data => {
              if (data.id) setUser(data);
          }).catch(err => console.error("Failed to refresh user credits", err));
      }

      const data = await response.json();
      console.log("Results:", data);
      const scored = data.scored_images || [];

      if (scored.length === 0) {
          alert(data.metadata?.message || "No satellite imagery found for this area and date range. Your credit has been refunded.");
      }

      // Store results and job metadata for the results page
      localStorage.setItem('coastal_results', JSON.stringify(scored));
      localStorage.setItem('coastal_job', JSON.stringify({
        startDate,
        endDate,
        taskType,
        resultCount: scored.length,
        executedAt: new Date().toLocaleTimeString(),
        aoi_geojson: aoi
      }));

      setJobInfo({
        startDate,
        endDate,
        taskType,
        resultCount: scored.length,
        executedAt: new Date().toLocaleTimeString(),
      });
    } catch (err) {
      console.error(err);
      alert("Failed to query backend. Ensure FastAPI is running.");
    } finally {
      setIsLoading(false);
    }
  }

  // Handle GeoJSON File Upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target.result);

          // Normalize the GeoJSON before setting it
          let normalizedAoi = null;

          if (json.type === "FeatureCollection" && json.features && json.features.length > 0) {
            normalizedAoi = json.features[0]; // Take the first feature
          } else if (json.type === "Feature") {
            normalizedAoi = json;
          } else if (json.type === "Polygon" || json.type === "MultiPolygon") {
            // Wrap raw geometry in a Feature object
            normalizedAoi = {
              type: "Feature",
              properties: {},
              geometry: json
            };
          }

          if (normalizedAoi) {
            setAoi(normalizedAoi);
            // The MapUpdater component will pick up the change and handle the map sync
            alert("GeoJSON loaded successfully! The map has been zoomed to your AOI.");
          } else {
            alert("The GeoJSON file does not contain a valid recognizable geometry/feature.");
          }

        } catch (err) {
          alert("Invalid GeoJSON file.");
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="app-container">
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

      {/* Control Panel / Sidebar */}
      <div className="sidebar glass-panel" style={{ marginTop: isBooting ? '44px' : '0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem' }}>
              Better Image<span style={{ fontWeight: 800 }}>[S]2</span> 🛰️
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>Retrieve the best S2 imagery</p>
          </div>

          <div style={{ textAlign: 'right' }}>
            {user ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                <span style={{ fontSize: '0.75rem', color: '#6366f1', fontWeight: 'bold' }}>👤 {user.display_name}</span>
                {user.is_unlimited ? (
                  <span style={{ fontSize: '0.7rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                    🔋 Unlimited Access
                  </span>
                ) : (
                  user.free_credits !== undefined && (
                    <span style={{ fontSize: '0.7rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                      🔋 {user.free_credits}/5 Free {user.purchased_credits > 0 ? `(${user.purchased_credits} Premium)` : ''}
                    </span>
                  )
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => navigate('/history')} style={smallBtnStyle}>History</button>
                  <button onClick={handleLogout} style={smallBtnStyle}>Logout</button>
                </div>
              </div>
            ) : (
              <button onClick={() => navigate('/login')} style={loginBtnStyle}>Sign In</button>
            )}
          </div>
        </div>

        <div className="input-group">
          <label>Target Task</label>
          <select value={taskType} onChange={(e) => setTaskType(e.target.value)}>
            <option value="SDB">Satellite Derived Bathymetry (SDB)</option>
            <option value="Coastline">Coastline Extraction</option>
            <option value="General">General Monitoring</option>
          </select>
        </div>

        <div className="input-group">
          <label>Start Date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>

        <div className="input-group">
          <label>End Date</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>

        <div className="input-group">
          <label>Import AOI (.geojson)</label>
          <input type="file" accept=".geojson,application/json" onChange={handleFileUpload} />
        </div>

        <button onClick={handleQuery} disabled={isLoading} style={isLoading ? { opacity: 0.6 } : {}}>
          {isLoading ? (
            <span>⏳ Searching...</span>
          ) : (
            <span>🔍 Search Imagery</span>
          )}
        </button>

        {/* Job Window */}
        {jobInfo && (
          <div style={{
            marginTop: '16px',
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: '10px',
            padding: '14px',
          }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#a5b4fc', letterSpacing: '0.05em', textTransform: 'uppercase' }}>📋 Job Complete</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem', color: '#94a3b8' }}>
              <span>📅 Period: <strong style={{ color: '#e2e8f0' }}>{jobInfo.startDate} → {jobInfo.endDate}</strong></span>
              <span>🛰️ Task: <strong style={{ color: '#e2e8f0' }}>{jobInfo.taskType}</strong></span>
              <span>🔢 Results: <strong style={{ color: jobInfo.resultCount > 0 ? '#22c55e' : '#ef4444' }}>{jobInfo.resultCount} scenes found</strong></span>
              <span>⏱ Executed: <strong style={{ color: '#e2e8f0' }}>{jobInfo.executedAt}</strong></span>
            </div>
            {jobInfo.resultCount > 0 && (
              <button
                onClick={() => navigate('/results')}
                style={{
                  marginTop: '12px',
                  width: '100%',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  cursor: 'pointer',
                  padding: '10px',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  letterSpacing: '0.03em',
                }}
              >
                View Results →
              </button>
            )}
            <button
              onClick={() => handleViewLogs(jobInfo.id || jobInfo.job_id)}
              style={{
                marginTop: '8px',
                width: '100%',
                background: 'rgba(99, 102, 241, 0.15)',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                borderRadius: '8px',
                color: '#a5b4fc',
                cursor: 'pointer',
                padding: '8px',
                fontSize: '0.8rem',
                fontWeight: '600',
              }}
            >
              📋 View Diagnostic Logs
            </button>
          </div>
        )}
      </div>

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
              <h3 style={{ margin: 0, color: '#e2e8f0', fontSize: '1.1rem' }}>Search Diagnostic Logs</h3>
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
                  ⏳ Fetching logs from secure database...
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
                  {jobLogs || "No logs available for this job."}
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

      {/* Map Area */}
      <div className="map-container">
        <MapContainer center={[60.0, -20.0]} zoom={3} scrollWheelZoom={true} zoomControl={false}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <ZoomControl position="topright" />
          <FeatureGroup ref={featureGroupRef} />
          <DrawControl setAoi={setAoi} featureGroupRef={featureGroupRef} />
          <MapUpdater aoi={aoi} featureGroupRef={featureGroupRef} />
        </MapContainer>
      </div>
    </div>
  )
}

export default App

const smallBtnStyle = {
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid #334155',
  borderRadius: '6px',
  color: '#94a3b8',
  cursor: 'pointer',
  padding: '4px 10px',
  fontSize: '0.75rem',
  fontWeight: '600',
};

const loginBtnStyle = {
  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
  border: 'none',
  borderRadius: '8px',
  color: 'white',
  cursor: 'pointer',
  padding: '8px 16px',
  fontSize: '0.85rem',
  fontWeight: '600',
};
