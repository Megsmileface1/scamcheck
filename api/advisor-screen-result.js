export default async function handler(req, res) {
  res.setHeader("Content-Type", "text/xml");

  const digits = req.body.Digits || "";

  if (digits === "1") {
    return res.status(200).send(`
      <Response>
      </Response>
    `);
  }

  return res.status(200).send(`
    <Response>
      <Hangup/>
    </Response>
  `);
}
