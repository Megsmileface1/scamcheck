export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const paymentId = req.query.paymentId || "";
  const consultationId = req.query.consultationId || "";

  const actionUrl =
    `https://askscamcheck.com/api/plivo-advisor-accept?paymentId=${encodeURIComponent(paymentId)}&consultationId=${encodeURIComponent(consultationId)}`;

  res.setHeader("Content-Type", "application/xml");

  return res.status(200).send(`
    <Response>
      <GetDigits
        action="${actionUrl}"
        method="POST"
        numDigits="1"
        timeout="10"
        retries="1"
      >
        <Speak>
          ScamCheck consultation. Press 1 to accept this call.
        </Speak>
      </GetDigits>

      <Speak>
        The consultation was not accepted.
      </Speak>

      <Hangup/>
    </Response>
  `);
}
