import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { navigationItems, filterNavigationByRole, navigationGroups } from '../../config/navigation';

const Sidebar = ({ user, onLogout, pendingCount }) => {
  const location = useLocation();
  // Filter navigation items based on user role
  const filteredNavItems = filterNavigationByRole(navigationItems, user?.role);

  // Create a map for quick lookup
  const navItemMap = new Map(filteredNavItems.map(item => [item.path, item]));

  // Get current path for comparison
  const currentPath = location.pathname + location.search;

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Logo / Brand */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">P</span>
          </div>
          <span className="font-bold text-xl text-gray-900">ProcureSys</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {navigationGroups.map((group, groupIndex) => {
          // Filter items in this group that the user can see
          const visibleItems = group.items
            .map(path => navItemMap.get(path))
            .filter(Boolean);
          
          if (visibleItems.length === 0) return null;

          return (
            <div key={groupIndex} className="mb-4">
              {group.title && (
                <h3 className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {group.title}
                </h3>
              )}
              <ul className="space-y-1">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isApprovals = item.path === '/dashboard/approvals';
                  const badgeCount = isApprovals ? pendingCount : item.badge;
                  
                  // Handle external URLs
                  if (item.externalUrl) {
                    return (
                      <li key={item.path}>
                        <a
                          href={item.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="
                            flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors
                            text-gray-600 hover:bg-gray-50 hover:text-gray-900
                          "
                        >
                          <Icon className="w-5 h-5 flex-shrink-0" />
                          <span className="flex-1">{item.label}</span>
                          {badgeCount > 0 && (
                            <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                              {badgeCount}
                            </span>
                          )}
                        </a>
                      </li>
                    );
                  }
                  
                  return (
                    <li key={item.path}>
                      <NavLink
                        to={item.path}
                        end={item.path === '/dashboard'}
                        className={({ isActive }) => {
                          // Custom active state check for purchase requests and reviews
                          const isPurchaseRequests = item.path === '/dashboard/purchase-requests';
                          const isForReviews = item.path === '/dashboard/purchase-requests?tab=reviews';

                          let customActive = isActive;
                          if (isPurchaseRequests || isForReviews) {
                            customActive = currentPath === item.path;
                          }

                          return `
                            flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors
                            ${customActive
                              ? 'bg-yellow-50 text-yellow-700 border-r-2 border-yellow-500'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }
                          `;
                        }}
                      >
                        <Icon className="w-5 h-5 flex-shrink-0" />
                        <span className="flex-1">{item.label}</span>
                        {badgeCount > 0 && (
                          <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                            {badgeCount}
                          </span>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* User Info & Logout */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
            <span className="text-sm font-medium text-gray-600">
              {user?.first_name?.charAt(0)}{user?.last_name?.charAt(0)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-xs text-gray-500 capitalize">
              {user?.role?.replace('_', ' ')}
            </p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
