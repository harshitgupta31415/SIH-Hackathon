import { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from '../i18n/LanguageContext';

const SEVERITY_CONFIG = {
  low: { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'badge-low', icon: 'ℹ️' },
  medium: { bg: 'bg-yellow-50', border: 'border-yellow-200', badge: 'badge-medium', icon: '⚠️' },
  high: { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'badge-high', icon: '🔶' },
  critical: { bg: 'bg-red-50', border: 'border-red-200', badge: 'badge-critical', icon: '🚨' },
};

export default function Alerts() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const params = {};
    if (filter === 'active') params.is_resolved = false;
    else if (filter === 'resolved') params.is_resolved = true;

    api.get('/alerts', { params })
      .then(({ data }) => { if (active) setAlerts(data); })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.detail || t('dashboard.loadError'));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filter, t]);

  const selectFilter = (nextFilter) => {
    setLoading(true);
    setError('');
    setFilter(nextFilter);
  };

  const handleResolve = async (id) => {
    try {
      await api.put(`/alerts/${id}/resolve`);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      alert(err.response?.data?.detail || t('alerts.failedResolve'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('alerts.title')}</h1>
          <p className="text-slate-500">{t('alerts.subtitle')}</p>
        </div>
      </div>

      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {['active', 'resolved', 'all'].map((f) => (
          <button
            key={f}
            onClick={() => selectFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f === 'active' ? t('alerts.active') : f === 'resolved' ? t('alerts.resolved') : t('alerts.all')}
          </button>
        ))}
      </div>

      {/* Alerts List */}
      {loading ? (
        <div className="card p-12 text-center text-slate-400">{t('reports.loading')}</div>
      ) : alerts.length === 0 ? (
        <div className="card p-12 text-center text-slate-400">{t('alerts.noAlerts')}</div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const config = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.low;
            return (
              <div
                key={alert.id}
                className={`card p-4 ${config.bg} border-l-4 ${config.border}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-lg">{config.icon}</span>
                      <h3 className="font-semibold text-slate-900">{alert.title}</h3>
                      <span className={config.badge}>{alert.severity}</span>
                    </div>
                    <p className="text-sm text-slate-600 mb-2">{alert.message}</p>
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-slate-500">
                      <span>📍 {alert.affected_area}</span>
                      <span>📅 {new Date(alert.created_at).toLocaleDateString()}</span>
                      {alert.predicted_cases && (
                        <span>📈 {t('alerts.predicted')} {alert.predicted_cases} {t('alerts.cases')}</span>
                      )}
                    </div>
                    {alert.recommended_action && (
                      <div className="mt-3 p-3 bg-white/60 rounded-lg">
                        <p className="text-sm font-medium text-slate-700">{t('alerts.recommendedAction')}</p>
                        <p className="text-sm text-slate-600">{alert.recommended_action}</p>
                      </div>
                    )}
                  </div>
                  {!alert.is_resolved && ['block_officer', 'district_admin'].includes(user?.role) && (
                    <button
                      onClick={() => handleResolve(alert.id)}
                      className="self-start sm:ml-4 px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap"
                    >
                      {t('alerts.markResolved')}
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
