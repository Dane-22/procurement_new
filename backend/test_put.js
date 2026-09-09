import jwt from 'jsonwebtoken';
import axios from 'axios';
const token = jwt.sign({ id: 12, role: 'admin' }, 'your-secret-key');
try {
  const res = await axios.put('http://127.0.0.1:5001/api/purchase-requests/60', {
    purpose: 'test',
    date_needed: '2024-10-10',
    project: 'test',
    items: [{ item_id: 1, quantity: 1, unit_price: 0 }]
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('SUCCESS:', res.data);
} catch (err) {
  console.error('ERROR:', err.response?.status, err.response?.data);
}
