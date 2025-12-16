import { GoogleGenAI, Type, Schema } from "@google/genai";
import { PageStatus } from "../types";

// Helper to delay execution (rate limiting)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const checkUsernameWithGemini = async (username: string): Promise<{ pageStatus: PageStatus; notes: string; profileUrl?: string }> => {
  // Use environment variable if available, otherwise use the injected key from user request
  const apiKey = process.env.API_KEY || "AIzaSyDwZcZStY76OxZCNmtOxxrt5RtHhzcz_kU";

  if (!apiKey) {
    throw new Error("API Key is missing. Please set the API Key.");
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    // We use Google Search grounding to check if the page exists.
    // This is an indirect method because we cannot scrape Instagram directly from the browser due to CORS.
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Perform a Google Search to check if the Instagram username "${username}" has an active profile page. 
      Specifically look for a result with the URL "https://www.instagram.com/${username}/". 
      
      If you find a direct profile link that looks active/valid in the search results, the Page is OPEN (Taken).
      If the search results suggest the page is "Page Not Found", "Broken Link", or if there is absolutely no trace of this specific handle as a user profile, the Page is CLOSED (Available).
      
      Provide a brief reasoning in 'notes'.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            pageStatus: {
              type: Type.STRING,
              enum: ["OPEN", "CLOSED"],
              description: "OPEN if the profile page exists (username taken), CLOSED if not found (username likely available).",
            },
            notes: {
              type: Type.STRING,
              description: "A short explanation of why this conclusion was reached based on search snippets.",
            },
            profileUrl: {
              type: Type.STRING,
              description: "The URL of the profile if found.",
            }
          },
          required: ["pageStatus", "notes"],
        } as Schema,
      },
    });

    const text = response.text;
    if (!text) return { pageStatus: PageStatus.UNKNOWN, notes: "No response from AI" };

    const result = JSON.parse(text);
    return {
      pageStatus: result.pageStatus === 'OPEN' ? PageStatus.OPEN : PageStatus.CLOSED,
      notes: result.notes,
      profileUrl: result.profileUrl
    };

  } catch (error) {
    console.error(`Error checking ${username}:`, error);
    return { pageStatus: PageStatus.UNKNOWN, notes: "Error during AI check" };
  }
};

export { checkUsernameWithGemini };