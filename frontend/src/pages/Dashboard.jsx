import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../utils/api';
import { useTranslation } from '../i18n/LanguageContext';

export default function Dashboard() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/summary'),
      api.get('/alerts', { params: { is_resolved: false, limit: 5 } }),
    ]).then(([s, a]) => {
      setSummary(s.data);
      setAlerts(a.data);
    }).catch(() => setError('Unable to load dashboard data. Please refresh and try again.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-slate-500">{t('dashboard.loading')}</p></div>;

  const stats = [
    { label: t('dashboard.reportsToday'), value: summary?.total_reports_today || 0, color: 'bg-blue-500', icon: '📝' },
    { label: t('dashboard.weeklyCases'), value: summary?.total_reports_week || 0, color: 'bg-purple-500', icon: '📈' },
    { label: t('dashboard.activeAlerts'), value: summary?.active_alerts || 0, color: 'bg-red-500', icon: '🔔' },
    { label: t('dashboard.villagesMonitored'), value: summary?.villages_monitored || 0, color: 'bg-green-500', icon: '🏘️' },
  ];

  const severityColors = { low: 'badge-low', medium: 'badge-medium', high: 'badge-high', critical: 'badge-critical' };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('dashboard.title')}</h1>
          <p className="text-slate-500">{t('dashboard.subtitle')}</p>
        </div>
        <div className={`self-start px-3 py-1 rounded-full text-sm font-medium ${summary?.risk_level === 'HIGH' ? 'bg-red-100 text-red-700' : summary?.risk_level === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
          {t('dashboard.risk')}: {summary?.risk_level || 'LOW'}
        </div>
      </div>

      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="card p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${stat.color} flex items-center justify-center text-white text-lg`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                <p className="text-sm text-slate-500">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Diseases Chart */}
        <div className="card p-4 lg:col-span-2">
          <h3 className="font-semibold text-slate-900 mb-4">{t('dashboard.topDiseases')}</h3>
          {summary?.top_diseases?.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={summary.top_diseases}>
                <XAxis dataKey="disease" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="cases" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-slate-400 text-center py-12">{t('dashboard.noData')}</p>
          )}
        </div>

        {/* Active Alerts */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">{t('dashboard.activeAlerts')}</h3>
            <Link to="/alerts" className="text-sm text-blue-600 hover:underline">{t('dashboard.viewAll')}</Link>
          </div>
          <div className="space-y-3">
            {alerts.length > 0 ? alerts.map((alert) => (
              <div key={alert.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-start justify-between">
                  <p className="text-sm font-medium text-slate-900 line-clamp-1">{alert.title}</p>
                  <span className={severityColors[alert.severity]}>
                    {alert.severity}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{alert.affected_area}</p>
              </div>
            )) : (
              <p className="text-slate-400 text-center py-6 text-sm">{t('dashboard.noActiveAlerts')}</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-4">
        <h3 className="font-semibold text-slate-900 mb-4">{t('dashboard.quickActions')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link to="/reports/new" className="p-4 bg-blue-50 rounded-lg text-center hover:bg-blue-100 transition-colors">
            <span className="text-2xl">➕</span>
            <p className="text-sm font-medium text-blue-900 mt-2">{t('dashboard.newReport')}</p>
          </Link>
          <Link to="/risk-map" className="p-4 bg-purple-50 rounded-lg text-center hover:bg-purple-100 transition-colors">
            <span className="text-2xl">🗺️</span>
            <p className="text-sm font-medium text-purple-900 mt-2">{t('dashboard.riskMap')}</p>
          </Link>
          <Link to="/water-quality" className="p-4 bg-cyan-50 rounded-lg text-center hover:bg-cyan-100 transition-colors">
            <span className="text-2xl">💧</span>
            <p className="text-sm font-medium text-cyan-900 mt-2">{t('dashboard.waterTest')}</p>
          </Link>
          <Link to="/alerts" className="p-4 bg-red-50 rounded-lg text-center hover:bg-red-100 transition-colors">
            <span className="text-2xl">🔔</span>
            <p className="text-sm font-medium text-red-900 mt-2">{t('dashboard.viewAlerts')}</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
