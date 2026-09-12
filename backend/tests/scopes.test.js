import { jest } from '@jest/globals';
import { filterByScope, scopeResponse } from '../utils/scopes.js';

describe('Scopes Utility', () => {
  describe('filterByScope', () => {
    it('should return original data if data is not an object', () => {
      expect(filterByScope(null, 'admin', 'purchaseRequest')).toBeNull();
      expect(filterByScope('string', 'admin', 'purchaseRequest')).toBe('string');
      expect(filterByScope(123, 'admin', 'purchaseRequest')).toBe(123);
    });

    it('should return all fields if allowedFields is "*"', () => {
      const data = { id: 1, secret_field: 'secret' };
      const result = filterByScope(data, 'admin', 'purchaseRequest');
      expect(result).toEqual(data);
    });

    it('should filter fields based on role and resource (Engineer)', () => {
      const data = {
        id: 1,
        pr_number: 'PR-123',
        secret_field: 'should_be_hidden',
      };
      
      const result = filterByScope(data, 'engineer', 'purchaseRequest');
      
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('pr_number');
      expect(result).not.toHaveProperty('secret_field');
    });

    it('should process arrays of objects', () => {
      const data = [
        { id: 1, secret_field: 'secret1' },
        { id: 2, secret_field: 'secret2' },
      ];
      
      const result = filterByScope(data, 'engineer', 'purchaseRequest');
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0]).not.toHaveProperty('secret_field');
      expect(result[0]).toHaveProperty('id', 1);
    });

    it('should fallback to engineer scope if role is unknown', () => {
      const data = { id: 1, pr_number: 'PR-123', secret_field: 'hidden' };
      const result = filterByScope(data, 'unknown_role', 'purchaseRequest');
      
      expect(result).toHaveProperty('pr_number');
      expect(result).not.toHaveProperty('secret_field');
    });

    it('should fallback to public scope if resource is not found for role', () => {
      const data = { id: 1, created_at: '2023-01-01', internal_memo: 'hidden' };
      const result = filterByScope(data, 'engineer', 'unknownResource');
      
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('created_at');
      expect(result).not.toHaveProperty('internal_memo');
    });
  });

  describe('scopeResponse Middleware', () => {
    it('should wrap res.json and filter scoped keys', () => {
      const req = { user: { role: 'engineer' } };
      let sentData = null;
      
      const res = {
        json: jest.fn(function(data) {
          sentData = data;
          return this;
        })
      };
      const next = jest.fn();

      const middleware = scopeResponse('purchaseRequest');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();

      // Simulate the route handler calling res.json
      res.json({
        purchaseRequest: {
          id: 1,
          pr_number: 'PR-123',
          secret_field: 'hidden'
        }
      });

      expect(sentData.purchaseRequest).toHaveProperty('id');
      expect(sentData.purchaseRequest).not.toHaveProperty('secret_field');
    });
  });
});
