import { describe, it, expect, vi } from 'vitest';
import { geminiService } from './geminiService';
import { GoogleGenAI } from '@google/genai';

// Mock the AI module
vi.mock('@google/genai', () => {
  const mockAi = {
    models: {
      generateContent: vi.fn(),
    },
  };
  return {
    GoogleGenAI: vi.fn().mockImplementation(function() { return mockAi; }),
    Type: {
      OBJECT: 'OBJECT',
      ARRAY: 'ARRAY',
      STRING: 'STRING',
      NUMBER: 'NUMBER',
    },
  };
});

// Mock the AI instance
vi.mock('../firebase', () => ({
  auth: {},
  db: {},
}));

describe('geminiService', () => {
  it('should generate a trip summary', async () => {
    const mockGenerateContent = vi.mocked(new GoogleGenAI({} as any).models.generateContent);
    mockGenerateContent.mockResolvedValue({
      text: 'This is a great trip!',
    } as any);

    const trip = { id: '1', destination: 'Paris', duration: 3, spots: [] } as any;
    const summary = await geminiService.getTripSummary(trip);
    
    expect(summary).toBe('This is a great trip!');
    expect(mockGenerateContent).toHaveBeenCalled();
  });
});
