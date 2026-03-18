import { GoogleGenAI, Type, Modality, ThinkingLevel } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
  lat?: number;
  lng?: number;
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

export const geminiService = {
  async extractSpotsFromText(text: string): Promise<Spot[]> {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: `Extract real travel spots from the following text or link description. For each spot, provide a name, a brief description, a category (e.g., Attraction, Restaurant, Cafe, Shopping, Nature), and approximate latitude and longitude coordinates. Use Google Search to verify these places exist and get accurate data. Text: ${text}`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
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

    try {
      const spots = JSON.parse(response.text);
      return spots.map((s: any) => ({
        ...s,
        id: Math.random().toString(36).substr(2, 9) + Date.now().toString(36).substr(-4),
        imageUrl: `https://picsum.photos/seed/${s.name.replace(/\s/g, '')}/400/300`,
      }));
    } catch (e) {
      console.error("Failed to parse spots", e);
      return [];
    }
  },

  async getSpotDetailsWithMaps(spotName: string, location?: { lat: number, lng: number }): Promise<Partial<Spot>> {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Find detailed Google Maps information for the travel spot: "${spotName}". Please include the official website URL, phone number, and exact latitude and longitude coordinates. Format them clearly as "Website: [URL]", "Phone: [Number]", "Lat: [Latitude]", "Lng: [Longitude]".`,
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

    const text = response.text;
    const websiteMatch = text.match(/Website:\s*(https?:\/\/[^\s\n]+)/i);
    const phoneMatch = text.match(/Phone:\s*([+\d\s()-]+)/i);
    const latMatch = text.match(/Lat:\s*(-?\d+(\.\d+)?)/i);
    const lngMatch = text.match(/Lng:\s*(-?\d+(\.\d+)?)/i);

    return {
      mapsUri,
      reviewSnippets,
      website: websiteMatch ? websiteMatch[1] : undefined,
      phone: phoneMatch ? phoneMatch[1].trim() : undefined,
      lat: latMatch ? parseFloat(latMatch[1]) : undefined,
      lng: lngMatch ? parseFloat(lngMatch[1]) : undefined,
      description: text
    };
  },

  async analyzeImageForSpots(base64Image: string): Promise<{ isAiGenerated: boolean, spots: Spot[] }> {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
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
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
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

    try {
      const result = JSON.parse(response.text);
      return {
        isAiGenerated: result.isAiGenerated,
        spots: result.spots.map((s: any) => ({
          ...s,
          id: Math.random().toString(36).substr(2, 9) + Date.now().toString(36).substr(-4),
          imageUrl: `https://picsum.photos/seed/${s.name.replace(/\s/g, '')}/400/300`,
        }))
      };
    } catch (e) {
      return { isAiGenerated: false, spots: [] };
    }
  },

  async generateSpeech(text: string): Promise<string | undefined> {
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
  },

  async complexTripAdvice(query: string): Promise<string> {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: query,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
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
  },

  async analyzeReelVideo(videoData: string, mimeType: string): Promise<Spot[]> {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: videoData
            }
          },
          { text: "Analyze this Instagram Reel/Video. Identify all travel destinations, landmarks, or spots mentioned or shown. For each spot, provide a name, a vivid description of what makes it special, a category, and approximate latitude/longitude coordinates. Return the data as a JSON array of objects." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
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

    try {
      const spots = JSON.parse(response.text);
      return spots.map((s: any) => ({
        ...s,
        id: Math.random().toString(36).substr(2, 9) + Date.now().toString(36).substr(-4),
        imageUrl: `https://picsum.photos/seed/${s.name.replace(/\s/g, '')}/400/300`,
      }));
    } catch (e) {
      console.error("Failed to parse spots from video", e);
      return [];
    }
  },

  async getFastSpotInfo(spotName: string): Promise<string> {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: `Give me a 2-sentence lightning-fast summary of why someone should visit ${spotName}. Focus on the most unique aspect.`,
    });
    return response.text;
  },

  async getDiscoverInfo(destination: string): Promise<string> {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
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
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    });
    return response.text;
  },

  async planTripFromSavedSpots(spots: Spot[], duration: number, preferences: string[]): Promise<Trip> {
    const spotsJson = JSON.stringify(spots.map(s => ({ id: s.id, name: s.name, category: s.category, lat: s.lat, lng: s.lng })));
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: `Create a ${duration}-day trip itinerary using ONLY the following saved spots: ${spotsJson}. 
      The user preferences are: ${preferences.join(', ')}.
      Suggest the best order for visiting these locations based on proximity and user preferences.
      Also provide an estimated budget (e.g., "$1500" or "Moderate") and recommend 3 nearby hotels with their name, rating, pricePerNight, description, and an image search keyword.
      Return a JSON object representing the trip.`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
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

    try {
      const data = JSON.parse(response.text);
      // Re-attach the original image URLs and full spot data
      const fullItinerary = data.itinerary.map((day: any) => ({
        day: day.day,
        spots: day.spots.map((s: any) => {
          const originalSpot = spots.find(os => os.id === s.id);
          return originalSpot ? { ...originalSpot, description: s.description } : { ...s, imageUrl: `https://picsum.photos/seed/${s.name.replace(/\s/g, '')}/400/300` };
        })
      }));
      
      const hotels = data.hotels.map((h: any) => ({
        name: h.name,
        rating: h.rating,
        pricePerNight: h.pricePerNight,
        description: h.description,
        imageUrl: `https://picsum.photos/seed/${h.imageKeyword.replace(/\s/g, '')}/400/300`
      }));

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
      console.error("Failed to parse trip from saved spots", e);
      throw e;
    }
  },

  async planItinerary(destination: string, days: number, spots: Spot[]): Promise<{ itinerary: Trip['itinerary'], budget: string, hotels: Hotel[] }> {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: `Plan a ${days}-day itinerary for ${destination} using these spots: ${spots.map(s => s.name).join(", ")}. Group them logically by day to minimize travel time. Also provide an estimated budget (e.g., "$1500" or "Moderate") and recommend 3 nearby hotels with their name, rating, pricePerNight, description, and an image search keyword.`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
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
                  spotNames: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  },
                },
                required: ["day", "spotNames"],
              },
            }
          },
          required: ["budget", "hotels", "itinerary"]
        },
      },
    });

    try {
      const data = JSON.parse(response.text);
      const itinerary = data.itinerary.map((p: any) => ({
        day: p.day,
        spots: p.spotNames.map((name: string) => spots.find(s => s.name === name) || spots[0]).filter(Boolean),
      }));
      const hotels = data.hotels.map((h: any) => ({
        name: h.name,
        rating: h.rating,
        pricePerNight: h.pricePerNight,
        description: h.description,
        imageUrl: `https://picsum.photos/seed/${h.imageKeyword.replace(/\s/g, '')}/400/300`
      }));
      return { itinerary, budget: data.budget, hotels };
    } catch (e) {
      return { itinerary: [], budget: "Unknown", hotels: [] };
    }
  },

  async getNearbySpots(lat: number, lng: number, category?: string): Promise<Spot[]> {
    // Step 1: Get information using Google Maps grounding
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Find 5 interesting ${category || 'travel spots'} near this location (Lat: ${lat}, Lng: ${lng}). For each, provide name, description, category, and exact coordinates.`,
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
      model: "gemini-3.1-flash-lite-preview",
      contents: `Extract travel spots from the following text and return them as a JSON array. For each spot, include: name, description, category, lat, and lng. Text: ${infoText}`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
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

    try {
      const spots = JSON.parse(structuredResponse.text);
      return spots.map((s: any) => ({
        ...s,
        id: Math.random().toString(36).substr(2, 9) + Date.now().toString(36).substr(-4),
        imageUrl: `https://picsum.photos/seed/${s.name.replace(/\s/g, '')}/400/300`,
      }));
    } catch (e) {
      console.error("Failed to parse nearby spots", e);
      return [];
    }
  },

  async getLocalSocialInspiration(lat: number, lng: number): Promise<any[]> {
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
      model: "gemini-3.1-flash-lite-preview",
      contents: `Based on these places: ${infoText}\n\nGenerate 3 realistic social media travel posts (like Instagram/TikTok reels). Return a JSON array. For each post, include: author (e.g. @username), location (name of the place), likes (e.g. '12.4K'), caption.`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              author: { type: Type.STRING },
              location: { type: Type.STRING },
              likes: { type: Type.STRING },
              caption: { type: Type.STRING },
            },
            required: ["author", "location", "likes", "caption"],
          },
        },
      },
    });

    try {
      const posts = JSON.parse(structuredResponse.text);
      return posts.map((p: any, i: number) => ({
        ...p,
        id: i + 1,
        image: `https://picsum.photos/seed/${p.location.replace(/\s/g, '')}/400/600`,
      }));
    } catch (e) {
      console.error("Failed to parse social posts", e);
      return [];
    }
  },

  async getSpotPlan(spotName: string, destination: string): Promise<string> {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: `Create an extremely concise, easy-to-read "mini-plan" for visiting ${spotName} in ${destination}. 
      Keep it very short and punchy. Use bullet points.
      Include:
      - 🕒 Best time to visit
      - ⏳ Recommended duration
      - ✨ Top 2 things to do
      - 💡 Pro Tip
      Format with Markdown. Do not use large headers, keep it compact.`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    });
    return response.text;
  },

  async getSavedSpotDetails(spotName: string): Promise<{ shortDescription: string, keywords: string[], newThings: string, upcomingEvents: string }> {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: `Provide detailed information about ${spotName}. Return a JSON object with four keys:
      1. "shortDescription": A concise, 2-3 sentence overview of the location.
      2. "keywords": An array of 3-5 short keywords or tags.
      3. "newThings": Recent developments or hidden gems.
      4. "upcomingEvents": Provide 2-3 specific upcoming events or recurring seasonal events at or near this location, including basic details (dates, what to expect). Format this beautifully with markdown bullet points.
      Ensure the response is valid JSON.`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
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
    
    try {
      return JSON.parse(response.text);
    } catch (e) {
      console.error("Failed to parse saved spot details", e);
      return {
        shortDescription: "Information not available.",
        keywords: [],
        newThings: "Information not available.",
        upcomingEvents: "Information not available."
      };
    }
  }
};

