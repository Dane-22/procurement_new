import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Search, CheckCircle } from 'lucide-react';
import { purchaseRequestService } from '../../services/purchaseRequests';
import { supplierService } from '../../services/suppliers';

const ProcessItemRequestModal = ({ isOpen, onClose, pr, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [customSupplier, setCustomSupplier] = useState('');
  const [paymentBasis, setPaymentBasis] = useState('non_debt');
  const [paymentTermsNote, setPaymentTermsNote] = useState('');
  const [items, setItems] = useState([]);
  
  // Payment Schedules (if debt)
  const [paymentSchedules, setPaymentSchedules] = useState([
    { payment_date: '', amount: '', note: '' }
  ]);

  useEffect(() => {
    if (isOpen && pr) {
      // Pre-fill state based on PR
      setItems(pr.items ? pr.items.map(item => ({
        ...item,
        unit_price: item.unit_price || 0
      })) : []);
      setSelectedSupplier(pr.supplier_id || '');
      setCustomSupplier('');
      setPaymentBasis(pr.payment_basis || 'non_debt');
      setPaymentTermsNote(pr.payment_terms_note || '');
      
      if (pr.payment_schedules && pr.payment_schedules.length > 0) {
        setPaymentSchedules(pr.payment_schedules);
      } else {
        setPaymentSchedules([{ payment_date: '', amount: '', note: '' }]);
      }
      
      // Fetch suppliers
      fetchSuppliers();
    }
  }, [isOpen, pr]);

  const fetchSuppliers = async () => {
    try {
      const data = await supplierService.getAll();
      setSuppliers(data?.suppliers || []);
    } catch (err) {
      console.error('Failed to fetch suppliers', err);
    }
  };

  const handleUpdateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handleAddSchedule = () => {
    setPaymentSchedules([...paymentSchedules, { payment_date: '', amount: '', note: '' }]);
  };

  const handleRemoveSchedule = (index) => {
    setPaymentSchedules(paymentSchedules.filter((_, i) => i !== index));
  };

  const handleUpdateSchedule = (index, field, value) => {
    const newSchedules = [...paymentSchedules];
    newSchedules[index][field] = value;
    setPaymentSchedules(newSchedules);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount || 0);
  };

  const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.quantity || 0) * parseFloat(item.unit_price || 0)), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSupplier) {
      alert('Please select a supplier');
      return;
    }
    
    if (selectedSupplier === 'other' && !customSupplier.trim()) {
      alert('Please enter the name of the new supplier');
      return;
    }
    
    // Validate unit prices
    if (items.some(item => !item.unit_price || parseFloat(item.unit_price) <= 0)) {
      alert('Please provide valid unit prices for all items');
      return;
    }

    try {
      setLoading(true);



      // Prepare data
      if (items.length === 0) {
        alert('At least one item is required');
        setLoading(false);
        return;
      }

      if (items.some(item => parseFloat(item.unit_price || 0) <= 0)) {
        alert('All items must have a unit price strictly greater than 0');
        setLoading(false);
        return;
      }

      if (selectedSupplier === 'other' && !customSupplier.trim()) {
        alert('Please enter a valid name for the custom supplier');
        setLoading(false);
        return;
      }

      const prData = {
        supplier_id: selectedSupplier === 'other' ? 'other' : selectedSupplier,
        supplier_name: selectedSupplier === 'other' ? customSupplier.trim() : null,
        payment_basis: paymentBasis,
        payment_terms_note: paymentTermsNote,
        items: items.map(i => ({
          id: i.id, // item id in pr_items table
          item_id: i.item_id,
          quantity: i.quantity,
          unit_price: i.unit_price
        }))
      };

      if (paymentBasis === 'debt') {
        const cleaned = paymentSchedules.filter(s => s.payment_date || s.amount || s.note).map(s => ({
          payment_date: s.payment_date,
          amount: s.amount ? parseFloat(s.amount) : null,
          note: s.note
        }));
        
        if (cleaned.length === 0) {
          alert('Please add at least one payment schedule for debt purchases');
          setLoading(false);
          return;
        }

        if (cleaned.some(s => !s.payment_date || !s.amount)) {
          alert('Please provide both date and amount for all payment schedules');
          setLoading(false);
          return;
        }

        const sum = cleaned.reduce((acc, curr) => acc + (curr.amount || 0), 0);
        const total = items.reduce((acc, curr) => acc + (parseFloat(curr.unit_price) || 0) * (parseInt(curr.quantity) || 0), 0);

        if (Math.abs(sum - total) > 0.01) {
          alert(`Payment schedules sum (${formatCurrency(sum)}) must exactly equal the total amount (${formatCurrency(total)})`);
          setLoading(false);
          return;
        }

        prData.payment_schedules = cleaned;
      }

      await purchaseRequestService.process(pr.id, prData);
      onSuccess();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to process request');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Process Item Request</h3>
            <p className="text-sm text-gray-500">Provide supplier and pricing details to formalize PR #{pr?.pr_number}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <form id="process-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Supplier Selection */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h4 className="font-medium text-gray-900 mb-4">Supplier Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Supplier *</label>
                  <select
                    value={selectedSupplier}
                    onChange={(e) => setSelectedSupplier(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-yellow-500 focus:border-yellow-500"
                    required
                  >
                    <option value="">Select a supplier...</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.supplier_name}</option>
                    ))}
                    <option value="other">Other...</option>
                  </select>
                  {selectedSupplier === 'other' && (
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">New Supplier Name *</label>
                      <input
                        type="text"
                        value={customSupplier}
                        onChange={(e) => setCustomSupplier(e.target.value)}
                        placeholder="Enter supplier name"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-yellow-500 focus:border-yellow-500"
                        required
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Items Pricing */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h4 className="font-medium text-gray-900 mb-4">Items & Pricing</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-48">Unit Price (PHP)</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {items.map((item, index) => (
                      <tr key={index}>
                        <td className="px-3 py-2 text-sm text-gray-900">
                          {item.item_name}
                          {item.description && <p className="text-xs text-gray-500">{item.description}</p>}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-900 text-right">{item.quantity}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 text-right">
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={item.unit_price}
                            onChange={(e) => handleUpdateItem(index, 'unit_price', e.target.value)}
                            className="w-full text-right px-2 py-1 border border-gray-300 rounded focus:ring-yellow-500 focus:border-yellow-500"
                            required
                          />
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-900 text-right font-medium">
                          {formatCurrency((parseFloat(item.quantity || 0) * parseFloat(item.unit_price || 0)))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan="3" className="px-3 py-3 text-sm font-medium text-gray-900 text-right">Total Amount:</td>
                      <td className="px-3 py-3 text-sm font-bold text-gray-900 text-right">{formatCurrency(totalAmount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Payment Terms */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h4 className="font-medium text-gray-900 mb-4">Payment Terms</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Basis *</label>
                  <select
                    value={paymentBasis}
                    onChange={(e) => setPaymentBasis(e.target.value)}
                    className="w-full md:w-1/2 px-3 py-2 border border-gray-300 rounded-md focus:ring-yellow-500 focus:border-yellow-500"
                  >
                    <option value="non_debt">Cash / Non-Debt</option>
                    <option value="debt">With Account / Debt</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms Note</label>
                  <textarea
                    value={paymentTermsNote}
                    onChange={(e) => setPaymentTermsNote(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-yellow-500 focus:border-yellow-500"
                    placeholder="E.g., 30 days upon delivery"
                  />
                </div>

                {paymentBasis === 'debt' && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center mb-2">
                      <h5 className="text-sm font-medium text-gray-700">Date Needed</h5>
                      <button
                        type="button"
                        onClick={handleAddSchedule}
                        className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                      >
                        <Plus className="w-4 h-4 mr-1" /> Add Schedule
                      </button>
                    </div>
                    {paymentSchedules.map((schedule, index) => (
                      <div key={index} className="flex flex-col sm:flex-row gap-2 mb-2 items-start sm:items-center">
                        <input
                          type="date"
                          value={schedule.payment_date}
                          onChange={(e) => handleUpdateSchedule(index, 'payment_date', e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-yellow-500 focus:border-yellow-500"
                          required
                        />
                        <input
                          type="number"
                          placeholder="Amount"
                          value={schedule.amount}
                          onChange={(e) => handleUpdateSchedule(index, 'amount', e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-yellow-500 focus:border-yellow-500"
                          min="0" step="0.01"
                        />
                        <input
                          type="text"
                          placeholder="Note (optional)"
                          value={schedule.note}
                          onChange={(e) => handleUpdateSchedule(index, 'note', e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-yellow-500 focus:border-yellow-500"
                        />
                        {paymentSchedules.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSchedule(index)}
                            className="p-2 text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
          </form>
        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="process-form"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Process to PR
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProcessItemRequestModal;
