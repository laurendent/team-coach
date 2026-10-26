// Vercel serverless function. The OpenAI key lives in an env var (OPENAI_API_KEY), never in the browser.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(500).json({ error: 'Server is missing OPENAI_API_KEY.' });

  const { transcript = '', stats = [], context = '' } = req.body || {};
  if (transcript.length < 50) return res.status(400).json({ error: 'Transcript is too short.' });
  if (transcript.length > 30000) return res.status(400).json({ error: 'Transcript too long (30,000 character limit).' });

  const system = `You are an expert team coach grounded in team-process research: Woolley et al. (equal conversational turn-taking predicts collective intelligence), Edmondson (psychological safety), process loss and social loafing (Steiner; Latané), and team charter norms.
You get a meeting transcript, computed participation stats, and optional extra context (team charter, Breakout Learning feedback).
Respond ONLY with JSON in this shape:
{"summary":"2-3 sentences on how the team worked together",
"observations":[{"title":"short","evidence":"quote or stat from the transcript","concept":"course concept it relates to"}],
"leader_actions":[{"action":"specific, doable next step for the team leader","why":"link to concept"}],
"individual_tips":[{"person":"name","tip":"tailored suggestion"}],
"charter_check":"if context was given, how behavior matched or violated it; otherwise empty string"}
Give 3-4 observations, 3 leader actions, and one tip per speaker. Be specific, cite the transcript, and be constructive.`;

  const user = `PARTICIPATION STATS:\n${JSON.stringify(stats)}\n\nEXTRA CONTEXT:\n${context || '(none)'}\n\nTRANSCRIPT:\n${transcript}`;

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        temperature: 0.4,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }]
      })
    });
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: data.error?.message || 'OpenAI request failed.' });
    return res.status(200).json(JSON.parse(data.choices[0].message.content));
  } catch (e) {
    return res.status(500).json({ error: 'Could not get coaching: ' + e.message });
  }
}
