'use client';

import React, { FormEvent, useState } from 'react';

const HomePage: React.FC = () => {
  const [urls, setUrls] = useState('');
  const [studentProfile, setStudentProfile] = useState('');
  const [goal, setGoal] = useState('');
  const [generatedEmail, setGeneratedEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault(); // don't reload the page
  
    setLoading(true);
    setError(null);
    setGeneratedEmail('');
  
    try {
      // Turn the textarea into an array of URLs
      const urlList = urls
        .split('\n')
        .map((u: string) => u.trim())
        .filter((u: string) => Boolean(u) && u.length > 0)
        .map((u: string) => u.startsWith('http://') || u.startsWith('https://') ? u : `https://${u}`);
  
      // Call our TypeScript backend route
      const res = await fetch('/api/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: urlList,
          studentProfile,
          goal,
        }),
      });
  
      // If backend responded with an error status, throw
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = data && data.error ? data.error : 'Request failed';
        throw new Error(msg);
      }
  
      // Parse the JSON { email: "..." }
      const data: { email: string } = await res.json();
  
      // Put the email into state so it shows up in the textarea
      setGeneratedEmail(data.email);
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }
  

  return (
    <main style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center' }}>
      <div style={{ maxWidth: 800, width: '100%', padding: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>
          Personalized Cold Email Generator
        </h1>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <label style={{ fontWeight: 600 }}>Profile URLs (one per line)</label>
            <textarea
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              rows={3}
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
              placeholder={`https://cs.vt.edu/people/professor-page\nhttps://www.linkedin.com/in/...`}
            />
          </div>

          <div>
            <label style={{ fontWeight: 600 }}>Your background</label>
            <textarea
              value={studentProfile}
              onChange={(e) => setStudentProfile(e.target.value)}
              rows={3}
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
              placeholder="I'm a first-year CMDA student at Virginia Tech interested in..."
            />
          </div>

          <div>
            <label style={{ fontWeight: 600 }}>Goal of the email</label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={2}
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
              placeholder="Ask about potential research opportunities for Summer 2026..."
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '0.5rem 1rem',
              fontWeight: 600,
              cursor: loading ? 'default' : 'pointer',
            }}
          >
            {loading ? 'Generating...' : 'Generate Email'}
          </button>
        </form>

        {error && (
          <p style={{ color: 'red', marginTop: '1rem' }}>
            Error: {error}
          </p>
        )}

        {generatedEmail && (
          <div style={{ marginTop: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Generated Email
            </h2>
            <textarea
              value={generatedEmail}
              onChange={(e) => setGeneratedEmail(e.target.value)}
              rows={10}
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>
        )}
      </div>
    </main>
  );
};

export default HomePage;
