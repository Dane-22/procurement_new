import request from 'supertest';
import { createServer } from 'http';
import express from 'express';
// Simple mock for the server to test routes without DB connection if needed
// Or we can test against the running instance. Since we want an API test, we should test against the local server that is already running, or import the app.
// For this simple test, let's hit the already running dev server on localhost:5005

describe('Auth API', () => {
  const baseURL = 'http://localhost:5005/api/auth';

  it('should reject login without credentials', async () => {
    const res = await request(baseURL)
      .post('/login')
      .send({});
    expect(res.statusCode).toEqual(400); // Bad Request or 401
  });
});

describe('Items API', () => {
  const baseURL = 'http://localhost:5005/api/items';

  it('should return 401 without auth token', async () => {
    const res = await request(baseURL)
      .get('/');
    expect(res.statusCode).toEqual(401); // Unauthorized
  });
});
