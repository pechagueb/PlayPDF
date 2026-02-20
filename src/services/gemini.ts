import { GoogleGenAI, Type } from "@google/genai";
import { Score } from "../types";

const SYSTEM_INSTRUCTION = `You are an expert music transcriptionist. 
Your task is to analyze images of music scores or guitar tabs and convert them into a structured JSON format.
The output must be a valid JSON object following this schema:
{
  "title": "Song Title",
  "bpm": 120,
  "notes": [
    { "pitch": "E4", "time": 0, "duration": 0.5 },
    { "pitch": "G4", "time": 0.5, "duration": 0.5 }
  ]
}
- "pitch" should be in scientific pitch notation (e.g., C4, F#3, Bb2).
- "time" is the start time in beats (0-indexed).
- "duration" is the length in beats.
- For guitar tabs, translate the string and fret into the correct pitch.
- Be as accurate as possible with timing and pitch.
- If multiple notes are played at the same time (chords), they should have the same "time" value.`;

export async function parseScoreFromImages(base64Images: string[]): Promise<Score> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  
  const imageParts = base64Images.map(data => ({
    inlineData: {
      mimeType: "image/png",
      data
    }
  }));

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          ...imageParts,
          { text: "Transcribe this music score/guitar tab into the specified JSON format. Include all notes from all pages provided." }
        ]
      }
    ],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          bpm: { type: Type.NUMBER },
          notes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                pitch: { type: Type.STRING },
                time: { type: Type.NUMBER },
                duration: { type: Type.NUMBER }
              },
              required: ["pitch", "time", "duration"]
            }
          }
        },
        required: ["title", "bpm", "notes"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from Gemini");
  
  return JSON.parse(text) as Score;
}
