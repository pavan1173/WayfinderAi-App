import { GoogleGenAI, Type, Modality, ThinkingLevel } from "@google/genai";
import { showToast } from '../lib/toast';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Helper to handle API errors, specifically rate limits
async function handleGeminiError<T>(error: any, fallback: T, context: string): Promise<T> {
  let isRateLimit = false;
  const errorMsg = error.message || "";
  
  if (errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED")) {
    isRateLimit = true;
  } else if (error.status === 429 || error.code === 429) {
    isRateLimit = true;
  } else {
    try {
      const parsed = typeof errorMsg === 'string' ? JSON.parse(errorMsg) : errorMsg;
      if (parsed?.error?.code === 429 || parsed?.error?.status === "RESOURCE_EXHAUSTED") {
        isRateLimit = true;
      }
    } catch (err) {
      if (error.error?.code === 429 || error.error?.status === "RESOURCE_EXHAUSTED") {
        isRateLimit = true;
      }
    }
  }

  if (isRateLimit) {
    console.warn(`Gemini rate limit hit for ${context}, using fallback.`);
    showToast("Rate limit exceeded. Please try again later.");
  } else {
    console.error(`Failed to load ${context}`, error);
    showToast(`Failed to load ${context}. Please try again.`);
  }
  
  return fallback;
}

export interface Spot {
  id: string;
  name: string;
  description: string;
  category: string;
  address?: string;
  hours?: string;
  website?: string;
  phone?: string;
  imageUrl?: string;
  rating?: number;
  reviewsCount?: number;
  mapsUri?: string;
  reviewSnippets?: string[];
  openingHours?: string;
  lat?: number;
  lng?: number;
  reason?: string;
}

export interface Hotel {
  name: string;
  rating: number;
  pricePerNight: string;
  description: string;
  imageUrl: string;
}

export interface Trip {
  id: string;
  destination: string;
  duration: number;
  dates?: string;
  budget?: string;
  hotels?: Hotel[];
  spots: Spot[];
  itinerary: {
    day: number;
    spots: Spot[];
  }[];
}

export async function getWikipediaImage(query: string): Promise<string> {
  if (!query) return 'https://loremflickr.com/600/400/travel';
  
  const cleanQuery = query.replace(/best|top|places to visit in|things to do in|itinerary|for two days|for \d+ days|in \w+|guide|travel|trip/gi, '').trim() || query;
  
  async function fetchWikiImage(q: string): Promise<string | null> {
    try {
      const res = await fetch(`https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrlimit=1&prop=pageimages&format=json&pithumbsize=600&origin=*`);
      const data = await res.json();
      const pages = data?.query?.pages;
      if (pages) {
        const pageId = Object.keys(pages)[0];
        if (pageId !== '-1' && pages[pageId].thumbnail) {
          return pages[pageId].thumbnail.source;
        }
      }
    } catch (e) {
      console.error("Wikipedia image fetch failed for", q, e);
    }
    return null;
  }

  // Try initial query
  let image = await fetchWikiImage(cleanQuery);
  if (image) return image;

  // Try broader query
  image = await fetchWikiImage(`${cleanQuery} landmark`);
  if (image) return image;
  
  // Fallback to loremflickr with the query
  const keywords = cleanQuery.split(' ').join(',');
  return `https://loremflickr.com/600/400/${encodeURIComponent(keywords)}`;
}

