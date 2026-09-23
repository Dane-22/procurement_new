import {
  LayoutDashboard,
  FileText,
  ClipboardCheck,
  Package,
  DollarSign,
  Receipt,
  ShoppingCart,
  History,
  Plus,
  Settings,
  UserCheck,
  CheckCircle,
  Gavel,
  Users,
  Truck,
  Activity
} from 'lucide-react';

// Navigation configuration - centralized for easy management
export const navigationItems = [
  // Dashboard
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    roles: ['engineer', 'procurement', 'admin', 'senior_project_manager', 'ceo', 'super_admin']
  },
  
  // Purchase Requests
  {
    path: '/dashboard/purchase-requests',
    label: 'Purchase Requests',
    icon: FileText,
    roles: ['engineer', 'procurement', 'admin', 'senior_project_manager', 'ceo', 'super_admin']
  },
  
  // For Reviews
  {
    path: '/dashboard/purchase-requests?tab=reviews',
    label: 'For Reviews',
    icon: CheckCircle,
    roles: ['engineer', 'procurement', 'admin', 'senior_project_manager']
  },

  // For Admin Processing
  {
    path: '/dashboard/purchase-requests?tab=admin_processing',
    label: 'For Admin Processing',
    icon: FileText,
    roles: ['admin', 'senior_project_manager', 'ceo', 'super_admin']
  },

  // Service Requests - TEMPORARILY COMMENTED OUT
  // {
  //   path: '/dashboard/service-requests',
  //   label: 'Service Requests',
  //   icon: ClipboardCheck,
  //   roles: ['engineer', 'procurement', 'admin', 'ceo', 'super_admin']
  // },

  // Approvals - for super admin
  {
    path: '/dashboard/approvals',
    label: 'Approvals',
    icon: Gavel,
    roles: ['ceo', 'super_admin']
  },
  
  // Items
  {
    path: '/dashboard/items',
    label: 'Items',
    icon: Package,
    roles: ['engineer', 'procurement', 'admin', 'senior_project_manager', 'ceo', 'super_admin']
  },

  // Pricing History - TEMPORARILY COMMENTED OUT
  // {
  //   path: '/dashboard/pricing-history',
  //   label: 'Pricing History',
  //   icon: History,
  //   roles: ['procurement', 'admin', 'ceo', 'super_admin']
  // },

  // Suppliers
  {
    path: '/dashboard/suppliers',
    label: 'Suppliers',
    icon: Truck,
    roles: ['admin', 'ceo', 'super_admin']
  },
  
  // Purchase Orders
  {
    path: '/dashboard/purchase-orders',
    label: 'Purchase Orders',
    icon: ShoppingCart,
    roles: ['admin', 'ceo', 'super_admin', 'senior_project_manager']
  },

  // Payment Requests - TEMPORARILY COMMENTED OUT
  // {
  //   path: '/dashboard/payment-requests',
  //   label: 'Payment Requests',
  //   icon: Receipt,
  //   roles: ['admin', 'ceo', 'super_admin']
  // },

  // Payment Orders - TEMPORARILY COMMENTED OUT
  // {
  //   path: '/dashboard/payment-orders',
  //   label: 'Payment Orders',
  //   icon: DollarSign,
  //   roles: ['admin', 'ceo', 'super_admin']
  // },

  // Disbursement Vouchers - TEMPORARILY COMMENTED OUT
  // {
  //   path: '/dashboard/disbursement-vouchers',
  //   label: 'Disbursement Vouchers',
  //   icon: FileText,
  //   roles: ['admin', 'ceo', 'super_admin']
  // },

  // Order Numbers - TEMPORARILY COMMENTED OUT
  // {
  //   path: '/dashboard/order-numbers',
  //   label: 'Order Numbers',
  //   icon: Receipt,
  //   roles: ['engineer', 'procurement', 'admin', 'ceo', 'super_admin']
  // },

  // Cash Requests - TEMPORARILY COMMENTED OUT
  // {
  //   path: '/dashboard/cash-requests',
  //   label: 'Cash Requests',
  //   icon: DollarSign,
  //   roles: ['engineer', 'procurement', 'admin', 'ceo', 'super_admin']
  // },

  // Reimbursements - TEMPORARILY COMMENTED OUT
  // {
  //   path: '/dashboard/reimbursements',
  //   label: 'Reimbursements',
  //   icon: Receipt,
  //   roles: ['engineer', 'procurement', 'admin', 'ceo', 'super_admin']
  // },

  // Settings
  {
    path: '/dashboard/employees',
    label: 'Employees',
    icon: Users,
    roles: ['ceo', 'super_admin']
  },

  // Audit Logs
  {
    path: '/dashboard/audit-logs',
    label: 'Audit Logs',
    icon: Activity,
    roles: ['ceo', 'super_admin']
  },
  
  // Settings
  {
    path: '/dashboard/settings',
    label: 'Settings',
    icon: Settings,
    roles: ['engineer', 'procurement', 'admin', 'senior_project_manager', 'ceo', 'super_admin']
  },

  // Attendance - TEMPORARILY COMMENTED OUT
  // {
  //   path: '/dashboard/attendance',
  //   label: 'Attendance',
  //   icon: UserCheck,
  //   roles: ['engineer', 'procurement', 'admin', 'ceo', 'super_admin'],
  //   externalUrl: 'https://attendacev2.xandree.com/'
  // }
];

// Group navigation items by category
export const navigationGroups = [
  {
    title: null,
    items: ['/dashboard', '/dashboard/purchase-requests', '/dashboard/purchase-requests?tab=reviews', '/dashboard/purchase-requests?tab=admin_processing'] // service-requests temporarily commented out
  },
  {
    title: 'Orders & Vouchers',
    items: ['/dashboard/purchase-orders'] // payment-requests, payment-orders, disbursement-vouchers, order-numbers temporarily commented out
  },
  {
    title: 'Items',
    items: ['/dashboard/items', '/dashboard/suppliers'] // pricing-history temporarily commented out
  },
  {
    title: 'Finance',
    items: [] // cash-requests, reimbursements temporarily commented out
  },
  {
    title: 'Administration',
    items: ['/dashboard/approvals', '/dashboard/employees', '/dashboard/audit-logs', '/dashboard/settings'] // attendance temporarily commented out
  }
];

// Filter navigation items by user role
export const filterNavigationByRole = (items, userRole) => {
  return items.filter(item => {
    if (item.roles.includes('all')) return true;
    return item.roles.includes(userRole);
  });
};

// Get navigation item by path
export const getNavigationItemByPath = (path) => {
  if (!path) return undefined;

  const normalizedPath = path.startsWith('/dashboard') ? path : `/dashboard/${path}`.replace(/\/+/g, '/');
  return navigationItems.find(item => item.path === normalizedPath);
};
