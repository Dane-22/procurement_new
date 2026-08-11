// Field scoping utility for API responses
// Limits returned data based on user roles

const scopes = {
  // Public fields visible to all authenticated users
  public: ['id', 'created_at', 'updated_at'],

  // Engineer scope
  engineer: {
    purchaseRequest: ['id', 'pr_number', 'purpose', 'remarks', 'status', 'total_amount', 'date_needed', 'project', 'project_address', 'order_number', 'supplier_id', 'supplier_address', 'payment_terms_code', 'payment_terms_note', 'payment_terms_set_by', 'payment_terms_set_at', 'rejection_reason', 'created_at', 'updated_at', 'requester_first_name', 'requester_last_name'],
    purchaseOrder: ['id', 'po_number', 'status', 'total_amount', 'expected_delivery_date', 'place_of_delivery', 'project', 'order_number', 'delivery_term', 'payment_term', 'created_at'],
    employee: ['id', 'employee_no', 'first_name', 'middle_initial', 'last_name', 'role', 'department', 'is_active'],
    disbursementVoucher: ['id', 'dv_number', 'status', 'amount', 'dv_date', 'project', 'order_number', 'pr_number', 'created_at'],
  },

  // Procurement scope
  procurement: {
    purchaseRequest: ['id', 'pr_number', 'purpose', 'remarks', 'status', 'total_amount', 'date_needed', 'project', 'project_address', 'order_number', 'supplier_id', 'supplier_address', 'payment_terms_code', 'payment_terms_note', 'payment_terms_set_by', 'payment_terms_set_at', 'created_at', 'updated_at', 'requester_first_name', 'requester_last_name', 'rejection_reason'],
    purchaseOrder: ['id', 'po_number', 'purchase_request_id', 'supplier_id', 'status', 'total_amount', 'expected_delivery_date', 'place_of_delivery', 'project', 'order_number', 'delivery_term', 'payment_term', 'notes', 'created_at', 'updated_at'],
    employee: ['id', 'employee_no', 'first_name', 'middle_initial', 'last_name', 'role', 'department', 'is_active', 'created_at'],
    disbursementVoucher: ['id', 'dv_number', 'purchase_order_id', 'purchase_request_id', 'supplier_id', 'status', 'amount', 'dv_date', 'particulars', 'project', 'order_number', 'pr_number', 'check_number', 'bank_name', 'payment_date', 'created_at', 'updated_at'],
  },

  // Admin scope (more complete)
  admin: {
    purchaseRequest: '*', // All fields
    purchaseOrder: '*',
    employee: '*',
    disbursementVoucher: '*',
  },

  // Super Admin scope (everything)
  super_admin: {
    purchaseRequest: '*',
    purchaseOrder: '*',
    employee: '*',
    disbursementVoucher: '*',
    supplier: '*',
    category: '*',
  },
};

/**
 * Filter object to only include allowed fields based on role
 * @param {Object} data - The data object to filter
 * @param {string} role - User role (engineer, procurement, admin, super_admin)
 * @param {string} resource - Resource type (purchaseRequest, purchaseOrder, employee, etc.)
 * @returns {Object} Filtered object
 */
export function filterByScope(data, role, resource) {
  if (!data || typeof data !== 'object') return data;

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => filterByScope(item, role, resource));
  }

  // Get allowed fields for role and resource
  const roleScopes = scopes[role] || scopes.engineer;
  const allowedFields = roleScopes[resource] || scopes.public;

  // If all fields allowed
  if (allowedFields === '*') return data;

  // Filter object
  const filtered = {};
  for (const field of allowedFields) {
    if (data.hasOwnProperty(field)) {
      filtered[field] = data[field];
    }
  }

  return filtered;
}

/**
 * Middleware to automatically scope response data
 * Usage: app.use(scopeResponse('purchaseRequest'))
 */
export function scopeResponse(resource) {
  return (req, res, next) => {
    const originalJson = res.json;
    const userRole = req.user?.role || 'engineer';

    res.json = function(data) {
      // Handle common response wrappers
      const key = Object.keys(data).find(k => 
        ['purchaseRequest', 'purchaseRequests', 'purchaseOrder', 'purchaseOrders', 
         'employee', 'employees', 'disbursementVoucher', 'disbursementVouchers'].includes(k)
      );

      if (key) {
        const resourceName = key.replace(/s$/, ''); // Remove trailing 's'
        const isArray = Array.isArray(data[key]);
        
        data[key] = filterByScope(data[key], userRole, resourceName);
      }

      return originalJson.call(this, data);
    };

    next();
  };
}

export default { filterByScope, scopeResponse, scopes };
