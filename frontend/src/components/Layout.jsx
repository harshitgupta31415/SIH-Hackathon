import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../utils/api';
import { useTranslation } from '../i18n/LanguageContext';
import LanguageSelector from './LanguageSelector';

const navItems = [
  { to: '/', icon: '📊', label: 'nav.dashboard' },
  { to: '/reports', icon: '📋', label: 'nav.reports' },
  { to: '/reports/new', icon: '➕', label: 'nav.newReport', roles: ['volunteer', 'asha_worker'] },
  { to: '/water-quality', icon: '💧', label: 'nav.waterQuality', roles: ['asha_worker', 'block_officer', 'district_admin'] },
  { to: '/alerts', icon: '🔔', label: 'nav.alerts' },
  { to: '/risk-map', icon: '🗺️', label: 'nav.riskMap' },
  { to: '/upgrade-requests', icon: '👤', label: 'nav.upgradeRequests', roles: ['block_officer', 'district_admin'] },
];

navItems.splice(navItems.length - 1, 0, {
  to: '/intelligence', icon: 'AI', label: 'Outbreak Intelligence', roles: ['block_officer', 'district_admin'],
});

const ROLE_LABELS = {
  volunteer: 'role.volunteer',
  asha_worker: 'role.ashaWorker',
  block_officer: 'role.blockOfficer',
  district_admin: 'role.districtAdmin',
};

const ROLE_OPTIONS = {
  volunteer: ['asha_worker'],
  asha_worker: ['block_officer'],
  block_officer: [],
  district_admin: [],
};

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [myRequest, setMyRequest] = useState(null);
  const [upgradeForm, setUpgradeForm] = useState({ requested_role: '', justification: '' });
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeError, setUpgradeError] = useState('');
  const [upgradeSuccess, setUpgradeSuccess] = useState('');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (showUpgradeModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showUpgradeModal]);

  useEffect(() => {
    if (!user) return;
    api.get('/auth/my-upgrade-request')
      .then(({ data }) => setMyRequest(data))
      .catch(() => {});
  }, [user]);

  const openUpgradeModal = () => {
    setUpgradeForm({ requested_role: ROLE_OPTIONS[user?.role]?.[0] || '', justification: '' });
    setUpgradeError('');
    setUpgradeSuccess('');
    setShowUpgradeModal(true);
  };

  const submitUpgrade = async (e) => {
    e.preventDefault();
    setUpgradeLoading(true);
    setUpgradeError('');
    setUpgradeSuccess('');
    try {
      const { data } = await api.post('/auth/request-upgrade', upgradeForm);
      setMyRequest(data);
      setUpgradeSuccess(t('upgrade.submitted'));
      setTimeout(() => setShowUpgradeModal(false), 1500);
    } catch (err) {
      setUpgradeError(err.response?.data?.detail || t('upgrade.failed'));
    } finally {
      setUpgradeLoading(false);
    }
  };

  const canUpgrade = ROLE_OPTIONS[user?.role]?.length > 0;
  const hasPending = myRequest?.status === 'pending';

  const SidebarContent = () => (
    <>
      <div className="p-4 border-b border-slate-700">
        <h1 className="text-lg font-bold">🏥 HealthWatch NE</h1>
        <p className="text-xs text-slate-400 mt-1">{t('app.subtitle')}</p>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.filter((item) => !item.roles || item.roles.includes(user?.role)).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <span className="text-lg">{item.icon}</span>
            {t(item.label)}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold shrink-0">
            {user?.name?.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-slate-400 capitalize">{t(ROLE_LABELS[user?.role])}</p>
          </div>
        </div>

        <LanguageSelector />

        {canUpgrade && !hasPending && (
          <button
            onClick={openUpgradeModal}
            className="w-full px-3 py-2 text-sm text-blue-400 hover:bg-slate-800 rounded-md transition-colors mb-1"
          >
            ⬆ {t('auth.requestUpgrade')}
          </button>
        )}
        {hasPending && (
          <p className="text-xs text-amber-400 px-3 mb-1">⬆ {t('auth.upgradePending')}</p>
        )}

        <button
          onClick={handleLogout}
          className="w-full px-3 py-2 text-sm text-red-400 hover:bg-slate-800 rounded-md transition-colors"
        >
          {t('auth.logout')}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 bg-slate-900 text-white flex-col shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile overlay sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 transition-opacity"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 bg-slate-900 text-white flex flex-col transform transition-transform duration-200 ease-out">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-slate-900 text-white shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-md hover:bg-slate-700 transition-colors"
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-base font-bold">🏥 HealthWatch NE</h1>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">
              {user?.name?.charAt(0)}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-6">
            <Outlet />
          </div>
        </main>
      </div>

      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-1">{t('upgrade.title')}</h3>
            <p className="text-sm text-slate-500 mb-4">
              {t('upgrade.currentRole')} <span className="font-medium text-slate-700">{t(ROLE_LABELS[user?.role])}</span>
            </p>

            {upgradeError && (
              <div className="bg-red-50 text-red-700 p-3 rounded text-sm mb-3">{upgradeError}</div>
            )}
            {upgradeSuccess && (
              <div className="bg-green-50 text-green-700 p-3 rounded text-sm mb-3">{upgradeSuccess}</div>
            )}

            <form onSubmit={submitUpgrade} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('upgrade.requestRole')}</label>
                <select
                  value={upgradeForm.requested_role}
                  onChange={(e) => setUpgradeForm({ ...upgradeForm, requested_role: e.target.value })}
                  className="input"
                  required
                >
                  {(ROLE_OPTIONS[user?.role] || []).map((r) => (
                    <option key={r} value={r}>{t(ROLE_LABELS[r])}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('upgrade.justification')}</label>
                <textarea
                  value={upgradeForm.justification}
                  onChange={(e) => setUpgradeForm({ ...upgradeForm, justification: e.target.value })}
                  className="input"
                  rows={3}
                  placeholder={t('upgrade.justificationPlaceholder')}
                  required
                  minLength={10}
                  maxLength={500}
                />
                <p className="text-xs text-slate-400 mt-1">{upgradeForm.justification.length}/500</p>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowUpgradeModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-md"
                >
                  {t('upgrade.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={upgradeLoading}
                  className="btn-primary"
                >
                  {upgradeLoading ? t('upgrade.submitting') : t('upgrade.submitRequest')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
