import express from 'express';
import { authenticate, requireItemManagement } from '../middleware/auth.js';
import db from '../config/database.js';

const router = express.Router();

const SKU_PREFIX = 'SKU-';
const SKU_NUMBER_LENGTH = 3;
const STRUCTURED_SKU_FIELDS = ['brand', 'product_type', 'material', 'color', 'size'];
const SKU_CODE_MAP = new Map([
  ['classic clothing', 'CLS'],
  ['crewneck sweater', 'CRW'],
  ['cotton', 'CTN'],
  ['blue', 'BLU'],
  ['medium', 'MED'],
  ['small', 'SML'],
  ['large', 'LRG'],
  ['extra small', 'XS'],
  ['extra large', 'XL']
]);

const formatSku = (number) => `${SKU_PREFIX}${String(number).padStart(SKU_NUMBER_LENGTH, '0')}`;

const normalizeSkuPart = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

const getSkuSegment = (value) => {
  const normalized = normalizeSkuPart(value);
  if (!normalized) return '';
  if (SKU_CODE_MAP.has(normalized)) return SKU_CODE_MAP.get(normalized);

  const compact = normalized.replace(/[^a-z0-9]/g, '').toUpperCase();
  return compact.slice(0, 3).padEnd(3, 'X');
};

const getStructuredSkuBase = (parts = {}) => {
  const segments = STRUCTURED_SKU_FIELDS.map((field) => getSkuSegment(parts[field]));
  return segments.every(Boolean) ? segments.join('-') : null;
};

const getNextNumericSku = async () => {
  const [rows] = await db.query(`
    SELECT
      MAX(
        CASE
          WHEN item_code REGEXP ? THEN CAST(SUBSTRING(item_code, ?) AS UNSIGNED)
          ELSE NULL
        END
      ) AS max_sku_number,
      MAX(id) AS max_item_id
    FROM items
  `, [`^${SKU_PREFIX}[0-9]+$`, SKU_PREFIX.length + 1]);

  const maxSkuNumber = Number(rows?.[0]?.max_sku_number) || 0;
  const maxItemId = Number(rows?.[0]?.max_item_id) || 0;

  return formatSku(Math.max(maxSkuNumber, maxItemId) + 1);
};

const escapeLike = (value) => String(value).replace(/[\\%_]/g, (char) => `\\${char}`);

const getNextStructuredSku = async (baseSku) => {
  const [rows] = await db.query(
    `
      SELECT item_code
      FROM items
      WHERE item_code = ? OR item_code LIKE ? ESCAPE '\\\\'
    `,
    [baseSku, `${escapeLike(baseSku)}-%`]
  );

  if (rows.length === 0) return baseSku;

  let maxSuffix = 1;
  for (const row of rows) {
    const code = String(row?.item_code || '');
    if (code === baseSku) {
      maxSuffix = Math.max(maxSuffix, 1);
      continue;
    }

    const suffix = code.slice(baseSku.length + 1);
    if (/^\d+$/.test(suffix)) {
      maxSuffix = Math.max(maxSuffix, Number(suffix));
    }
  }

  return `${baseSku}-${String(maxSuffix + 1).padStart(3, '0')}`;
};

const getNextSku = async (parts = {}) => {
  const baseSku = getStructuredSkuBase(parts);
  return baseSku ? getNextStructuredSku(baseSku) : getNextNumericSku();
};

// Generate SKU code from item name (e.g., "Hollow block" -> "HLBK")
const generateSkuCodeFromName = (itemName) => {
  if (!itemName || typeof itemName !== 'string') return '';
  
  const words = itemName.trim().split(/\s+/).filter(word => word.length > 0);
  if (words.length === 0) return '';
  
  // Take first 2 letters of each word, uppercase them
  const codeParts = words.map(word => {
    const cleanWord = word.replace(/[^a-zA-Z]/g, '').toUpperCase();
    return cleanWord.slice(0, 2);
  }).filter(part => part.length > 0);
  
  if (codeParts.length === 0) return '';
  
  return codeParts.join('');
};

