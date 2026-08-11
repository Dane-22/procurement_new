import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuth } from '../../contexts/AuthContext';
import { reimbursementService } from '../../services/reimbursements';

const Layout = ({ user, notifications, setNotifications, onLogout, children }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const fetchPendingCount = async () => {
      console.log('Checking user for pending count fetch:', user);
      if (user?.role === 'super_admin') {
        try {
          console.log('Fetching pending count...');
          const data = await reimbursementService.getPendingCount();
          console.log('Pending count received:', data);
          setPendingCount(data.count);
        } catch (err) {
          console.error('Failed to fetch pending count:', err);
        }
      } else {
        console.log('Not super admin, skipping pending count fetch. Role:', user?.role);
      }
    };

    fetchPendingCount();
    // Refresh every 30 seconds
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const handleReimbursementsChanged = async () => {
      if (user?.role !== 'super_admin') return;
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
  }, [user]);

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
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
