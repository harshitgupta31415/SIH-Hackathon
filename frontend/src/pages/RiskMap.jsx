import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import api from '../utils/api';
import 'leaflet/dist/leaflet.css';

function getRiskColor(score) {
  if (score >= 80) return '#ef4444';
  if (score >= 60) return '#f97316';
  if (score >= 40) return '#eab308';
  if (score >= 20) return '#22c55e';
  return '#94a3b8';
}

function MapLegend() {
  const map = useMap();
  return null;
}

export default function RiskMap() {
  const [mapData, setMapData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [district, setDistrict] = useState('');
  const [summary, setSummary] = useState(null);

  const fetchMapData = () => {
    const params = {};
    if (district) params.district = district;

    Promise.all([
      api.get('/dashboard/risk-map', { params }),
      api.get('/dashboard/summary', { params }),
    ]).then(([map, sum]) => {
      setMapData(map.data);
      setSummary(sum.data);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMapData();
  }, [district]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Risk Map</h1>
          <p className="text-slate-500">Disease outbreak risk visualization</p>
        </div>
        <select
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          className="input w-48"
        >
          <option value="">All Districts</option>
          <option value="Kamrup">Kamrup</option>
          <option value="Nagaon">Nagaon</option>
          <option value="Sonitpur">Sonitpur</option>
          <option value="Dibrugarh">Dibrugarh</option>
          <option value="Jorhat">Jorhat</option>
        </select>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm">
        <span className="font-medium text-slate-600">Risk Level:</span>
        {[
          { color: '#94a3b8', label: 'Low (0-20)' },
          { color: '#22c55e', label: 'Normal (20-40)' },
          { color: '#eab308', label: 'Elevated (40-60)' },
          { color: '#f97316', label: 'High (60-80)' },
          { color: '#ef4444', label: 'Critical (80+)' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-slate-500">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Map */}
      <div className="card overflow-hidden" style={{ height: '500px' }}>
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-400">Loading map...</div>
        ) : (
          <MapContainer
            center={[26.2, 92.5]}
            zoom={7}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {mapData.map((point, idx) => (
              <CircleMarker
                key={idx}
                center={[point.latitude, point.longitude]}
                radius={Math.max(6, Math.min(20, point.cases_count * 2 + 6))}
                fillColor={getRiskColor(point.risk_score)}
                color={getRiskColor(point.risk_score)}
                weight={2}
                opacity={0.8}
                fillOpacity={0.6}
              >
                <Popup>
                  <div className="p-1">
                    <h4 className="font-semibold">{point.village_name}</h4>
                    <p className="text-sm text-slate-600">{point.district}</p>
                    <div className="mt-2 space-y-1 text-sm">
                      <p><strong>Cases:</strong> {point.cases_count}</p>
                      <p><strong>Risk Score:</strong> {point.risk_score}/100</p>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        )}
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{summary.total_reports_week}</p>
            <p className="text-sm text-slate-500">Weekly Cases</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{summary.active_alerts}</p>
            <p className="text-sm text-slate-500">Active Alerts</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{summary.districts_affected}</p>
            <p className="text-sm text-slate-500">Districts Affected</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{summary.villages_monitored}</p>
            <p className="text-sm text-slate-500">Villages Monitored</p>
          </div>
        </div>
      )}
    </div>
  );
}
