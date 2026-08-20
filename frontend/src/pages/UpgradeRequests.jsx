import { useState, useEffect } from 'react';
import api from '../utils/api';

const ROLE_LABELS = {
  volunteer: 'Volunteer',
  asha_worker: 'ASHA Worker',
  block_officer: 'Block Officer',
  district_admin: 'District Admin',
};

const STATUS_CONFIG = {
  pending: { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700', icon: '⏳' },
  approved: { bg: 'bg-green-50', border: 'border-green-200', badge: 'bg-green-100 text-green-700', icon: '✅' },
  rejected: { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700', icon: '❌' },
};

export default function UpgradeRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [reviewing, setReviewing] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRequests = () => {
    setLoading(true);
    const params = {};
    if (filter !== 'all') params.status_filter = filter;
    api.get('/auth/upgrade-requests', { params })
      .then(({ data }) => setRequests(data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchRequests(); }, [filter]);

  const handleReview = async (id, status) => {
    setActionLoading(true);
    try {
      await api.put(`/auth/upgrade-requests/${id}`, {
        status,
        review_notes: reviewNotes || null,
      });
      setReviewing(null);
      setReviewNotes('');
      fetchRequests();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to review request');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Upgrade Requests</h1>
          <p className="text-slate-500">Review role upgrade requests from volunteers and workers</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {['pending', 'approved', 'rejected', 'all'].map((f) => (
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

      {/* Requests List */}
      {loading ? (
        <div className="card p-12 text-center text-slate-400">Loading...</div>
      ) : requests.length === 0 ? (
        <div className="card p-12 text-center text-slate-400">No upgrade requests found</div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const config = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
            const isReviewing = reviewing === req.id;
            return (
              <div
                key={req.id}
                className={`card p-4 ${config.bg} border-l-4 ${config.border}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{config.icon}</span>
                      <h3 className="font-semibold text-slate-900">{req.user_name || 'Unknown'}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.badge}`}>
                        {req.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mb-1">{req.user_email}</p>
                    <div className="flex items-center gap-3 text-sm text-slate-600 mb-2">
                      <span className="font-medium">{ROLE_LABELS[req.current_role]}</span>
                      <span>→</span>
                      <span className="font-medium text-blue-600">{ROLE_LABELS[req.requested_role]}</span>
                    </div>
                    <div className="p-3 bg-white/60 rounded-lg mb-2">
                      <p className="text-sm text-slate-700">{req.justification}</p>
                    </div>
                    <div className="text-xs text-slate-400">
                      Submitted {new Date(req.created_at).toLocaleString()}
                    </div>

                    {req.review_notes && (
                      <div className="mt-2 p-3 bg-white/60 rounded-lg">
                        <p className="text-xs font-medium text-slate-500 mb-1">Admin notes:</p>
                        <p className="text-sm text-slate-600">{req.review_notes}</p>
                      </div>
                    )}
                  </div>

                  {req.status === 'pending' && !isReviewing && (
                    <button
                      onClick={() => setReviewing(req.id)}
                      className="ml-4 px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap"
                    >
                      Review
                    </button>
                  )}
                </div>

                {/* Review Panel */}
                {isReviewing && (
                  <div className="mt-4 p-4 bg-white rounded-lg border border-slate-200">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Admin Notes (optional)</label>
                    <textarea
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      className="input mb-3"
                      rows={2}
                      placeholder="Add notes for the applicant..."
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => { setReviewing(null); setReviewNotes(''); }}
                        className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-md"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleReview(req.id, 'rejected')}
                        disabled={actionLoading}
                        className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleReview(req.id, 'approved')}
                        disabled={actionLoading}
                        className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                      >
                        Approve
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
