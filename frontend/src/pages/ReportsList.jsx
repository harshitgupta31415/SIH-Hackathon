import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useAuthStore } from '../store/authStore';

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
      alert(err.response?.data?.detail || 'Failed to update');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Disease Reports</h1>
          <p className="text-slate-500">Community health reports</p>
        </div>
        <Link to="/reports/new" className="btn-primary">+ New Report</Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={filter.status}
          onChange={(e) => updateFilter({ status: e.target.value })}
          className="input w-40"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
        </select>
        <input
          type="text"
          value={filter.disease}
          onChange={(e) => updateFilter({ disease: e.target.value })}
          className="input w-60"
          placeholder="Filter by disease..."
        />
      </div>

      {/* Reports Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading...</div>
        ) : reports.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No reports found</div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Disease</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Cases</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Risk</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Status</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">Date</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-slate-600">Actions</th>
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
                          Verify
                        </button>
                        <button
                          onClick={() => handleVerify(report.id, 'rejected')}
                          className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