export const geminiService = {
  async extractSpotsFromText(text: string): Promise<Spot[]> {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Extract travel spots from: "${text}". Provide: name, description, category, lat, lng.`,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                category: { type: Type.STRING },
                lat: { type: Type.NUMBER },
                lng: { type: Type.NUMBER },
              },
              required: ["name", "description", "category", "lat", "lng"],
            },
          },
        },
      });

      const spots = JSON.parse(response.text);
      const uniqueSpots = spots.filter((s: any, index: number, self: any[]) => 
        index === self.findIndex((t) => t.name === s.name)
      );
      return Promise.all(uniqueSpots.map(async (s: any) => ({
        ...s,
        id: Math.random().toString(36).substr(2, 9) + Date.now().toString(36).substr(-4),
        imageUrl: await getWikipediaImage(s.name),
      })));
    } catch (e) {
      return handleGeminiError(e, [], "extracting spots from text");
    }
  },

  async getSpotDetailsWithMaps(spotName: string, location?: { lat: number, lng: number }): Promise<Partial<Spot>> {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Find Maps info for: "${spotName}". Include website, phone, opening hours, lat, lng.`,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: location ? { latitude: location.lat, longitude: location.lng } : undefined
            }
          }
        },
      });

      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const mapsUri = groundingChunks?.find(c => c.maps?.uri)?.maps?.uri;
      const reviewSnippets = groundingChunks?.filter(c => c.maps?.placeAnswerSources?.reviewSnippets)
        .flatMap(c => c.maps?.placeAnswerSources?.reviewSnippets?.map((s: any) => s.text || s) || []);

      const infoText = response.text;

      const structuredResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Extract from text: website, phone, hours, lat, lng. Text: ${infoText}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              website: { type: Type.STRING },
              phone: { type: Type.STRING },
              openingHours: { type: Type.STRING },
              lat: { type: Type.NUMBER },
              lng: { type: Type.NUMBER },
            }
          }
        }
      });

      let parsed: any = {};
      try {
        parsed = JSON.parse(structuredResponse.text);
      } catch (e) {
        console.error("Failed to parse structured response", e);
      }

      return {
        mapsUri,
        reviewSnippets,
        website: parsed.website || undefined,
        phone: parsed.phone || undefined,
        openingHours: parsed.openingHours || undefined,
        lat: parsed.lat || undefined,
        lng: parsed.lng || undefined,
        description: infoText
      };
    } catch (e) {
      return handleGeminiError(e, {}, "getting spot details");
    }
  },

  async analyzeImageForSpots(base64Image: string): Promise<{ isAiGenerated: boolean, spots: Spot[] }> {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Image
              }
            },
            { text: "Analyze this image. First, determine if it is an AI-generated image or a real photo. Then, if it is a real photo (not AI-generated), extract all the travel spots mentioned or visible. For each spot, provide name, description, category, and approximate latitude/longitude coordinates. If it is an AI-generated image, return an empty array for spots." }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isAiGenerated: { type: Type.BOOLEAN },
              spots: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    description: { type: Type.STRING },
                    category: { type: Type.STRING },
                    lat: { type: Type.NUMBER },
                    lng: { type: Type.NUMBER },
                  },
                  required: ["name", "description", "category", "lat", "lng"],
                },
              }
            },
            required: ["isAiGenerated", "spots"]
          },
        },
      });

      const result = JSON.parse(response.text);
      const spotsWithImages = await Promise.all(result.spots.map(async (s: any) => ({
        ...s,
        id: Math.random().toString(36).substr(2, 9) + Date.now().toString(36).substr(-4),
        imageUrl: await getWikipediaImage(s.name),
      })));
      return {
        isAiGenerated: result.isAiGenerated,
        spots: spotsWithImages
      };
    } catch (e) {
      return handleGeminiError(e, { isAiGenerated: false, spots: [] }, "analyzing image for spots");
    }
  },

  async generateSpeech(text: string): Promise<string | undefined> {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Read this travel itinerary cheerfully: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    } catch (e) {
      return handleGeminiError(e, undefined, "generating speech");
    }
  },

  async complexTripAdvice(query: string): Promise<string> {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: query,
        config: {
          },
      });
      
      let text = response.text;
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks && chunks.length > 0) {
        const urls = chunks.map(c => c.web?.uri).filter(Boolean);
        if (urls.length > 0) {
          text += "\n\n**Sources:**\n" + urls.map(url => `- [${url}](${url})`).join("\n");
        }
      }
      return text;
    } catch (e) {
      return handleGeminiError(e, "Sorry, I couldn't get trip advice right now.", "complex trip advice");
    }
  },

  async analyzeSocialLink(url: string): Promise<Spot[]> {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze the content of this social media link: ${url}. Identify all travel destinations, landmarks, or spots mentioned or shown. For each spot, provide a name, a vivid description of what makes it special, a category, and approximate latitude/longitude coordinates. Return the data as a JSON array of objects.`,
        config: {
          tools: [{ urlContext: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                category: { type: Type.STRING },
                lat: { type: Type.NUMBER },
                lng: { type: Type.NUMBER },
              },
              required: ["name", "description", "category", "lat", "lng"],
            },
          },
        },
      });

      const spots = JSON.parse(response.text);
      const uniqueSpots = spots.filter((s: any, index: number, self: any[]) => 
        index === self.findIndex((t) => t.name === s.name)
      );
      return Promise.all(uniqueSpots.map(async (s: any) => ({
        ...s,
        id: Math.random().toString(36).substr(2, 9) + Date.now().toString(36).substr(-4),
        imageUrl: await getWikipediaImage(s.name),
      })));
    } catch (e) {
      return handleGeminiError(e, [], "analyzing social link");
    }
  },

  async analyzeReelVideo(videoData: string, mimeType: string): Promise<Spot[]> {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: videoData
              }
            },
            { text: "Analyze this Instagram Reel/Video. Identify all travel destinations, landmarks, or spots mentioned or shown. For each spot, provide a name, a vivid description of what makes it special, a category, and approximate latitude/longitude coordinates. CRITICAL: Verify the location name and ensure it is a real, specific, and accurate place. If you are unsure about a place, do not include it. Return the data as a JSON array of objects." }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                category: { type: Type.STRING },
                lat: { type: Type.NUMBER },
                lng: { type: Type.NUMBER },
              },
              required: ["name", "description", "category", "lat", "lng"],
            },
          },
        },
      });

      const spots = JSON.parse(response.text);
      const uniqueSpots = spots.filter((s: any, index: number, self: any[]) => 
        index === self.findIndex((t) => t.name === s.name)
      );
      return Promise.all(uniqueSpots.map(async (s: any) => ({
        ...s,
        id: Math.random().toString(36).substr(2, 9) + Date.now().toString(36).substr(-4),
        imageUrl: await getWikipediaImage(s.name),
      })));
    } catch (e) {
      return handleGeminiError(e, [], "analyzing reel video");
    }
  },

  async getFastSpotInfo(spotName: string): Promise<string> {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Give me a 2-sentence lightning-fast summary of why someone should visit ${spotName}. Focus on the most unique aspect.`,
      });
      return response.text;
    } catch (e) {
      return handleGeminiError(e, "Information not available.", "getting fast spot info");
    }
  },

  async getSpotRichDetails(spotName: string, location?: { lat: number, lng: number }): Promise<{ openingHours: string, reviews: string[], insights: string }> {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Find detailed Google Maps information for the travel spot: "${spotName}". Please include opening hours, recent reviews, and any unique AI-generated insights about what makes it special.`,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: location ? { latitude: location.lat, longitude: location.lng } : undefined
            }
          }
        },
      });

      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const reviewSnippets = groundingChunks?.filter(c => c.maps?.placeAnswerSources?.reviewSnippets)
        .flatMap(c => c.maps?.placeAnswerSources?.reviewSnippets?.map((s: any) => s.text || s) || []);

      const infoText = response.text;

      const structuredResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Extract opening hours, reviews, and unique insights from the following text. Text: ${infoText}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              openingHours: { type: Type.STRING },
              reviews: { type: Type.ARRAY, items: { type: Type.STRING } },
              insights: { type: Type.STRING },
            },
            required: ["openingHours", "reviews", "insights"]
          }
        }
      });

      return JSON.parse(structuredResponse.text);
    } catch (e) {
      return handleGeminiError(e, { openingHours: "Not available", reviews: [], insights: "No insights available." }, "getting spot rich details");
    }
  },

  async getDiscoverInfo(destination: string): Promise<string> {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Provide a comprehensive travel guide for ${destination}. 
        Include the following sections clearly formatted with Markdown headers (##):
        ## Things to Do
        List the top 5 must-do activities or attractions.
        
        ## Nearby Places
        List 3-4 interesting places or day trips near ${destination}.
        
        ## Upcoming Events
        List any notable seasonal events, festivals, or ongoing activities that happen in or around ${destination}.
        
        Keep the tone engaging, informative, and concise.`,
        config: {
          }
      });
      return response.text;
    } catch (e) {
      return handleGeminiError(e, "Travel guide not available.", "getting discover info");
    }
  },

  async planTripFromSavedSpots(spots: Spot[], duration: number, preferences: string[]): Promise<Trip> {
    try {
      const spotsJson = JSON.stringify(spots.map(s => ({ id: s.id, name: s.name, category: s.category, lat: s.lat, lng: s.lng })));
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Create a ${duration}-day trip itinerary using ALL of the following saved spots: ${spotsJson}. You MUST include every single spot provided in the itinerary.
        The user preferences are: ${preferences.join(', ')}.
        Suggest the best order for visiting these locations based on proximity and user preferences.
        CRITICAL: Verify the location name and ensure it is a real, specific, and accurate place. If you are unsure about a place, do not include it.
        Also provide an estimated budget (e.g., "$1500" or "Moderate") and recommend 3 nearby hotels with their name, rating, pricePerNight, description, and an image search keyword.
        Return a JSON object representing the trip.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              destination: { type: Type.STRING },
              duration: { type: Type.NUMBER },
              budget: { type: Type.STRING },
              hotels: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    rating: { type: Type.NUMBER },
                    pricePerNight: { type: Type.STRING },
                    description: { type: Type.STRING },
                    imageKeyword: { type: Type.STRING }
                  },
                  required: ["name", "rating", "pricePerNight", "description", "imageKeyword"]
                }
              },
              itinerary: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    day: { type: Type.NUMBER },
                    spots: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          id: { type: Type.STRING },
                          name: { type: Type.STRING },
                          description: { type: Type.STRING },
                          category: { type: Type.STRING },
                          lat: { type: Type.NUMBER },
                          lng: { type: Type.NUMBER },
                        },
                        required: ["id", "name", "description", "category", "lat", "lng"]
                      }
                    }
                  },
                  required: ["day", "spots"]
                }
              }
            },
            required: ["destination", "duration", "budget", "hotels", "itinerary"]
          }
        }
      });

      const data = JSON.parse(response.text);
      // Re-attach the original image URLs and full spot data
      const fullItinerary = await Promise.all(data.itinerary.map(async (day: any) => ({
        day: day.day,
        spots: await Promise.all(day.spots.map(async (s: any) => {
          const originalSpot = spots.find(os => os.id === s.id);
          return originalSpot ? { ...originalSpot, description: s.description } : { ...s, imageUrl: await getWikipediaImage(s.name) };
        }))
      })));
      
      const hotels = await Promise.all(data.hotels.map(async (h: any) => ({
        name: h.name,
        rating: h.rating,
        pricePerNight: h.pricePerNight,
        description: h.description,
        imageUrl: await getWikipediaImage(h.name)
      })));

      return {
        id: Math.random().toString(36).substr(2, 9) + Date.now().toString(36).substr(-4),
        destination: data.destination || "My Saved Spots Trip",
        duration: data.duration || duration,
        budget: data.budget,
        hotels: hotels,
        spots: fullItinerary.flatMap((d: any) => d.spots),
        itinerary: fullItinerary
      };
    } catch (e) {
      return handleGeminiError(e, {
        id: 'mock-trip',
        destination: 'Unknown',
        duration: duration,
        budget: 'Unknown',
        hotels: [],
        spots: [],
        itinerary: []
      }, "planning trip from saved spots");
    }
  },

  async planItinerary(destination: string, days: number, spots: Spot[]): Promise<{ itinerary: Trip['itinerary'], budget: string, hotels: Hotel[] }> {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Plan a ${days}-day itinerary for ${destination} using ALL of these spots (provided as ID: Name): ${spots.map(s => `${s.id}: ${s.name}`).join(", ")}. You MUST include every single spot provided in the itinerary. Group them logically by day to minimize travel time.
        CRITICAL: Verify the location name and ensure it is a real, specific, and accurate place. If you are unsure about a place, do not include it.
        Also provide an estimated budget (e.g., "$1500" or "Moderate") and recommend 3 nearby hotels with their name, rating, pricePerNight, description, and an image search keyword. Return the spot IDs for each day.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              budget: { type: Type.STRING },
              hotels: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    rating: { type: Type.NUMBER },
                    pricePerNight: { type: Type.STRING },
                    description: { type: Type.STRING },
                    imageKeyword: { type: Type.STRING }
                  },
                  required: ["name", "rating", "pricePerNight", "description", "imageKeyword"]
                }
              },
              itinerary: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    day: { type: Type.INTEGER },
                    spotIds: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING }
                    },
                  },
                  required: ["day", "spotIds"],
                },
              }
            },
            required: ["budget", "hotels", "itinerary"]
          },
        },
      });

      const data = JSON.parse(response.text);
      const itinerary = data.itinerary.map((p: any) => ({
        day: p.day,
        spots: p.spotIds.map((id: string) => spots.find(s => s.id === id)).filter(Boolean),
      }));
      const hotels = await Promise.all(data.hotels.map(async (h: any) => ({
        name: h.name,
        rating: h.rating,
        pricePerNight: h.pricePerNight,
        description: h.description,
        imageUrl: await getWikipediaImage(h.name)
      })));
      return { itinerary, budget: data.budget, hotels };
    } catch (e) {
      return handleGeminiError(e, { itinerary: [], budget: "Unknown", hotels: [] }, "planning itinerary");
    }
  },

  async getNearbySpots(lat: number, lng: number, category?: string): Promise<Spot[]> {
    try {
      // Step 1: Get information using Google Maps grounding
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Find 8 highly-rated and interesting ${category || 'travel spots, restaurants, or attractions'} near this location (Lat: ${lat}, Lng: ${lng}). For each, provide a name, a detailed description, a category, and exact latitude and longitude coordinates.`,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: { latitude: lat, longitude: lng }
            }
          }
        },
      });

      const infoText = response.text;

      // Step 2: Use a fast model to structure the text into JSON
      const structuredResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Extract travel spots from the following text and return them as a JSON array. For each spot, include: name, description, category, lat, and lng. Text: ${infoText}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                category: { type: Type.STRING },
                lat: { type: Type.NUMBER },
                lng: { type: Type.NUMBER },
              },
              required: ["name", "description", "category", "lat", "lng"],
            },
          },
        },
      });

      const spots = JSON.parse(structuredResponse.text);
      const uniqueSpots = spots.filter((s: any, index: number, self: any[]) => 
        index === self.findIndex((t) => t.name === s.name)
      );
      return Promise.all(uniqueSpots.map(async (s: any) => ({
        ...s,
        id: Math.random().toString(36).substr(2, 9) + Date.now().toString(36).substr(-4),
        imageUrl: await getWikipediaImage(s.name),
      })));
    } catch (e) {
      return handleGeminiError(e, [], "getting nearby spots");
    }
  },

  async getPersonalizedSuggestions(lat: number, lng: number, bio: string, savedSpots: Spot[]): Promise<any[]> {
    try {
      // Step 1: Get suggestions using Google Maps grounding
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Based on the user's bio: "${bio}" and their saved spots: ${savedSpots.map(s => s.name).join(", ")}, suggest 5 highly-rated and personalized travel spots, restaurants, or attractions near (Lat: ${lat}, Lng: ${lng}). For each, provide a name, a detailed description, a category, and why it's a perfect match for this user.`,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: { latitude: lat, longitude: lng }
            }
          }
        },
      });

      const infoText = response.text;

      // Step 2: Use a fast model to structure the text into JSON
      const structuredResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Extract the travel spots from the following text and return them as a JSON array. For each spot, include: name, description, category, reason, lat, and lng. Text: ${infoText}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                category: { type: Type.STRING },
                reason: { type: Type.STRING },
                lat: { type: Type.NUMBER },
                lng: { type: Type.NUMBER },
              },
              required: ["name", "description", "category", "reason", "lat", "lng"],
            },
          },
        },
      });

      const suggestions = JSON.parse(structuredResponse.text);
      const uniqueSuggestions = suggestions.filter((s: any, index: number, self: any[]) => 
        index === self.findIndex((t) => t.name === s.name)
      );
      return Promise.all(uniqueSuggestions.map(async (s: any) => ({
        ...s,
        id: Math.random().toString(36).substr(2, 9) + Date.now().toString(36).substr(-4),
        imageUrl: await getWikipediaImage(s.name),
      })));
    } catch (e) {
      return handleGeminiError(e, [], "getting personalized suggestions");
    }
  },

  async getLocalSocialInspiration(lat: number, lng: number): Promise<any[]> {
    const cacheKey = `social_inspiration_${lat.toFixed(2)}_${lng.toFixed(2)}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 1000 * 60 * 60 * 6) { // 6 hour cache
          return data;
        }
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Find 3 trendy, photogenic travel spots, cafes, or attractions near this location (Lat: ${lat}, Lng: ${lng}).`,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: { latitude: lat, longitude: lng }
            }
          }
        },
      });

      const infoText = response.text;

      const structuredResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Based on these places: ${infoText}\n\nGenerate 3 realistic social media travel posts (like Instagram/TikTok reels). Return a JSON array. For each post, include: author (e.g. @username), location (name of the place), likes (e.g. '12.4K'), comments (e.g. '342'), caption.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                author: { type: Type.STRING },
                location: { type: Type.STRING },
                likes: { type: Type.STRING },
                comments: { type: Type.STRING },
                caption: { type: Type.STRING },
              },
              required: ["author", "location", "likes", "comments", "caption"],
            },
          },
        },
      });

      const posts = JSON.parse(structuredResponse.text);
      const result = await Promise.all(posts.map(async (p: any, i: number) => ({
        ...p,
        id: i + 1,
        image: await getWikipediaImage(p.location),
        isLiked: false,
        isSaved: false,
      })));

      localStorage.setItem(cacheKey, JSON.stringify({ data: result, timestamp: Date.now() }));
      return result;
    } catch (e: any) {
      return handleGeminiError(e, [
        { id: 'mock1', platform: 'Instagram', author: '@travel_guru', image: 'https://loremflickr.com/600/400/beach', caption: 'Beautiful beach day! 🏖️', likes: '1.2k', location: 'Beach', comments: '50', isLiked: false, isSaved: false },
        { id: 'mock2', platform: 'TikTok', author: '@city_explorer', image: 'https://loremflickr.com/600/400/city', caption: 'Exploring the city! 🏙️', likes: '3.5k', location: 'City', comments: '120', isLiked: false, isSaved: false },
        { id: 'mock3', platform: 'Instagram', author: '@mountain_lover', image: 'https://loremflickr.com/600/400/mountain', caption: 'Mountain views! 🏔️', likes: '2.8k', location: 'Mountain', comments: '85', isLiked: false, isSaved: false },
      ], "local social inspiration");
    }
  },

  async getSpotPlan(spotName: string, destination: string): Promise<string> {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Create an extremely concise, easy-to-read "mini-plan" for visiting ${spotName} in ${destination}. 
        Keep it very short and punchy. Use bullet points.
        Include:
        - 🕒 Best time to visit
        - ⏳ Recommended duration
        - ✨ Top 2 things to do
        - 💡 Pro Tip
        Format with Markdown. Do not use large headers, keep it compact.`,
        config: {
          }
      });
      return response.text;
    } catch (e) {
      return handleGeminiError(e, "Mini-plan not available.", "getting spot plan");
    }
  },

  async getSavedSpotDetails(spotName: string): Promise<{ shortDescription: string, keywords: string[], newThings: string, upcomingEvents: string }> {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Provide detailed information about ${spotName}. Return a JSON object with four keys:
        1. "shortDescription": A concise, 2-3 sentence overview of the location.
        2. "keywords": An array of 3-5 short keywords or tags.
        3. "newThings": Recent developments or hidden gems.
        4. "upcomingEvents": Provide 2-3 specific upcoming events or recurring seasonal events at or near this location, including basic details (dates, what to expect). Format this beautifully with markdown bullet points.
        Ensure the response is valid JSON.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              shortDescription: { type: Type.STRING },
              keywords: { 
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              newThings: { type: Type.STRING },
              upcomingEvents: { type: Type.STRING }
            },
            required: ["shortDescription", "keywords", "newThings", "upcomingEvents"]
          }
        }
      });
      
      return JSON.parse(response.text);
    } catch (e) {
      return handleGeminiError(e, {
        shortDescription: "Information not available.",
        keywords: [],
        newThings: "Information not available.",
        upcomingEvents: "Information not available."
      }, "getting saved spot details");
    }
  }
};

