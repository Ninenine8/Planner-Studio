import { GoogleGenAI, Type } from "@google/genai";
import { PlannerData } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please check your deployment settings or .env file.");
  }
  return new GoogleGenAI({ apiKey });
};

export const analyzeDrawings = async (base64Image: string): Promise<PlannerData> => {
  // Clean base64 string if it has prefix
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

  try {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/png",
              data: cleanBase64,
            },
          },
          {
            text: `Analyze this image of hand-drawn sketches. 
            I am creating a printable 2026 planner using these drawings.
            
            1. Extract a color palette of 5 hex codes that perfectly complements these drawings (backgrounds, accents, text).
            2. Describe the 'mood' of the drawings in one word (e.g., 'Whimsical', 'Cozy', 'Energetic').
            3. Generate 12 short, cute, or funny motivational quotes (one for each month of 2026) that match the theme of these drawings. 
               If the drawings are animals, make the quotes related to them (e.g., cat puns). Keep them under 15 words.
            `
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            palette: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Array of 5 hex color codes",
            },
            mood: {
              type: Type.STRING,
              description: "One word mood description",
            },
            monthlyQuotes: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Array of 12 quotes, one for each month",
            }
          },
          required: ["palette", "mood", "monthlyQuotes"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as PlannerData;
    }
    throw new Error("No response from Gemini");

  } catch (error) {
    console.error("Gemini analysis failed:", error);
    // Fallback data
    return {
      palette: ["#F3F4F6", "#E5E7EB", "#9CA3AF", "#4B5563", "#1F2937"],
      mood: "Cozy",
      monthlyQuotes: Array(12).fill("Make today amazing!")
    };
  }
};

export const generatePlannerBackground = async (mood: string, palette: string[]): Promise<string> => {
  try {
    const ai = getClient();
    
    // Create a descriptive prompt based on mood and palette
    const prompt = `A subtle, artistic background texture or pattern for a printable planner page.
    Style/Mood: ${mood}.
    Color Palette: ${palette.join(', ')}.
    The image should be light, high-key, pastel, and suitable for writing text over. 
    Watercolor, paper texture, or gentle doodle style. Soft edges. White space in the middle.
    Do not include text or grids.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }]
      }
    });

    // Iterate through parts to find the image
    const candidate = response.candidates?.[0];
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error("No image generated from API");
  } catch (error) {
    // Re-throw the error so the UI can display it
    throw error;
  }
};