// Get next sequential SKU based on item name
const getNextSkuFromName = async (itemName) => {
  const baseCode = generateSkuCodeFromName(itemName);
  if (!baseCode) return getNextNumericSku();
  
  const [rows] = await db.query(
    `
      SELECT item_code
      FROM items
      WHERE item_code LIKE ? ESCAPE '\\\\'
    `,
    [`${escapeLike(baseCode)}-%`]
  );
  
  if (rows.length === 0) return `${baseCode}-001`;
  
  let maxSuffix = 0;
  for (const row of rows) {
    const code = String(row?.item_code || '');
    const suffix = code.slice(baseCode.length + 1);
    if (/^\d+$/.test(suffix)) {
      maxSuffix = Math.max(maxSuffix, Number(suffix));
    }
  }
  
  return `${baseCode}-${String(maxSuffix + 1).padStart(3, '0')}`;
};

// Get all items with category info
router.get('/', authenticate, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 20, 1), 100);
    const offset = (page - 1) * pageSize;
    const search = String(req.query.search || '').trim();
    const category = String(req.query.category || '').trim();

    const whereClauses = ["i.status = 'Active'"];
    const whereParams = [];

    if (search) {
      whereClauses.push('(i.item_name LIKE ? OR i.item_code LIKE ?)');
      const searchPattern = `%${search}%`;
      whereParams.push(searchPattern, searchPattern);
    }

    if (category && category.toLowerCase() !== 'all') {
      whereClauses.push('c.category_name = ?');
      whereParams.push(category);
    }

    const whereSql = whereClauses.join(' AND ');

    const [items] = await db.query(`
      SELECT i.*, c.category_name, c.description as category_description
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      WHERE ${whereSql}
      ORDER BY i.item_name
      LIMIT ? OFFSET ?
    `, [...whereParams, pageSize, offset]);

    const [countRows] = await db.query(`
      SELECT COUNT(*) as total
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      WHERE ${whereSql}
    `, whereParams);

    const total = Number(countRows?.[0]?.total ?? 0);
    const totalPages = Math.max(Math.ceil(total / pageSize), 1);

    res.json({ items, page, pageSize, total, totalPages });
  } catch (error) {
    console.error('Fetch items error:', error);
    res.status(500).json({ message: 'Failed to fetch items: ' + error.message });
  }
});

// Get next generated SKU for add item form
router.get('/next-sku', authenticate, requireItemManagement, async (req, res) => {
  try {
    const item_code = await getNextSku(req.query);
    res.json({ item_code });
  } catch (error) {
    console.error('Generate SKU error:', error);
    res.status(500).json({ message: 'Failed to generate SKU: ' + error.message });
  }
});

// Generate SKU from item name
router.get('/generate-sku-from-name', authenticate, requireItemManagement, async (req, res) => {
  try {
    const { item_name } = req.query;
    if (!item_name || !String(item_name).trim()) {
      return res.status(400).json({ message: 'Item name is required' });
    }
    
    const item_code = await getNextSkuFromName(item_name);
    res.json({ item_code });
  } catch (error) {
    console.error('Generate SKU from name error:', error);
    res.status(500).json({ message: 'Failed to generate SKU from name: ' + error.message });
  }
});

// Get single item
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [items] = await db.query(`
      SELECT i.*, c.category_name
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      WHERE i.id = ? AND i.status = 'Active'
    `, [req.params.id]);

    if (items.length === 0) {
      return res.status(404).json({ message: 'Item not found' });
    }

    res.json({ item: items[0] });
  } catch (error) {
    console.error('Fetch item error:', error);
    res.status(500).json({ message: 'Failed to fetch item: ' + error.message });
  }
});

