import { jest } from '@jest/globals';
import request from 'supertest';
import { app } from '../server.js';
import db from '../config/database.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

describe('Auth API Integration', () => {
  let querySpy;
  let validPasswordHash;

  beforeAll(async () => {
    validPasswordHash = await bcrypt.hash('password123', 10);
  });

  beforeEach(() => {
    querySpy = jest.spyOn(db, 'query');
  });

  afterEach(() => {
    querySpy.mockRestore();
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      // Mock db response for employee search
      querySpy.mockResolvedValueOnce([[{
        id: 1,
        employee_no: 'EMP-001',
        password: validPasswordHash,
        first_name: 'John',
        middle_initial: 'D',
        last_name: 'Doe',
        role: 'engineer',
        is_active: 1,
        created_at: new Date()
      }]]);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ employee_no: 'EMP-001', password: 'password123' });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toHaveProperty('employee_no', 'EMP-001');
      expect(res.body.user).toHaveProperty('role', 'engineer');
    });

    it('should return 401 for invalid password', async () => {
      querySpy.mockResolvedValueOnce([[{
        id: 1,
        employee_no: 'EMP-001',
        password: validPasswordHash,
        is_active: 1
      }]]);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ employee_no: 'EMP-001', password: 'wrongpassword' });

      expect(res.statusCode).toEqual(401);
      expect(res.body.message).toBe('Invalid credentials');
    });

    it('should return 401 if employee not found', async () => {
      querySpy.mockResolvedValueOnce([[]]); // Empty array = no user

      const res = await request(app)
        .post('/api/auth/login')
        .send({ employee_no: 'NONEXISTENT', password: 'password123' });

      expect(res.statusCode).toEqual(401);
      expect(res.body.message).toBe('Invalid credentials');
    });

    it('should return 403 if account is deactivated', async () => {
      querySpy.mockResolvedValueOnce([[{
        id: 1,
        employee_no: 'EMP-001',
        password: validPasswordHash,
        is_active: 0 // Deactivated
      }]]);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ employee_no: 'EMP-001', password: 'password123' });

      expect(res.statusCode).toEqual(403);
      expect(res.body.message).toBe('Account is deactivated');
    });

    it('should return 400 for missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ employee_no: 'EMP-001' }); // missing password

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('errors');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return user profile if valid token provided', async () => {
      const token = jwt.sign({ id: 1, role: 'engineer' }, process.env.JWT_SECRET || 'your-secret-key');

      querySpy.mockResolvedValueOnce([[{
        id: 1,
        employee_no: 'EMP-001',
        first_name: 'John',
        role: 'engineer',
        is_active: 1
      }]]);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.user).toHaveProperty('employee_no', 'EMP-001');
    });

    it('should return 401 if no token provided', async () => {
      const res = await request(app)
        .get('/api/auth/me');

      expect(res.statusCode).toEqual(401);
      expect(res.body.message).toBe('No token provided');
    });

    it('should return 401 for invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalidtoken');

      expect(res.statusCode).toEqual(401);
      expect(res.body.message).toBe('Invalid token');
    });
  });
});
