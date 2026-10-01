import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthLayout from './components/AuthLayout';
import Login from './components/Login';
import Signup from './components/Signup';
import MainLayout from './components/MainLayout';

// Import Views
import Dashboard from './components/Dashboard';
import OrganizationSetup from './components/OrganizationSetup';
import AssetDirectory from './components/AssetDirectory';
import AssetAllocation from './components/AssetAllocation';
import ResourceBooking from './components/ResourceBooking';
import MaintenanceManagement from './components/MaintenanceManagement';
import AssetAudit from './components/AssetAudit';
import ReportsAnalytics from './components/ReportsAnalytics';
import ActivityLogs from './components/ActivityLogs';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentAuthView, setCurrentAuthView] = useState('login');
  const [activeTab, setActiveTab] = useState('dashboard');

  if (loading) {
    return (
      <div className="flex h-screen bg-slate-900 text-slate-100 items-center justify-center flex-col gap-4 font-sans">
        <svg className="animate-spin text-emerald-500" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
        <span>Verifying secure session...</span>
      </div>
    );
  }

  // If not logged in, render the AuthLayout (Login / Signup)
  if (!user) {
    return (
      <AuthLayout>
        {currentAuthView === 'login' ? (
          <Login onNavigateToSignup={() => setCurrentAuthView('signup')} />
        ) : (
          <Signup onNavigateToLogin={() => setCurrentAuthView('login')} />
        )}
      </AuthLayout>
    );
  }

  // Render active view component
  const renderView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onTabChange={setActiveTab} />;
      case 'setup':
        return <OrganizationSetup />;
      case 'directory':
        return <AssetDirectory />;
      case 'allocation':
        return <AssetAllocation />;
      case 'booking':
        return <ResourceBooking />;
      case 'maintenance':
        return <MaintenanceManagement />;
      case 'audit':
        return <AssetAudit />;
      case 'reports':
        return <ReportsAnalytics />;
      case 'logs':
        return <ActivityLogs />;
      default:
        return <Dashboard onTabChange={setActiveTab} />;
    }
  };

  return (
    <MainLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderView()}
    </MainLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
