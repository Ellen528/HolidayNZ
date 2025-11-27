import { GoogleGenAI } from "@google/genai";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API_KEY not found in environment variables");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const getHolidayActivities = async (holidayName: string, regionName: string): Promise<string> => {
  const ai = getClient();
  if (!ai) return "AI services unavailable. Please configure API Key.";

  try {
    const prompt = `
      Suggest 3 specific, fun, and family-friendly activities to do during ${holidayName} in the ${regionName} region of New Zealand.
      Format the output as a simple HTML unordered list (<ul><li>...</li></ul>) without markdown code blocks.
      Keep it brief and inspiring.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "No suggestions available at the moment.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Unable to load suggestions. Please try again later.";
  }
};
