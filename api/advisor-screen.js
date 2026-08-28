export default async function handler(req, res) {
  res.setHeader("Content-Type", "text/xml");

  return res.status(200).send(`
    <Response>
      <Gather
        input="dtmf"
        numDigits="1"
        timeout="5"
        action="/api/advisor-screen-result"
        method="POST"
      >
        <Say>
          ScamCheck consultation. Press 1 to accept this call.
        </Say>
      </Gather>

      <Hangup/>
    </Response>
  `);
}
