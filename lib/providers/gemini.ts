// Gemini REST API (generateContent)

import { postJson, ProviderError } from './http';
import { GenerateRequest } from './generate';

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; thought?: boolean }> };
  }>;
  promptFeedback?: { blockReason?: string };
}

export async function generateWithGeminiApi({ model, apiKey, prompt }: GenerateRequest): Promise<string> {
  const response = await postJson<GeminiResponse>(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    { contents: [{ role: 'user', parts: [{ text: prompt }] }] },
    { 'x-goog-api-key': apiKey }
  );

  if (response.promptFeedback?.blockReason) {
    throw new ProviderError(`Gemini blocked the request: ${response.promptFeedback.blockReason}`);
  }

  return (response.candidates?.[0]?.content?.parts || [])
    .filter((part) => !part.thought)
    .map((part) => part.text || '')
    .join('')
    .trim();
}
