import { jest } from '@jest/globals';
import dotenv from 'dotenv';
import db from '../config/database.js';
import logger from '../utils/logger.js';

dotenv.config({ path: '.env.test' });

// Mock logger to prevent spam during tests
logger.info = jest.fn();
logger.error = jest.fn();
logger.warn = jest.fn();
logger.debug = jest.fn();

afterAll(async () => {
  // Close DB connection after tests complete
  await db.end();
});
