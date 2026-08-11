import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Lazy load all components for better code splitting
const PaymentRequests = lazy(() => import('../components/PaymentRequests'));
const PaymentOrders = lazy(() => import('../components/PaymentOrders'));
const CashRequests = lazy(() => import('../components/CashRequests'));
const ServiceRequestsManagement = lazy(() => import('../components/service-requests/ServiceRequestsManagement'));
const ServiceRequestApproval = lazy(() => import('../components/service-requests/ServiceRequestApproval'));
const ReimbursementsManagement = lazy(() => import('../components/reimbursements/ReimbursementsManagement'));
const Settings = lazy(() => import('../components/settings/Settings'));
const Employees = lazy(() => import('../components/employees/Employees'));

const PurchaseOrders = lazy(() => import('../components/purchase-orders/PurchaseOrders'));
const PurchaseRequests = lazy(() => import('../components/purchase-requests/PurchaseRequests'));
const PendingPurchaseRequests = lazy(() => import('../components/purchase-requests/PendingPurchaseRequests'));
const Dashboard = lazy(() => import('../components/Dashboard'));
const Items = lazy(() => import('../components/items/Items'));
const Approvals = lazy(() => import('../components/approvals/Approvals'));
const DisbursementVouchers = lazy(() => import('../components/disbursement-vouchers/DisbursementVouchers'));
const PricingHistory = lazy(() => import('../components/pricing/PricingHistory'));
const OrderNumbers = lazy(() => import('../components/order-numbers/OrderNumbers'));
const Suppliers = lazy(() => import('../components/suppliers/Suppliers'));

// Simple placeholder components for missing ones
const Placeholder = ({ title }) => (
  <div className="p-8">
    <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
    <p className="text-gray-500 mt-2">This page is coming soon.</p>
  </div>
);

// Loading fallback
const PageLoading = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
  </div>
);

const AppRoutes = () => {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        {/* Dashboard */}
        <Route path="/" element={<Dashboard />} />
        
        {/* Purchase Requests (first stage - employee view) */}
        <Route path="purchase-requests" element={<PurchaseRequests />} />
        
        {/* Service Requests */}
        <Route path="service-requests" element={<ServiceRequestsManagement />} />
        <Route path="pending-srs" element={<ServiceRequestApproval />} />
        
        {/* Purchase Orders */}
        <Route path="purchase-orders" element={<PurchaseOrders />} />
        
        {/* Approvals */}
        <Route path="approvals" element={<Approvals />} />
        
        {/* Payment Requests */}
        <Route path="payment-requests" element={<PaymentRequests />} />
        
        {/* Payment Orders */}
        <Route path="payment-orders" element={<PaymentOrders />} />
        
        {/* Disbursement Vouchers */}
        <Route path="disbursement-vouchers" element={<DisbursementVouchers />} />
        
        {/* Order Numbers */}
        <Route path="order-numbers" element={<OrderNumbers />} />
        
        {/* Pending PRs */}
        <Route path="pending-prs" element={<PendingPurchaseRequests />} />
        
        {/* Items */}
        <Route path="items" element={<Items />} />
        <Route path="pricing-history" element={<PricingHistory />} />
        
        {/* Suppliers */}
        <Route path="suppliers" element={<Suppliers />} />
        
        {/* Cash Requests */}
        <Route path="cash-requests" element={<CashRequests />} />
        
        {/* Reimbursements */}
        <Route path="reimbursements" element={<ReimbursementsManagement />} />
        
        {/* Settings */}
        <Route path="settings" element={<Settings />} />

        {/* Employees */}
        <Route path="employees" element={<Employees />} />
        
        {/* Attendance - placeholder */}
        <Route path="attendance" element={<Placeholder title="Attendance" />} />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
