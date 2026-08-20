import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from '../i18n/LanguageContext';

const STATUS_STYLES = {
  pending: 'bg-yellow-100 text-yellow-700',
  verified: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  resolved: 'bg-blue-100 text-blue-700',
};

const RISK_STYLES = (score) => {
  if (score >= 80) return 'bg-red-100 text-red-700';
  if (score >= 60) return 'bg-orange-100 text-orange-700';
  if (score >= 40) return 'bg-yellow-100 text-yellow-700';
  return 'bg-green-100 text-green-700';
};

export default function ReportsList() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', disease: '' });

  useEffect(() => {
    const params = {};
    if (filter.status) params.status = filter.status;
    if (filter.disease) params.disease_type = filter.disease;

    api.get('/reports', { params })
      .then(({ data }) => setReports(data))
      .finally(() => setLoading(false));
  }, [filter]);

  const updateFilter = (updates) => {
    setLoading(true);
    setFilter((current) => ({ ...current, ...updates }));
  };

  const handleVerify = async (id, status) => {
    try {
      await api.put(`/reports/${id}/status`, { status });
      setReports((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
    } catch (err) {
      alert(err.response?.data?.detail || t('reports.failedUpdate'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('reports.title')}</h1>
          <p className="text-slate-500">{t('reports.subtitle')}</p>
        </div>
        <Link to="/reports/new" className="btn-primary self-start">{t('reports.newReport')}</Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={filter.status}
          onChange={(e) => updateFilter({ status: e.target.value })}
          className="input sm:w-40"
        >
          <option value="">{t('reports.allStatus')}</option>
          <option value="pending">{t('reports.pending')}</option>
          <option value="verified">{t('reports.verified')}</option>
          <option value="rejected">{t('reports.rejected')}</option>
        </select>
        <input
          type="text"
          value={filter.disease}
          onChange={(e) => updateFilter({ disease: e.target.value })}
          className="input sm:w-60"
          placeholder={t('reports.filterPlaceholder')}
        />
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">{t('reports.loading')}</div>
        ) : reports.length === 0 ? (
          <div className="p-12 text-center text-slate-400">{t('reports.noReports')}</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">{t('reports.disease')}</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">{t('reports.cases')}</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">{t('reports.risk')}</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">{t('reports.status')}</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">{t('reports.date')}</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-slate-600">{t('reports.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.map((report) => (
                <tr key={report.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-900">{report.disease_type}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{report.cases_count}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${RISK_STYLES(report.risk_score)}`}>
                      {report.risk_score}/100
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[report.status]}`}>
                      {report.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {new Date(report.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {report.status === 'pending' && ['asha_worker', 'block_officer', 'district_admin'].includes(user?.role) && (
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => handleVerify(report.id, 'verified')}
                          className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                        >
                          {t('reports.verify')}
                        </button>
                        <button
                          onClick={() => handleVerify(report.id, 'rejected')}
                          className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          {t('reports.reject')}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
