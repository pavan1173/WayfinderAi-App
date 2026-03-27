import { describe, it, expect, vi } from 'vitest';
import { geminiService } from './geminiService';

// Mock the AI module
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(),
  Type: {
    OBJECT: 'OBJECT',
    ARRAY: 'ARRAY',
    STRING: 'STRING',
    NUMBER: 'NUMBER',
  },
}));

// Mock the AI instance
vi.mock('../firebase', () => ({
  auth: {},
  db: {},
}));

describe('geminiService', () => {
  it('should have planItinerary function', () => {
    expect(typeof geminiService.planItinerary).toBe('function');
  });
});
