import { GoogleGenAI, Type } from "@google/genai";
import { WatermarkDetectionResponse } from "../types";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Resizes an image base64 string to a max dimension for faster AI processing
 */
async function resizeImage(base64: string, maxDim = 1024): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxDim) {
          height *= maxDim / width;
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width *= maxDim / height;
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      // Use higher quality for detection/editing
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      resolve({
        base64: dataUrl.split(',')[1],
        mimeType: 'image/jpeg'
      });
    };
    // Ensure we handle different image formats correctly for resizing
    if (base64.startsWith('data:')) {
      img.src = base64;
    } else {
      img.src = `data:image/jpeg;base64,${base64}`;
    }
  });
}

/**
 * Helper to retry AI calls with exponential backoff
 */
/**
 * Helper to retry AI calls with exponential backoff and fallback model
 */
async function retryWithBackoff<T>(fn: (modelName: string) => Promise<T>, primaryModel: string, fallbackModel: string, maxRetries = 4): Promise<T> {
  let delay = 2000;
  let currentModel = primaryModel;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn(currentModel);
    } catch (error: any) {
      const errorStr = JSON.stringify(error).toLowerCase();
      const isRateLimit = errorStr.includes('429') || errorStr.includes('resource_exhausted') || errorStr.includes('high demand');
      const isNotFound = errorStr.includes('404') || errorStr.includes('not_found');
      
      if ((isRateLimit || isNotFound) && i < maxRetries - 1) {
        const failingModel = currentModel;
        if (isNotFound || i >= 1) {
          currentModel = fallbackModel;
        }
        const reason = isNotFound ? "Model not found" : "Rate limit hit";
        console.warn(`${reason} on ${failingModel}. Retrying with ${currentModel} in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      throw error;
    }
  }
  throw new Error("Service temporarily unavailable due to high demand. Please try again in a few minutes.");
}

export async function detectWatermarks(imageBase64: string, mimeType: string, sensitivity: number = 3): Promise<WatermarkDetectionResponse> {
  const { base64: smallBase64, mimeType: smallMime } = await resizeImage(imageBase64, 800);
  
  const intensityMap = [
    "conservative (only clear, high-contrast marks)",
    "careful (standard logos and text)",
    "balanced (standard detection)",
    "sensitive (low-opacity and subtle marks)",
    "aggressive (everything that could possibly be a watermark, including central stamps)"
  ];

  const prompt = `Identify all watermarks, logos, or overlaid text intended to mark ownership in this image. 
  
  DETECTION STRENGTH: ${intensityMap[sensitivity - 1]}. 
  PAY SPECIAL ATTENTION to:
  1. Central overlays.
  2. Semi-transparent diagonal text patterns.
  3. Small corner logos.
  
  Return coordinates (ymin, xmin, ymax, xmax) normalized 0-1000.
  ONLY return JSON.`;

  try {
    const response = await retryWithBackoff(
      (modelName) => genAI.models.generateContent({
        model: modelName,
        contents: [
          {
            parts: [
              {
                inlineData: {
                  data: smallBase64,
                  mimeType: smallMime,
                },
              },
              { text: prompt },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              watermarks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    ymin: { type: Type.NUMBER },
                    xmin: { type: Type.NUMBER },
                    ymax: { type: Type.NUMBER },
                    xmax: { type: Type.NUMBER },
                  },
                  required: ["ymin", "xmin", "ymax", "xmax"],
                },
              },
            },
            required: ["watermarks"],
          },
        },
      }), 
      "gemini-3-flash-preview", 
      "gemini-3.1-flash-lite-preview"
    );

    const jsonText = response.text || "{}";
    return JSON.parse(jsonText) as WatermarkDetectionResponse;
  } catch (error) {
    console.error("Watermark detection failed:", error);
    throw error;
  }
}

export async function aiRemoveWatermarks(imageBase64: string, mimeType: string, boxes: any[]): Promise<string | null> {
  if (!boxes.length) return null;

  const { base64: optimizedBase64, mimeType: optimizedMime } = await resizeImage(imageBase64, 1024);

  const prompt = `Remove the watermarks/text at these normalized coordinates: ${JSON.stringify(boxes)}. 
  Seamlessly inpaint the removed areas using surrounding textures. Return the edited image.`;

  try {
    const response = await retryWithBackoff(
      (modelName) => genAI.models.generateContent({
        model: modelName,
        contents: [
          {
            parts: [
              {
                inlineData: {
                  data: optimizedBase64,
                  mimeType: optimizedMime,
                },
              },
              { text: prompt },
            ],
          },
        ],
      }),
      "gemini-2.5-flash-image",
      "gemini-3.1-flash-image-preview"
    );

    const candidates = response.candidates || [];
    if (!candidates.length) {
      console.error("AI removal returned no candidates");
      return null;
    }

    const parts = candidates[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    
    console.error("AI removal response contained no inlineData parts. Response parts:", parts);
    return null;
  } catch (error) {
    console.error("AI image editing failed:", error);
    return null;
  }
}




