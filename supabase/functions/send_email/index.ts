const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ADMIN_EMAIL    = Deno.env.get("ADMIN_EMAIL");
const FROM_EMAIL     = Deno.env.get("FROM_EMAIL") ?? "onboarding@resend.dev";

interface Payload {
  session_id:  string;
  ime_prezime: string;
  clock_in:    string;
  clock_out:   string;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!RESEND_API_KEY || !ADMIN_EMAIL) {
    return new Response("Missing RESEND_API_KEY or ADMIN_EMAIL", { status: 500 });
  }

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString("hr-HR", {
      timeZone:  "Europe/Zagreb",
      day:       "2-digit",
      month:     "2-digit",
      year:      "numeric",
      hour:      "2-digit",
      minute:    "2-digit",
    });

  const res = await fetch("https://api.resend.com/emails", {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from:    FROM_EMAIL,
      to:      [ADMIN_EMAIL],
      subject: `Sesija automatski zatvorena — ${payload.ime_prezime}`,
      html: `
        <p>Sesija zaposlenika <strong>${payload.ime_prezime}</strong>
           automatski je zatvorena nakon 12 sati bez odjave.</p>
        <table>
          <tr><td><strong>Dolazak:</strong></td><td>${formatTime(payload.clock_in)}</td></tr>
          <tr><td><strong>Odjava (auto):</strong></td><td>${formatTime(payload.clock_out)}</td></tr>
        </table>
        <p>Molimo provjerite sesiju u dashboardu i ispravite po potrebi.</p>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return new Response(`Resend error: ${body}`, { status: 502 });
  }

  return new Response("OK", { status: 200 });
});
