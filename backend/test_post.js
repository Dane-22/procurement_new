import jwt from 'jsonwebtoken';
import axios from 'axios';
const token = jwt.sign({ id: 12, role: 'admin' }, 'your-secret-key');
try {
  const res = await axios.post('http://127.0.0.1:5001/api/purchase-requests', {
    purpose: 'for cabinetry and fabircation',
    remarks: '',
    project: 'Pias - Sundara',
    date_needed: '2026-09-29',
    payment_basis: 'debt',
    total_amount: 0,
    is_item_request: true,
    items: [{ item_id: 1, quantity: 1, unit_price: 0 }]
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('SUCCESS:', res.data);
} catch (err) {
  console.error('ERROR:', err.response?.status, err.response?.data);
}
