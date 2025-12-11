// API endpoint for generating conversation titles using LLM
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    console.log('[GenerateTitle] Generating title for message:', message.substring(0, 50));

    // Use OpenAI to generate a concise title
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that generates short, descriptive titles for conversations. Generate a 3-5 word title that captures the main topic or question. Do not use quotes. Just return the title text.',
        },
        {
          role: 'user',
          content: `Generate a short title (3-5 words) for a conversation that starts with: "${message}"`,
        },
      ],
      temperature: parseFloat(process.env.TITLE_GENERATION_TEMPERATURE || '0.7'),
      max_tokens: parseInt(process.env.TITLE_GENERATION_MAX_TOKENS || '20', 10),
    });

    let title = response.choices[0]?.message?.content?.trim() || 'New Conversation';

    // Remove quotes if present
    title = title.replace(/^["']|["']$/g, '');

    // Capitalize first letter
    title = title.charAt(0).toUpperCase() + title.slice(1);

    // Limit to configurable max length
    const maxLength = parseInt(process.env.CONVERSATION_TITLE_MAX_LENGTH || '50', 10);
    if (title.length > maxLength) {
      title = title.substring(0, maxLength - 3) + '...';
    }

    console.log('[GenerateTitle] Generated title:', title);

    return NextResponse.json({ title }, { status: 200 });
  } catch (error) {
    console.error('[GenerateTitle] Error:', error);

    // Fallback: just capitalize and truncate the original message
    const { message } = await req.json().catch(() => ({ message: 'New Conversation' }));
    const fallbackTitle = message.charAt(0).toUpperCase() + message.slice(1, 47);

    return NextResponse.json({ title: fallbackTitle }, { status: 200 });
  }
}
