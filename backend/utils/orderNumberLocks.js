import db from '../config/database.js';

const LOCKS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS order_number_locks (
    id INT(11) NOT NULL AUTO_INCREMENT,
    order_number VARCHAR(100) NOT NULL,
    locked_by INT(11) NOT NULL,
    locked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY unique_order_number_lock (order_number),
    KEY idx_locked_by (locked_by),
    CONSTRAINT fk_order_number_locks_locked_by FOREIGN KEY (locked_by) REFERENCES employees (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

let ensured = false;

const ensureLocksTable = async () => {
  if (ensured) return;
  await db.query(LOCKS_TABLE_SQL);
  ensured = true;
};

export const normalizeOrderNumber = (orderNumber) => String(orderNumber || '').trim();

export const getLockedOrderNumbers = async (orderNumbers = []) => {
  await ensureLocksTable();
  const normalized = [...new Set(orderNumbers.map(normalizeOrderNumber).filter(Boolean))];
  if (!normalized.length) return new Set();

  const placeholders = normalized.map(() => '?').join(', ');
  const [rows] = await db.query(
    `SELECT order_number FROM order_number_locks WHERE order_number IN (${placeholders})`,
    normalized
  );

  return new Set(rows.map((row) => normalizeOrderNumber(row.order_number)));
};

export const getOrderNumberLock = async (orderNumber) => {
  await ensureLocksTable();
  const normalized = normalizeOrderNumber(orderNumber);
  if (!normalized) return null;

  const [rows] = await db.query(
    `SELECT l.id, l.order_number, l.locked_by, l.locked_at, e.first_name, e.last_name
     FROM order_number_locks l
     LEFT JOIN employees e ON e.id = l.locked_by
     WHERE l.order_number = ?
     LIMIT 1`,
    [normalized]
  );
  return rows[0] || null;
};

export const isOrderNumberLocked = async (orderNumber) => {
  const lock = await getOrderNumberLock(orderNumber);
  return Boolean(lock);
};

export const assertOrderNumberUnlocked = async (orderNumber, actionLabel = 'This action') => {
  const normalized = normalizeOrderNumber(orderNumber);
  if (!normalized) return;

  const lock = await getOrderNumberLock(normalized);
  if (!lock) return;

  const error = new Error(`Order number "${normalized}" is locked; ${actionLabel} is not allowed.`);
  error.statusCode = 409;
  throw error;
};

export const lockOrderNumber = async (orderNumber, lockedBy) => {
  await ensureLocksTable();
  const normalized = normalizeOrderNumber(orderNumber);
  if (!normalized) {
    const error = new Error('Order number is required');
    error.statusCode = 400;
    throw error;
  }

  await db.query(
    'INSERT IGNORE INTO order_number_locks (order_number, locked_by) VALUES (?, ?)',
    [normalized, lockedBy]
  );

  return getOrderNumberLock(normalized);
};
