import { GoogleGenAI, Modality, Type } from "@google/genai";

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const callGemini = async (prompt: string, systemInstruction: string = "") => {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      systemInstruction: systemInstruction || "Eres LONERGY AI, una inteligencia experta en longevidad extrema y optimización biológica. Responde de forma técnica, científica y motivadora.",
    },
  });
  return response.text || "No pude procesar la respuesta.";
};

export const analyzeMealAI = async (mealDescription: string) => {
  const systemInstruction = "Eres el núcleo de nutrición de LONERGY. Analiza la comida considerando impacto inflamatorio, picos de insulina y densidad nutricional para la longevidad celular.";
  const prompt = `Analiza esta comida para longevidad: "${mealDescription}". Dame un puntaje de 1-10 y una recomendación científica breve.`;
  
  return await callGemini(prompt, systemInstruction);
};

export const analyzeFoodImage = async (base64Image: string, mimeType: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: {
      parts: [
        { inlineData: { data: base64Image, mimeType } },
        { text: "Analiza este plato de comida para longevidad. Identifica los ingredientes, estima el impacto glucémico y da un puntaje LONERGY de 1-10." }
      ]
    },
    config: {
      systemInstruction: "Eres el escáner biológico de LONERGY. Tu misión es detectar compuestos pro-longevidad e inflamatorios en imágenes de alimentos."
    }
  });
  return response.text || "No se pudo analizar la imagen.";
};

export const generatePersonalizedRecipe = async (biomarkers: any[]) => {
  const latest = biomarkers[biomarkers.length - 1];
  const systemInstruction = "Eres el chef molecular de LONERGY. Creas protocolos nutricionales personalizados basados en biomarcadores de precisión.";
  const prompt = `Basado en mis últimos biomarcadores: Glucosa ${latest.glucose} mg/dL, Peso ${latest.weight} kg, Sueño ${latest.sleep}h, HRV ${latest.hrv}ms. 
  Genera una receta de cena optimizada para mejorar estos valores, siguiendo protocolos de activación de sirtuinas, densidad nutricional y bajo impacto inflamatorio. 
  Incluye: Nombre de la receta, ingredientes clave y por qué ayuda a mis biomarcadores actuales.`;
  
  return await callGemini(prompt, systemInstruction);
};

export const searchNearbyLongevityCenters = async (lat: number, lng: number) => {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: "Encuentra centros de longevidad, biohacking, saunas, crioterapia o restaurantes saludables cerca de mi ubicación.",
    config: {
      tools: [{ googleMaps: {} }],
      toolConfig: {
        retrievalConfig: {
          latLng: { latitude: lat, longitude: lng }
        }
      }
    }
  });
  
  return {
    text: response.text,
    chunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
  };
};

export const generateLongevityImage = async (prompt: string, size: "1K" | "2K" | "4K" = "1K") => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: {
      parts: [{ text: `High-end cinematic photography of ${prompt}, longevity aesthetic, clean, medical grade, 8k resolution.` }],
    },
    config: {
      imageConfig: {
        aspectRatio: "1:1",
        imageSize: size
      }
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return null;
};

export const generateHealthAudio = async (text: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Say with energy and scientific authority: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: "Puck" },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  const mimeType = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType;
  
  if (!base64Audio) return null;

  return {
    data: base64Audio,
    sampleRate: parseInt(mimeType?.split('rate=')[1] || "24000"),
  };
};
