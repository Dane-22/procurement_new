import api from './api';

export const itemService = {
  getPage: async (params = {}) => {
    const response = await api.get('/items', { params, cache: false });
    const payload = response.data || {};

    return {
      items: Array.isArray(payload.items) ? payload.items : [],
      page: Number(payload.page) || 1,
      pageSize: Number(payload.pageSize) || Number(params.pageSize) || 20,
      total: Number(payload.total) || 0,
      totalPages: Number(payload.totalPages) || 1
    };
  },

  getAll: async () => {
    const pageSize = 100;
    const all = [];
    let page = 1;
    let total = Infinity;

    while (all.length < total) {
      const payload = await itemService.getPage({ page, pageSize });
      const items = Array.isArray(payload.items) ? payload.items : [];
      total = Number.isFinite(payload.total) ? payload.total : items.length;

      all.push(...items);
      if (items.length < pageSize) break;

      page += 1;
      if (page > 1000) break;
    }

    const unique = new Map();
    for (const item of all) {
      if (item?.id == null) continue;
      unique.set(item.id, item);
    }

    return Array.from(unique.values());
  },

  getPricingHistory: async (params = {}) => {
    const response = await api.get('/items/pricing-history', { params });
    return response.data.history || response.data.items || response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/items/${id}`);
    return response.data.item;
  },

  getNextSku: async (params = {}) => {
    const response = await api.get('/items/next-sku', { params, cache: false });
    return response.data.item_code;
  },

  generateSkuFromName: async (itemName) => {
    const response = await api.get('/items/generate-sku-from-name', { 
      params: { item_name: itemName },
      cache: false 
    });
    return response.data.item_code;
  },

  create: async (itemData) => {
    const response = await api.post('/items', itemData);
    return response.data;
  },

  update: async (id, itemData) => {
    const response = await api.put(`/items/${id}`, itemData);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/items/${id}`);
    return response.data;
  }
};
