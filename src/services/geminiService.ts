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

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isRateLimit = error.message?.includes("429") || error.status === 429 || error.code === 429;
    if (retries > 0 && isRateLimit) {
      const jitter = Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay + jitter));
      return withRetry(fn, retries - 1, delay * 2);
    } else if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay);
    }
    throw error;
  }
}

// ... (rest of the file)
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
  markerIcon?: string;
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
  async getTripSummary(trip: Trip): Promise<string> {
    try {
      const response = await withRetry(() => ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Provide a concise, engaging summary of the following trip: ${JSON.stringify(trip)}. Highlight the key spots and the overall vibe.`,
      }));
      return response.text || "No summary available.";
    } catch (e) {
      console.error("Failed to get trip summary", e);
      return "Unable to generate summary at this time.";
    }
  },

  async extractSpotsFromText(text: string): Promise<Spot[]> {
    try {
      const response = await withRetry(() => ai.models.generateContent({
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
      }));

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
      const response = await withRetry(() => ai.models.generateContent({
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
      }));

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

  async complexTripAdvice(query: string, trip: Trip | null): Promise<string> {
    try {
      const tripContext = trip ? `\n\nContext about the user's current trip: ${JSON.stringify(trip)}` : "";
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `${query}${tripContext}`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });
      
      let text = response.text || "No advice available.";
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
        contents: `Analyze the content of this social media link: ${url}. 
        Identify all travel destinations, landmarks, restaurants, or hidden gems mentioned or shown. 
        For each spot, provide:
        - name: The name of the place.
        - description: A vivid description of what makes it special.
        - category: The type of place (e.g., Restaurant, Landmark, Nature).
        - lat: Approximate latitude (if unknown, use 0).
        - lng: Approximate longitude (if unknown, use 0).
        Return a JSON array of objects. If a field is unknown, use reasonable defaults.`,
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
            { text: `Analyze this Instagram Reel/Video. 
            Identify all travel destinations, landmarks, restaurants, or hidden gems mentioned or shown. 
            For each spot, provide:
            - name: The name of the place.
            - description: A vivid description of what makes it special.
            - category: The type of place (e.g., Restaurant, Landmark, Nature).
            - lat: Approximate latitude (if unknown, use 0).
            - lng: Approximate longitude (if unknown, use 0).
            CRITICAL: Verify the location name and ensure it is a real, specific, and accurate place. If you are unsure about a place, do not include it. Return the data as a JSON array of objects.` }
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
        List the top 5 must-do activities or attractions. For each, include a relevant emoji at the start of the line (e.g., 🍴 for food, 🏔️ for nature, 🏛️ for landmarks).
        
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

  async getAllNearbyPlaces(lat: number, lng: number): Promise<Spot[]> {
    try {
      // Searching for all types of places
      const response = await withRetry(() => ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Find hotels, restaurants, and top tourist attractions near Lat: ${lat}, Lng: ${lng}. Return as a JSON array with name, description, category, lat, lng.`,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: { latitude: lat, longitude: lng }
            }
          }
        },
      }));

      const infoText = response.text;

      const structuredResponse = await withRetry(() => ai.models.generateContent({
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
      }));

      const spots = JSON.parse(structuredResponse.text);
      return Promise.all(spots.map(async (s: any) => ({
        ...s,
        id: Math.random().toString(36).substr(2, 9) + Date.now().toString(36).substr(-4),
        imageUrl: await getWikipediaImage(s.name),
        markerIcon: s.category.toLowerCase().includes('hotel') ? 'https://cdn-icons-png.flaticon.com/512/2953/2953372.png' : 
                    s.category.toLowerCase().includes('restaurant') ? 'https://cdn-icons-png.flaticon.com/512/1996/1996582.png' : undefined 
      })));
    } catch (e) {
      return handleGeminiError(e, [], "getting all nearby places");
    }
  },

  async getNearbySpots(lat: number, lng: number, category?: string): Promise<Spot[]> {
    try {
      // Step 1: Get information using Google Maps grounding with explicit location
      const response = await withRetry(() => ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Find 10 highly-rated and interesting ${category || 'travel spots, restaurants, or attractions'} near these exact coordinates: Lat: ${lat}, Lng: ${lng}. Provide a name, a detailed description, a category, and exact latitude and longitude coordinates for each.`,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: { latitude: lat, longitude: lng }
            }
          }
        },
      }));

      const infoText = response.text;

      // Step 2: Use a fast model to structure the text into JSON
      const structuredResponse = await withRetry(() => ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Extract travel spots from the following text and return them as a JSON array. For each spot, include: name, description, category, lat, and lng. Ensure the lat/lng are accurate to the location provided. Text: ${infoText}`,
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
      }));

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

  async optimizeRoute(spots: Spot[]): Promise<Spot[]> {
    try {
      const response = await withRetry(() => ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Reorder the following travel spots to create the most efficient travel route. Return the spots in the new order as a JSON array. Spots: ${JSON.stringify(spots)}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
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
                imageUrl: { type: Type.STRING },
              },
              required: ["id", "name", "description", "category", "lat", "lng"],
            },
          },
        },
      }));
      return JSON.parse(response.text);
    } catch (e) {
      console.error("Failed to optimize route", e);
      return spots; // Return original order if optimization fails
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
        contents: `Analyze this travel-related content or destination: ${infoText}. 
        Extract all mentioned locations, landmarks, restaurants, and hidden gems.
        For each place, provide a brief description, category, and why it's worth visiting.
        Return a JSON array of objects with: name, description, category, imageUrl (use a placeholder if unknown).`,
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
                imageUrl: { type: Type.STRING },
              },
              required: ["name", "description", "category", "imageUrl"],
            },
          },
        },
      });

      const spots = JSON.parse(structuredResponse.text);
      const result = await Promise.all(spots.map(async (s: any, i: number) => ({
        ...s,
        id: i + 1,
        imageUrl: s.imageUrl || await getWikipediaImage(s.name),
      })));

      localStorage.setItem(cacheKey, JSON.stringify({ data: result, timestamp: Date.now() }));
      return result;
    } catch (e: any) {
      return handleGeminiError(e, [
        { id: 'mock1', name: 'Beach', description: 'Beautiful beach', category: 'Nature', imageUrl: 'https://loremflickr.com/600/400/beach' },
        { id: 'mock2', name: 'City', description: 'Exploring the city', category: 'City', imageUrl: 'https://loremflickr.com/600/400/city' },
        { id: 'mock3', name: 'Mountain', description: 'Mountain views', category: 'Nature', imageUrl: 'https://loremflickr.com/600/400/mountain' },
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

  async getSpotDetails(spotName: string, destination: string): Promise<{ openingHours: string, reviews: string[], insights: string }> {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Provide detailed information about ${spotName} in ${destination}. Return a JSON object with:
        1. "openingHours": A string describing the opening hours.
        2. "reviews": An array of 3-5 strings representing community reviews.
        3. "insights": A brief, 2-3 sentence AI-generated insight about the spot.
        Ensure the response is valid JSON.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              openingHours: { type: Type.STRING },
              reviews: { 
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              insights: { type: Type.STRING }
            },
            required: ["openingHours", "reviews", "insights"]
          }
        }
      });
      
      return JSON.parse(response.text);
    } catch (e) {
      return handleGeminiError(e, {
        openingHours: "Information not available.",
        reviews: [],
        insights: "Information not available."
      }, "getting spot details");
    }
  }
};

