import { z } from 'zod';
import type { MCPTool } from '../mcp';

// Hugging Face Connector Tools
// Requires: HF_API_TOKEN in .env

export const hfTextGenerationTool: MCPTool = {
  name: 'hf_text_generation',
  description: 'Generate text using a Hugging Face inference model',
  inputSchema: z.object({
    model: z.string().default('mistralai/Mistral-7B-Instruct-v0.3'),
    prompt: z.string(),
    max_new_tokens: z.number().optional().default(256),
    temperature: z.number().optional().default(0.7),
  }),
  outputSchema: z.object({
    text: z.string(),
    model: z.string(),
    error: z.string().nullable(),
  }),
  handler: async (input) => {
    const token = process.env.HF_API_TOKEN;
    if (!token) throw new Error('Missing HF_API_TOKEN');

    const res = await fetch(`https://api-inference.huggingface.co/models/${input.model}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: input.prompt,
        parameters: {
          max_new_tokens: input.max_new_tokens,
          temperature: input.temperature,
        },
      }),
    });
    if (!res.ok) return { text: '', model: input.model, error: await res.text() };
    const data = await res.json();
    const text = Array.isArray(data) ? data[0]?.generated_text ?? '' : data?.generated_text ?? '';
    return { text, model: input.model, error: null };
  },
};

export const hfImageGenerationTool: MCPTool = {
  name: 'hf_image_generation',
  description: 'Generate an image from a text prompt using Hugging Face (returns base64)',
  inputSchema: z.object({
    model: z.string().default('stabilityai/stable-diffusion-xl-base-1.0'),
    prompt: z.string(),
    negative_prompt: z.string().optional(),
  }),
  outputSchema: z.object({
    imageBase64: z.string(),
    model: z.string(),
    error: z.string().nullable(),
  }),
  handler: async (input) => {
    const token = process.env.HF_API_TOKEN;
    if (!token) throw new Error('Missing HF_API_TOKEN');

    const res = await fetch(`https://api-inference.huggingface.co/models/${input.model}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: input.prompt,
        parameters: { negative_prompt: input.negative_prompt },
      }),
    });
    if (!res.ok) return { imageBase64: '', model: input.model, error: await res.text() };
    const buffer = await res.arrayBuffer();
    const imageBase64 = Buffer.from(buffer).toString('base64');
    return { imageBase64, model: input.model, error: null };
  },
};
