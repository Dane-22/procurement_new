import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuth } from '../../contexts/AuthContext';
import { reimbursementService } from '../../services/reimbursements';
import LiveConnectionStatus from '../ui/LiveConnectionStatus';

const Layout = ({ user, notifications, setNotifications, onLogout, children }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const canReviewReimbursements = ['super_admin', 'ceo'].includes(user?.role);

  useEffect(() => {
    if (!canReviewReimbursements) return;

    const fetchPendingCount = async () => {
      try {
        const data = await reimbursementService.getPendingCount();
        setPendingCount(data.count);
      } catch (err) {
        console.error('Failed to fetch pending count:', err);
      }
    };

    fetchPendingCount();
    // Refresh every 30 seconds
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, [canReviewReimbursements]);

  useEffect(() => {
    const handleReimbursementsChanged = async () => {
      if (!canReviewReimbursements) return;
      try {
        const data = await reimbursementService.getPendingCount();
        setPendingCount(data.count);
      } catch (err) {
        console.error('Failed to refresh pending count after reimbursement change:', err);
      }
    };

    window.addEventListener('reimbursements:changed', handleReimbursementsChanged);
    return () => {
      window.removeEventListener('reimbursements:changed', handleReimbursementsChanged);
    };
  }, [canReviewReimbursements]);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - Desktop (always visible) */}
      <div className="hidden lg:block flex-shrink-0">
        <Sidebar user={user} onLogout={handleLogout} pendingCount={pendingCount} />
      </div>

      {/* Sidebar - Mobile (overlay) */}
      {isSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsSidebarOpen(false)}
          />
          {/* Sidebar */}
          <div className="absolute left-0 top-0 h-full">
            <Sidebar user={user} onLogout={onLogout} pendingCount={pendingCount} />
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header 
          user={user} 
          notifications={notifications}
          setNotifications={setNotifications}
          onToggleSidebar={toggleSidebar}
          isSidebarOpen={isSidebarOpen}
        />
        
        {/* Page content */}
        <LiveConnectionStatus />
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
