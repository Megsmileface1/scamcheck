export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  res.setHeader("Content-Type", "application/xml");

  return res.status(200).send(`
    <Response>
      <Speak>
        ScamCheck consultation. Press 1 to accept this call.
      </Speak>
    </Response>
  `);
}
