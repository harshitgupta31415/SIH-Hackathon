import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ReportForm from './pages/ReportForm';
import ReportsList from './pages/ReportsList';
import WaterQuality from './pages/WaterQuality';
import Alerts from './pages/Alerts';
import RiskMap from './pages/RiskMap';
import Layout from './components/Layout';

function ProtectedRoute({ children }) {
  const { token } = useAuthStore();
  if (!token) return <Navigate to="/login" />;
  return children;
}

export default function App() {
  const { fetchMe } = useAuthStore();

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="reports" element={<ReportsList />} />
          <Route path="reports/new" element={<ReportForm />} />
          <Route path="water-quality" element={<WaterQuality />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="risk-map" element={<RiskMap />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
