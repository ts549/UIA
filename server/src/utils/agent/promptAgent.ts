import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Validate API key is loaded
if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not set in environment variables');
}

/**
 * Calls OpenAI API to analyze code and generate modification plan
 * @param contextString - Formatted string matching prompTemplate.md structure
 * @returns JSON response matching outputPrompt.md format
 */
export async function analyzeCodeWithAI(contextString: string): Promise<any> {
  try {
    // Read system prompt
    const systemPromptPath = path.join(__dirname, 'systemPrompt.md');
    const systemPrompt = await fs.readFile(systemPromptPath, 'utf-8');

    // Read output format example
    const outputPromptPath = path.join(__dirname, 'outputPrompt.md');
    const outputFormat = await fs.readFile(outputPromptPath, 'utf-8');

    // Construct the full system message with output format instructions
    const fullSystemPrompt = `${systemPrompt}

    IMPORTANT: You must respond ONLY with valid JSON matching this exact format:
    ${outputFormat}

    Do not include any markdown code blocks, explanations, or additional text. Return only the raw JSON object.`;

    // Make API call
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // or 'gpt-3.5-turbo' depending on your needs
      messages: [
        {
          role: 'system',
          content: fullSystemPrompt,
        },
        {
          role: 'user',
          content: contextString,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }, // Ensures valid JSON response
    });

    // Parse and return the response
    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No response from OpenAI API');
    }

    return JSON.parse(responseContent);
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw error;
  }
}
