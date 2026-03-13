import { useState, useRef, useEffect } from 'react'
import { MapContainer, TileLayer, FeatureGroup, useMap } from 'react-leaflet'
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
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const featureGroupRef = useRef();

  const handleDeleted = (e) => {
    setAoi(null);
  };

  const handleQuery = async () => {
    if (!aoi) {
      alert("Please draw an AOI on the map first.");
      return;
    }
    
    setIsLoading(true);
    setResults([]);
    
    const queryPayload = {
      task_type: taskType,
      start_date: startDate,
      end_date: endDate,
      geojson: aoi
    };
    
    try {
      // Use environment variable for API URL to support both local dev and production deployment
      const apiUrl = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";
      const response = await fetch(`${apiUrl}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(queryPayload)
      });
      
      if (!response.ok) throw new Error("API Request Failed");
      
      const data = await response.json();
      console.log("Results:", data);
      setResults(data.scored_images || []);
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
      {/* Control Panel / Sidebar */}
      <div className="sidebar glass-panel">
        <div>
          <h1>Coastal Sentinel 🛰️</h1>
          <p>Retrieve the best S2 imagery for your tasks</p>
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

        <button onClick={handleQuery} disabled={isLoading}>
          {isLoading ? "Searching..." : "Search Imagery"}
        </button>

        {/* Results Showcase */}
        {results.length > 0 && (
          <div className="results-container" style={{ marginTop: '20px', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1.1rem', color: '#f8fafc' }}>Top Results</h3>
            {results.map((result, idx) => (
              <div key={idx} className="result-card" style={{
                background: 'rgba(15, 23, 42, 0.8)', padding: '12px', borderRadius: '8px', 
                marginBottom: '10px', border: '1px solid #334155', cursor: 'pointer'
              }} onClick={() => window.open(result.thumbnail_url, '_blank')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', color: '#e2e8f0' }}>{result.scene_id}</span>
                  <span style={{ 
                    background: result.score > 80 ? '#22c55e' : '#f59e0b', 
                    color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' 
                  }}>
                    {result.score}/100
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span>🌊 FES2022 Tide: <strong>{result.tide_level}m</strong></span>
                  <span>☁️ Cloud Cover: {result.cloud_cover}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Map Area */}
      <div className="map-container">
        <MapContainer center={[60.0, -20.0]} zoom={3} scrollWheelZoom={true}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <FeatureGroup ref={featureGroupRef} />
          <DrawControl setAoi={setAoi} featureGroupRef={featureGroupRef} />
          <MapUpdater aoi={aoi} featureGroupRef={featureGroupRef} />
        </MapContainer>
      </div>
    </div>
  )
}

export default App
