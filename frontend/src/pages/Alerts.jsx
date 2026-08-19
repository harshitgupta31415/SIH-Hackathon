import { useState, useEffect } from 'react';
import api from '../utils/api';

const SEVERITY_CONFIG = {
  low: { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'badge-low', icon: 'ℹ️' },
  medium: { bg: 'bg-yellow-50', border: 'border-yellow-200', badge: 'badge-medium', icon: '⚠️' },
  high: { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'badge-high', icon: '🔶' },
  critical: { bg: 'bg-red-50', border: 'border-red-200', badge: 'badge-critical', icon: '🚨' },
};

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');

  useEffect(() => {
    const params = {};
    if (filter === 'active') params.is_resolved = false;
    else if (filter === 'resolved') params.is_resolved = true;

    api.get('/alerts', { params })
      .then(({ data }) => setAlerts(data))
      .finally(() => setLoading(false));
  }, [filter]);

  const handleResolve = async (id) => {
    try {
      await api.put(`/alerts/${id}/resolve`);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to resolve');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Alerts</h1>
          <p className="text-slate-500">Disease outbreak alerts and notifications</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {['active', 'resolved', 'all'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Alerts List */}
      {loading ? (
        <div className="card p-12 text-center text-slate-400">Loading...</div>
      ) : alerts.length === 0 ? (
        <div className="card p-12 text-center text-slate-400">No alerts found</div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const config = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.low;
            return (
              <div
                key={alert.id}
                className={`card p-4 ${config.bg} border-l-4 ${config.border}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{config.icon}</span>
                      <h3 className="font-semibold text-slate-900">{alert.title}</h3>
                      <span className={config.badge}>{alert.severity}</span>
                    </div>
                    <p className="text-sm text-slate-600 mb-2">{alert.message}</p>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>📍 {alert.affected_area}</span>
                      <span>📅 {new Date(alert.created_at).toLocaleDateString()}</span>
                      {alert.predicted_cases && (
                        <span>📈 Predicted: {alert.predicted_cases} cases</span>
                      )}
                    </div>
                    {alert.recommended_action && (
                      <div className="mt-3 p-3 bg-white/60 rounded-lg">
                        <p className="text-sm font-medium text-slate-700">Recommended Action:</p>
                        <p className="text-sm text-slate-600">{alert.recommended_action}</p>
                      </div>
                    )}
                  </div>
                  {!alert.is_resolved && (
                    <button
                      onClick={() => handleResolve(alert.id)}
                      className="ml-4 px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap"
                    >
                      Mark Resolved
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
