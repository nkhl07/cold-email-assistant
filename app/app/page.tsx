'use client';

import React, { FormEvent, useState } from 'react';

const HomePage: React.FC = () => {
  const [urls, setUrls] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [goal, setGoal] = useState('');
  const [generatedEmail, setGeneratedEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    // Validation
    if (!pdfFile) {
      setError('Please upload your resume/CV as a PDF');
      return;
    }

    // File size validation (5MB limit)
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (pdfFile.size > MAX_FILE_SIZE) {
      setError('PDF file size must be under 5MB');
      return;
    }

    setLoading(true);
    setError(null);
    setGeneratedEmail('');

    try {
      const urlList = urls
        .split('\n')
        .map((u: string) => u.trim())
        .filter((u: string) => Boolean(u) && u.length > 0)
        .map((u: string) =>
          u.startsWith('http://') || u.startsWith('https://') ? u : `https://${u}`,
        );

      // Create FormData instead of JSON
      const formData = new FormData();
      formData.append('pdf', pdfFile);
      formData.append('urls', JSON.stringify(urlList));
      formData.append('goal', goal);

      const res = await fetch('/api/generate-email', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = data && data.error ? data.error : 'Request failed';
        throw new Error(msg);
      }

      const data: { email: string } = await res.json();
      setGeneratedEmail(data.email);
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <div className="page__glow page__glow--one" />
      <div className="page__glow page__glow--two" />

      <div className="shell">
        <header className="nav">
          <div className="brand">
            <div className="brand__mark">CE</div>
            <div>
              <p className="brand__title">Emaily</p>
            </div>
          </div>
          <span className="pill pill--accent">Beta</span>
        </header>

        <section className="hero">
          <div className="hero__copy">
            <p className="eyebrow">Outreach like never before for students & researchers</p>
            <h1 className="hero__title">
              Write cold emails faster with the context that matters.
            </h1>
            <p className="hero__lede">
              Paste profile links, your background, and the goal of the conversation. We stitch it
              together into a crisp, human email that actually gets a reply.
            </p>
            <div className="pill-row">
              <span className="pill">Research outreach</span>
              <span className="pill">Coffee chats</span>
              <span className="pill">Internship intros</span>
            </div>
          </div>

          <div className="card">
            <div className="card__header">
              <div>
                <p className="card__eyebrow">Your workspace</p>
                <p className="card__title">Shape the context</p>
              </div>
              <span className="pill pill--subtle">{loading ? 'Working...' : 'Ready'}</span>
            </div>

            <form onSubmit={handleSubmit} className="form">
              <div className="field">
                <label className="field__label">Profile URLs (one per line)</label>
                <textarea
                  value={urls}
                  onChange={(e) => setUrls(e.target.value)}
                  rows={5}
                  className="input input--textarea"
                  placeholder={`https://example.com/profile
https://linkedin.com/in/username
https://scholar.google.com/citations?user=...
(Paste multiple URLs, one per line)`}
                />
              </div>

              <div className="field">
                <label className="field__label">Resume/CV (PDF only)</label>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && file.type === 'application/pdf') {
                      setPdfFile(file);
                      setError(null);
                    } else if (file) {
                      setError('Please upload a PDF file only');
                      e.target.value = '';
                      setPdfFile(null);
                    }
                  }}
                  className="input input--file"
                />
                {pdfFile && (
                  <span className="file-info">
                    Selected: {pdfFile.name} ({(pdfFile.size / 1024).toFixed(1)} KB)
                  </span>
                )}
              </div>

              <div className="field">
                <label className="field__label">Goal of the email</label>
                <textarea
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  rows={2}
                  className="input input--textarea"
                  placeholder="Ask about potential internship opportunities for Summer 2026..."
                />
              </div>

              <div className="actions">
                {error && <span className="error">Error: {error}</span>}
                <button type="submit" disabled={loading} className="button">
                  {loading ? 'Generating...' : 'Generate email'}
                </button>
              </div>
            </form>
          </div>
        </section>

        {generatedEmail && (
          <section className="output">
            <div className="card">
              <div className="card__header">
                <div>
                  <p className="card__eyebrow">Output</p>
                  <p className="card__title">Crafted email</p>
                </div>
                <span className="pill pill--accent">Polished draft</span>
              </div>
              <textarea
                value={generatedEmail}
                onChange={(e) => setGeneratedEmail(e.target.value)}
                rows={12}
                className="input input--textarea output__textarea"
              />
            </div>
          </section>
        )}
      </div>
    </main>
  );
};

export default HomePage;
