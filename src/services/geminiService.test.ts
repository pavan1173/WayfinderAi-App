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
  it('should plan a trip from saved spots', async () => {
    const mockGenerateContent = vi.mocked(new GoogleGenAI({} as any).models.generateContent);
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        destination: 'Paris',
        duration: 3,
        budget: 'Moderate',
        hotels: [{ name: 'Hotel 1', rating: 4, pricePerNight: 200, description: 'Nice', image: 'image.jpg' }],
        itinerary: [{ day: 1, spotIds: ['1'] }]
      })
    } as any);

    const trip = await geminiService.planTripFromSavedSpots([{ id: '1', name: 'Eiffel Tower', category: 'Sight' } as any], 3, ['Budget']);
    
    expect(trip).toBeDefined();
    expect(trip.destination).toBe('Paris');
    expect(mockGenerateContent).toHaveBeenCalled();
  });

  it('should plan an itinerary', async () => {
    const mockGenerateContent = vi.mocked(new GoogleGenAI({} as any).models.generateContent);
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        budget: 'Low',
        hotels: [{ name: 'Hotel 2', rating: 3, pricePerNight: 100, description: 'Budget', image: 'hotel2.jpg' }],
        itinerary: [{ day: 1, spotIds: ['1'] }]
      })
    } as any);

    const result = await geminiService.planItinerary('London', 1, [{ id: '1', name: 'Big Ben', category: 'Sight' } as any]);
    
    expect(result).toBeDefined();
    expect(result.budget).toBe('Low');
    expect(result.hotels).toHaveLength(1);
    expect(mockGenerateContent).toHaveBeenCalled();
  });
});
