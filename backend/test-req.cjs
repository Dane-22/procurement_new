const http = require('http');
const jwt = require('jsonwebtoken');

const token = jwt.sign({id: 7, role: 'admin'}, process.env.JWT_SECRET || 'your_jwt_secret', {expiresIn: '1h'});
const data = JSON.stringify({
  supplier_id: 74,
  payment_basis: "cash",
  items: [{id: 96, item_id: 25, quantity: 1, unit_price: 321}]
});

const req = http.request({
  hostname: 'localhost',
  port: 5001,
  path: '/api/purchase-requests/73/process',
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  }
}, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log('STATUS:', res.statusCode, 'BODY:', body));
});
req.on('error', console.error);
req.write(data);
req.end();
