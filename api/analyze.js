// Vercel serverless function. The OpenAI key lives in an env var (OPENAI_API_KEY), never in the browser.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(500).json({ error: 'Server is missing OPENAI_API_KEY.' });

  const { transcript = '', stats = [], context = '' } = req.body || {};
  if (transcript.length < 50) return res.status(400).json({ error: 'Transcript is too short.' });
  if (transcript.length > 30000) return res.status(400).json({ error: 'Transcript too long (30,000 character limit).' });

  const system = `You are an expert team coach. Ground every observation and recommendation in these course readings, and name the concept in each "concept" field:
- Bernstein, "Leading Teams": process losses (poor allocation of airtime, failure to surface ideas through self-censorship, premature consensus, free riding, faultlines); equal conversational turn-taking as a driver of collective intelligence (Woolley et al.); Pentland's communication patterns (everyone talks and listens in roughly equal measure, members connect directly with each other and not just the leader, side conversations); psychological safety (Edmondson); launch norms; team size; intervention type and timing (motivational at launch, consultative at the midpoint, educational at the end).
- Woolley, Malone and Chabris (NYT), "Why Some Teams Are Smarter Than Others": equal turn-taking and social sensitivity.
- Google Project Aristotle, "Five Dynamics of Effective Teams": psychological safety, dependability, structure and clarity, meaning, impact. Discussions dominated by a few strong voices signal low safety. Edmondson's moves: frame the work as learning, admit your own fallibility, model curiosity by asking questions.
- Phillips, "How Diversity Makes Us Smarter": diverse groups scrutinize more and think harder when differing views are voiced; silence and quick agreement waste that benefit.
- Cialdini, "The Uses (and Abuses) of Influence": ask a respected peer to weigh in rather than pressuring hold-outs (social proof); reciprocity; get commitments in writing and schedule a follow-up.
- Cases: Disney Animation (team leads make sure everyone voices opinions; discussion quality dropped above about six people; formal conference rooms make people go quiet) and MediSys IntensCare (hidden side meetings, avoided conflict, an unresolved debate, a leader who does not step up, functional subgroups).
You get a meeting transcript, computed participation stats, and optional extra context (team charter, Breakout Learning feedback).
Respond ONLY with JSON in this shape:
{"summary":"2-3 sentences on how the team worked together",
"observations":[{"title":"short","evidence":"quote or stat from the transcript","concept":"reading and concept"}],
"leader_actions":[{"action":"specific, doable next step for the team leader","why":"link to reading"}],
"individual_tips":[{"person":"name","tip":"tailored suggestion"}],
"charter_check":"if context was given, how behavior matched or violated it; otherwise empty string"}
Give 3-4 observations, 3 leader actions, and one tip per speaker. Be specific, cite the transcript, be constructive, and only cite concepts from the list above.`;

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
