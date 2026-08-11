import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  X
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { employeeService } from '../../services/employees';

const DEFAULT_FORM = {
  employee_no: '',
  first_name: '',
  middle_initial: '',
  last_name: '',
  role: 'engineer',
  department: '',
  is_active: true
};

const ROLE_OPTIONS = [
  { value: 'engineer', label: 'Engineer' },
  { value: 'procurement', label: 'Procurement' },
  { value: 'admin', label: 'Admin' },
  { value: 'super_admin', label: 'Super Admin' }
];

const roleBadgeClasses = {
  engineer: 'bg-yellow-100 text-yellow-800',
  procurement: 'bg-blue-100 text-blue-800',
  admin: 'bg-green-100 text-green-800',
  super_admin: 'bg-purple-100 text-purple-800'
};

const Button = ({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  disabled = false,
  className = ''
}) => {
  const styles = {
    primary: 'bg-yellow-500 text-white hover:bg-yellow-600 disabled:bg-yellow-300',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:bg-gray-100',
    outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:text-gray-400',
    danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300'
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

const Modal = ({ title, children, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  </div>
);

const FormField = ({
  label,
  name,
  value,
  onChange,
  required = false,
  disabled = false,
  placeholder = '',
  maxLength
}) => (
  <label className="block">
    <span className="mb-1 block text-sm font-medium text-gray-700">
      {label} {required && <span className="text-red-500">*</span>}
    </span>
    <input
      name={name}
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      maxLength={maxLength}
      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
    />
  </label>
);

const SelectField = ({ label, name, value, onChange, options, disabled = false }) => (
  <label className="block">
    <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
    <select
      name={name}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

const StatusBanner = ({ message, tone = 'success' }) => {
  const tones = {
    success: {
      wrapper: 'border-green-200 bg-green-50 text-green-700',
      icon: <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
    },
    error: {
      wrapper: 'border-red-200 bg-red-50 text-red-700',
      icon: <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
    }
  };

  const selectedTone = tones[tone] || tones.success;

  return (
    <div className={`flex items-start gap-2 rounded-md border px-4 py-3 text-sm ${selectedTone.wrapper}`}>
      {selectedTone.icon}
      <span>{message}</span>
    </div>
  );
};

const formatRoleLabel = (role) =>
  ROLE_OPTIONS.find((option) => option.value === role)?.label || role;

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const Employees = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [formData, setFormData] = useState(DEFAULT_FORM);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const fetchEmployees = async (nextPage = page, mode = 'load') => {
    if (mode === 'refresh') {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError('');

    try {
      const data = await employeeService.getAll({ page: nextPage, pageSize });
      setEmployees(data.employees || []);
      setPage(data.page || nextPage);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch employees');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEmployees(1);
  }, []);

  const filteredEmployees = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return employees;

    return employees.filter((employee) => {
      const fullName = `${employee.first_name || ''} ${employee.last_name || ''}`.toLowerCase();
      return (
        fullName.includes(query) ||
        String(employee.employee_no || '').toLowerCase().includes(query) ||
        String(employee.department || '').toLowerCase().includes(query) ||
        String(employee.role || '').toLowerCase().includes(query)
      );
    });
  }, [employees, searchTerm]);

  if (user?.role !== 'super_admin') {
    return <Navigate to="/dashboard" replace />;
  }

  const resetMessages = () => {
    setError('');
    setSuccess('');
  };

  const handleInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setFormData(DEFAULT_FORM);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setSelectedEmployee(null);
    setFormData(DEFAULT_FORM);
  };

  const openCreateModal = () => {
    resetMessages();
    setFormData(DEFAULT_FORM);
    setShowCreateModal(true);
  };

  const openEditModal = (employee) => {
    resetMessages();
    setSelectedEmployee(employee);
    setFormData({
      employee_no: employee.employee_no || '',
      first_name: employee.first_name || '',
      middle_initial: employee.middle_initial || '',
      last_name: employee.last_name || '',
      role: employee.role || 'engineer',
      department: employee.department || '',
      is_active: Boolean(employee.is_active)
    });
    setShowEditModal(true);
  };

  const validateForm = (mode) => {
    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      setError('First name and last name are required.');
      return false;
    }

    if (mode === 'create' && !formData.employee_no.trim()) {
      setError('Employee number is required.');
      return false;
    }

    if (formData.middle_initial && formData.middle_initial.length > 5) {
      setError('Middle initial must be 5 characters or fewer.');
      return false;
    }

    return true;
  };

  const handleCreateEmployee = async (event) => {
    event.preventDefault();
    resetMessages();

    if (!validateForm('create')) return;

    setSubmitting(true);
    try {
      await employeeService.create({
        employee_no: formData.employee_no.trim(),
        first_name: formData.first_name.trim(),
        middle_initial: formData.middle_initial.trim() || undefined,
        last_name: formData.last_name.trim(),
        role: formData.role,
        department: formData.department.trim() || undefined
      });

      closeCreateModal();
      await fetchEmployees(1, 'refresh');
      setSuccess('Employee created successfully. Default password: jajrconstruction');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create employee');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateEmployee = async (event) => {
    event.preventDefault();
    resetMessages();

    if (!validateForm('edit') || !selectedEmployee) return;

    setSubmitting(true);
    try {
      await employeeService.update(selectedEmployee.id, {
        first_name: formData.first_name.trim(),
        middle_initial: formData.middle_initial.trim(),
        last_name: formData.last_name.trim(),
        role: formData.role,
        department: formData.department.trim(),
        is_active: formData.is_active
      });

      closeEditModal();
      await fetchEmployees(page, 'refresh');
      setSuccess('Employee updated successfully.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update employee');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (employee) => {
    resetMessages();
    const confirmed = window.confirm(
      `Reset password for ${employee.first_name} ${employee.last_name}? This will set the password to "jajrconstruction".`
    );

    if (!confirmed) return;

    try {
      await employeeService.resetPassword(employee.id);
      setSuccess(`Password reset for ${employee.first_name} ${employee.last_name}. Default password: jajrconstruction`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password');
    }
  };

  const nextPage = () => {
    if (page < totalPages) {
      fetchEmployees(page + 1);
    }
  };

  const previousPage = () => {
    if (page > 1) {
      fetchEmployees(page - 1);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-yellow-100 p-3 text-yellow-700">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
              <p className="mt-1 text-sm text-gray-500">
                Super Admin account management for employee access and roles.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant="secondary" onClick={() => fetchEmployees(page, 'refresh')} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={openCreateModal}>
            <Plus className="h-4 w-4" />
            New Employee
          </Button>
        </div>
      </div>

      {success && <StatusBanner message={success} tone="success" />}
      {error && <StatusBanner message={error} tone="error" />}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2 text-blue-700">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Employees on this page</p>
              <p className="text-2xl font-semibold text-gray-900">{employees.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2 text-green-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active accounts on this page</p>
              <p className="text-2xl font-semibold text-gray-900">
                {employees.filter((employee) => employee.is_active).length}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2 text-purple-700">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total employees</p>
              <p className="text-2xl font-semibold text-gray-900">{total}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Employee Directory</h2>
            <p className="mt-1 text-sm text-gray-500">
              Search within the current page and manage account status, role, and password resets.
            </p>
          </div>

          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search employee, department, role, or ID"
              className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-3 text-sm text-gray-900 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-yellow-500 border-t-transparent" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Employee</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Employee No</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Role</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Department</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Created</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-5 py-12 text-center text-sm text-gray-500">
                        No employees found on this page.
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((employee) => (
                      <tr key={employee.id} className="hover:bg-gray-50">
                        <td className="px-5 py-4">
                          <div>
                            <p className="font-medium text-gray-900">
                              {employee.first_name} {employee.middle_initial ? `${employee.middle_initial}. ` : ''}{employee.last_name}
                            </p>
                            <p className="text-sm text-gray-500">ID #{employee.id}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-700">{employee.employee_no}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${roleBadgeClasses[employee.role] || 'bg-gray-100 text-gray-700'}`}>
                            {formatRoleLabel(employee.role)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-700">{employee.department || '-'}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${employee.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}>
                            {employee.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-700">{formatDate(employee.created_at)}</td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" className="px-3 py-2" onClick={() => openEditModal(employee)}>
                              <Pencil className="h-4 w-4" />
                              Edit
                            </Button>
                            <Button variant="secondary" className="px-3 py-2" onClick={() => handleResetPassword(employee)}>
                              <KeyRound className="h-4 w-4" />
                              Reset
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-gray-200 px-5 py-4 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
              <p>
                Page {page} of {totalPages} • {total} total employees
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={previousPage} disabled={page <= 1}>
                  Previous
                </Button>
                <Button variant="outline" onClick={nextPage} disabled={page >= totalPages}>
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {showCreateModal && (
        <Modal title="Create Employee" onClose={closeCreateModal}>
          <form className="space-y-4" onSubmit={handleCreateEmployee}>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                label="Employee Number"
                name="employee_no"
                value={formData.employee_no}
                onChange={handleInputChange}
                required
                placeholder="EMP-0001"
              />
              <SelectField
                label="Role"
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                options={ROLE_OPTIONS}
              />
              <FormField
                label="First Name"
                name="first_name"
                value={formData.first_name}
                onChange={handleInputChange}
                required
              />
              <FormField
                label="Middle Initial"
                name="middle_initial"
                value={formData.middle_initial}
                onChange={handleInputChange}
                placeholder="M"
                maxLength={5}
              />
              <FormField
                label="Last Name"
                name="last_name"
                value={formData.last_name}
                onChange={handleInputChange}
                required
              />
              <FormField
                label="Department"
                name="department"
                value={formData.department}
                onChange={handleInputChange}
                placeholder="Engineering"
              />
            </div>

            <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
              New employees are created with the default password <span className="font-semibold">jajrconstruction</span>.
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
              <Button variant="outline" onClick={closeCreateModal} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Employee'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {showEditModal && selectedEmployee && (
        <Modal title="Edit Employee" onClose={closeEditModal}>
          <form className="space-y-4" onSubmit={handleUpdateEmployee}>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                label="Employee Number"
                name="employee_no"
                value={formData.employee_no}
                onChange={handleInputChange}
                disabled
              />
              <SelectField
                label="Role"
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                options={ROLE_OPTIONS}
              />
              <FormField
                label="First Name"
                name="first_name"
                value={formData.first_name}
                onChange={handleInputChange}
                required
              />
              <FormField
                label="Middle Initial"
                name="middle_initial"
                value={formData.middle_initial}
                onChange={handleInputChange}
                maxLength={5}
              />
              <FormField
                label="Last Name"
                name="last_name"
                value={formData.last_name}
                onChange={handleInputChange}
                required
              />
              <FormField
                label="Department"
                name="department"
                value={formData.department}
                onChange={handleInputChange}
              />
            </div>

            <label className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3">
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleInputChange}
                className="h-4 w-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">Account is active</p>
                <p className="text-xs text-gray-500">Inactive users cannot log in until reactivated.</p>
              </div>
            </label>

            <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
              <Button variant="outline" onClick={closeEditModal} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default Employees;
