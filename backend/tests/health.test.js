import { jest } from '@jest/globals';
import request from 'supertest';
import { app } from '../server.js';
import db from '../config/database.js';

describe('Health Check API', () => {
  let querySpy;
  
  beforeEach(() => {
    querySpy = jest.spyOn(db, 'query');
  });

  afterEach(() => {
    querySpy.mockRestore();
  });

  it('should return 200 OK', async () => {
    querySpy.mockResolvedValueOnce([[]]);

    const res = await request(app).get('/api/health');
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('status', 'OK');
  });

  it('should return 500 on DB failure', async () => {
    querySpy.mockRejectedValueOnce(new Error('Connection lost'));

    const res = await request(app).get('/api/health');
    
    expect(res.statusCode).toEqual(500);
    expect(res.body).toHaveProperty('status', 'Error');
  });
});
