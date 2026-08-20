import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import api from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from '../i18n/LanguageContext';
import 'leaflet/dist/leaflet.css';

function getRiskColor(score) {
  if (score >= 80) return '#ef4444';
  if (score >= 60) return '#f97316';
  if (score >= 40) return '#eab308';
  if (score >= 20) return '#22c55e';
  return '#94a3b8';
}

export default function RiskMap() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [mapData, setMapData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/risk-map'),
      api.get('/dashboard/summary'),
    ]).then(([map, sum]) => {
      setMapData(map.data);
      setSummary(sum.data);
    }).catch(() => {
      setError(t('riskMap.loadError'));
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('riskMap.title')}</h1>
          <p className="text-slate-500">{t('riskMap.subtitle')}</p>
        </div>
        <span className="self-start rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">{user?.district || t('riskMap.yourDistrict')}</span>
      </div>

      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm">
        <span className="font-medium text-slate-600">{t('riskMap.riskLevel')}</span>
        {[
          { color: '#94a3b8', label: t('riskMap.low') },
          { color: '#22c55e', label: t('riskMap.normal') },
          { color: '#eab308', label: t('riskMap.elevated') },
          { color: '#f97316', label: t('riskMap.high') },
          { color: '#ef4444', label: t('riskMap.critical') },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-slate-500">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Map */}
      <div className="card overflow-hidden h-[400px] sm:h-[500px]">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-400">{t('riskMap.loading')}</div>
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
                      <p><strong>{t('riskMap.casesLabel')}</strong> {point.cases_count}</p>
                      <p><strong>{t('riskMap.riskScore')}</strong> {point.risk_score}/100</p>
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
            <p className="text-sm text-slate-500">{t('riskMap.weeklyCases')}</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{summary.active_alerts}</p>
            <p className="text-sm text-slate-500">{t('riskMap.activeAlerts')}</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{summary.districts_affected}</p>
            <p className="text-sm text-slate-500">{t('riskMap.districtsAffected')}</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{summary.villages_monitored}</p>
            <p className="text-sm text-slate-500">{t('riskMap.villagesMonitored')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
