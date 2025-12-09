import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';

type GenerateRequestBody = {
  urls: string[];
  studentProfile: string;
  goal: string;
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SCRAPER_BASE_URL =
  process.env.SCRAPER_BASE_URL ?? 'http://127.0.0.1:8000';

export async function POST(req: Request) {
  let body: Partial<GenerateRequestBody> = {};
  try {
    body = await req.json();
  } catch {
    // leave body as {}
  }

  const { urls = [], studentProfile = '', goal = '' } = body;

  try {
    // ---- call Python scraper ----
    const scraperRes = await fetch(`${SCRAPER_BASE_URL}/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls }),
    });

    if (!scraperRes.ok) {
      throw new Error(`Scraper returned status ${scraperRes.status}`);
    }

    const scraped = (await scraperRes.json()) as { combined_text: string };
    const combinedText = scraped.combined_text;

    const cleanedText = combinedText.replace(/\s+/g, ' ').slice(0, 6000);

    // ---- call OpenAI ----
    const systemPrompt = `
You help a college student write short, personalized cold emails to professors or professionals.
The emails should:
- Be 150–220 words.
- Reference 1–2 specific topics from the person's profile text.
- Clearly say why the student is reaching out.
- Ask for a concrete next step (e.g., quick call, asking about research).
- Sound natural for a college student.
`.trim();

    const userPrompt = `
TARGET PROFILE TEXT (scraped from their page/links):
${cleanedText}

STUDENT BACKGROUND:
${studentProfile}

STUDENT GOAL:
${goal}

Write a single cold email. 
Use a normal, respectful tone. 
Do NOT invent achievements for the student.
`.trim();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const aiEmail =
      completion.choices[0]?.message?.content?.trim() ??
      'Sorry, I could not generate an email.';

    return NextResponse.json({ email: aiEmail });
  } catch (err: any) {
    console.error('API route error:', err);
    return NextResponse.json(
      { error: err.message ?? 'Internal server error' },
      { status: 500 },
    );
  }
}