// Create item (procurement, admin, super_admin, engineer can create)
router.post('/', authenticate, requireItemManagement, async (req, res) => {
  try {
    const { item_name, description, category_id, unit, brand, product_type, material, color, size } = req.body;
    const created_by = req.user.id;

    if (!item_name || !String(item_name).trim()) {
      return res.status(400).json({ message: 'Item name is required' });
    }

    const normalizedCategoryId = Number(category_id);
    if (!Number.isInteger(normalizedCategoryId) || normalizedCategoryId <= 0) {
      return res.status(400).json({ message: 'Category is required' });
    }

    const [categories] = await db.query(
      'SELECT id FROM categories WHERE id = ? LIMIT 1',
      [normalizedCategoryId]
    );

    if (categories.length === 0) {
      return res.status(400).json({ message: 'Selected category does not exist' });
    }

    let result;
    let item_code;
    const skuParts = { brand, product_type, material, color, size };
    for (let attempt = 0; attempt < 5; attempt += 1) {
      item_code = await getNextSku(skuParts);
      try {
        [result] = await db.query(
          'INSERT INTO items (item_code, item_name, description, category_id, unit, created_by) VALUES (?, ?, ?, ?, ?, ?)',
          [item_code, item_name, description, normalizedCategoryId, unit, created_by]
        );
        break;
      } catch (error) {
        const isSkuDuplicate = error?.code === 'ER_DUP_ENTRY' && String(error?.message || '').includes('item_code');
        if (!isSkuDuplicate || attempt === 4) throw error;
      }
    }

    res.status(201).json({ 
      message: 'Item created successfully', 
      itemId: result.insertId,
      item_code
    });
  } catch (error) {
    console.error('Create item error:', error);
    if (error?.code === 'ER_DUP_ENTRY' && String(error?.message || '').includes('item_code')) {
      return res.status(400).json({ message: 'SKU already exists' });
    }
    res.status(500).json({ message: 'Failed to create item: ' + error.message });
  }
});

// Update item (procurement, admin, super_admin, engineer can update)
router.put('/:id', authenticate, requireItemManagement, async (req, res) => {
  try {
    const { item_code, item_name, description, category_id, unit } = req.body;
    const normalizedCategoryId = Number(category_id);

    if (!item_code || !String(item_code).trim()) {
      return res.status(400).json({ message: 'SKU is required' });
    }

    if (!item_name || !String(item_name).trim()) {
      return res.status(400).json({ message: 'Item name is required' });
    }

    if (!Number.isInteger(normalizedCategoryId) || normalizedCategoryId <= 0) {
      return res.status(400).json({ message: 'Category is required' });
    }

    const [categories] = await db.query(
      'SELECT id FROM categories WHERE id = ? LIMIT 1',
      [normalizedCategoryId]
    );

    if (categories.length === 0) {
      return res.status(400).json({ message: 'Selected category does not exist' });
    }
    
    await db.query(
      'UPDATE items SET item_code = ?, item_name = ?, description = ?, category_id = ?, unit = ? WHERE id = ?',
      [item_code, item_name, description, normalizedCategoryId, unit, req.params.id]
    );

    res.json({ message: 'Item updated successfully' });
  } catch (error) {
    console.error('Update item error:', error);
    if (error?.code === 'ER_DUP_ENTRY' && String(error?.message || '').includes('item_code')) {
      return res.status(400).json({ message: 'SKU already exists' });
    }
    res.status(500).json({ message: 'Failed to update item: ' + error.message });
  }
});

// Delete item (procurement, admin, super_admin, engineer can delete - soft delete)
router.delete('/:id', authenticate, requireItemManagement, async (req, res) => {
  try {
    await db.query("UPDATE items SET status = 'Inactive' WHERE id = ?", [req.params.id]);
    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Delete item error:', error);
    res.status(500).json({ message: 'Failed to delete item: ' + error.message });
  }
});

export default router;
