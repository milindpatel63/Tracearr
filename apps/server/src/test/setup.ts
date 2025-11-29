/**
 * Vitest global test setup
 */

import { vi } from 'vitest';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars!!!';

// Global mocks that apply to all tests
// Database is mocked per-test file to allow custom behavior
