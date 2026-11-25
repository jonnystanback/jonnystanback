// Vercel function: receives the "Ask a question" form from a Field Notes
// issue and emails it to Jonny through Resend.
//
// Needs one environment variable in Vercel (Project → Settings → Environment
// Variables): RESEND_API_KEY. Optional: QUESTION_TO (defaults to
// hello@jonnystanback.com) and QUESTION_FROM.

const TO = process.env.QUESTION_TO || 'hello@jonnystanback.com';
const FROM = process.env.QUESTION_FROM || 'Field Notes <hello@jonnystanback.com>';

const clean = (v, max) => String(v ?? '').trim().slice(0, max);

export async function POST(request) {
  const wantsJson = (request.headers.get('accept') || '').includes('application/json');
  const reply = (status, message, issue) => {
    if (wantsJson) return Response.json({ ok: status < 300, message }, { status });
    // No JavaScript: send the reader back to the issue they came from.
    const back = /^\d{3}$/.test(issue || '') ? `/inthefield/${issue}` : '/inthefield';
    return Response.redirect(new URL(`${back}${status < 300 ? '?asked=1' : ''}#ask`, request.url), 303);
  };

  let form;
  try {
    form = await request.formData();
  } catch {
    return reply(400, 'Could not read the form.');
  }

  const issue = clean(form.get('issue'), 3);
  // Honeypot: real people never see this field.
  if (clean(form.get('website'), 200)) return reply(200, 'Thanks!', issue);

  const name = clean(form.get('name'), 120);
  const city = clean(form.get('city'), 120);
  const country = clean(form.get('country'), 120);
  const question = clean(form.get('question'), 4000);
  if (!name || !question) return reply(400, 'Please add your name and a question.', issue);

  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set');
    return reply(500, 'Questions are not set up yet.', issue);
  }

  const where = [city, country].filter(Boolean).join(', ') || 'somewhere';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: [TO],
      subject: `Field Notes ${issue || ''} question from ${name} (${where})`.replace(/\s+/g, ' '),
      text: `${question}\n\n— ${name}, ${where}\nAsked on Field Notes No. ${issue || '?'}`,
    }),
  });

  if (!res.ok) {
    console.error('Resend error', res.status, await res.text());
    return reply(502, 'Could not send right now.', issue);
  }
  return reply(200, 'Thanks!', issue);
}
