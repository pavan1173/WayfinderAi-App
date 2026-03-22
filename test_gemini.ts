import { GoogleGenAI } from "@google/genai";

async function test() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: "Find an image of the Eiffel Tower.",
    config: {
      tools: [{ googleSearch: {} }],
    },
  });
  console.log(response.text);
  console.log(JSON.stringify(response.candidates?.[0]?.groundingMetadata?.groundingChunks, null, 2));
}
test();
