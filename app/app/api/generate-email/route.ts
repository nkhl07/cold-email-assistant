import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SCRAPER_BASE_URL =
  process.env.SCRAPER_BASE_URL ?? 'http://127.0.0.1:8000';

export async function POST(req: Request) {
  try {
    // Parse FormData instead of JSON
    const formData = await req.formData();

    const pdfFile = formData.get('pdf') as File | null;
    const urlsJson = formData.get('urls') as string | null;
    const goal = formData.get('goal') as string | null;

    // Validation
    if (!pdfFile) {
      return NextResponse.json(
        { error: 'PDF file is required' },
        { status: 400 }
      );
    }

    if (!pdfFile.type.includes('pdf')) {
      return NextResponse.json(
        { error: 'Only PDF files are allowed' },
        { status: 400 }
      );
    }

    // File size validation (5MB)
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (pdfFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'PDF file size must be under 5MB' },
        { status: 400 }
      );
    }

    const urls = urlsJson ? JSON.parse(urlsJson) : [];
    const goalText = goal || '';

    // Create new FormData for Python scraper
    const scraperFormData = new FormData();
    scraperFormData.append('pdf', pdfFile);
    scraperFormData.append('urls', JSON.stringify(urls));

    // Call Python scraper with PDF
    const scraperRes = await fetch(`${SCRAPER_BASE_URL}/process`, {
      method: 'POST',
      body: scraperFormData,
    });

    if (!scraperRes.ok) {
      const errorText = await scraperRes.text().catch(() => 'Unknown error');
      throw new Error(
        `Scraper returned status ${scraperRes.status}: ${errorText}`
      );
    }

    const scraped = (await scraperRes.json()) as {
      combined_text: string;
      student_profile: string;
    };

    const combinedText = scraped.combined_text;
    const studentProfile = scraped.student_profile;

    const cleanedText = combinedText.replace(/\s+/g, ' ').slice(0, 6000);
    const cleanedProfile = studentProfile.replace(/\s+/g, ' ').slice(0, 3000);

    // Call OpenAI with extracted PDF text
    const systemPrompt = `
You help a college student write concise, engaging cold emails to professors or professionals.
The emails should:
- Start with a 1-sentence introduction: student's name, year, and major.
- Be 100–150 words maximum (shorter is better).
- Reference 1 specific detail from the recipient's work that genuinely interests the student.
- Mention 1 relevant project or experience from the student's resume that connects to the recipient's work.
- Sound conversational and genuine, not overly formal or robotic.
- Get straight to the point - no fluff or generic statements.
- Mention "I've attached my resume" naturally in the email.
- End with a casual, direct ask for a quick chat. Examples:
  * "Would you be open to a quick 15-minute call to chat about how I might contribute?"
  * "Could we do a quick 15-minute chat to see if there's a fit?"
- Vary the wording but keep it natural, brief, and low-pressure.
- Avoid phrases like "I hope this finds you well" or "I am writing to inquire".
- Skip overly formal sign-offs - just use the student's name.
`.trim();

    const userPrompt = `
TARGET PROFILE TEXT (scraped from their page/links):
${cleanedText}

STUDENT BACKGROUND (extracted from resume/CV):
${cleanedProfile}

STUDENT GOAL:
${goalText}

Write a concise, engaging cold email. Be direct and genuine.
Do NOT invent achievements for the student.
Skip generic pleasantries and get to the point quickly.
`.trim();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
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
      { status: 500 }
    );
  }
}
