export default async function handler(req, res) {
  res.setHeader("Content-Type", "text/xml");

  const paymentId = req.query.paymentId || "";
  const prepaid = req.query.prepaid === "1";
  const consultationId = req.query.consultationId || "";

  const resultUrl = prepaid
    ? `https://scamcheck-lac.vercel.app/api/advisor-screen-result?prepaid=1&consultationId=${encodeURIComponent(consultationId)}`
    : `https://scamcheck-lac.vercel.app/api/advisor-screen-result?paymentId=${encodeURIComponent(paymentId)}`;

  return res.status(200).send(`
    <Response>
      <Gather
        input="dtmf"
        numDigits="1"
        timeout="5"
        actionOnEmptyResult="true"
        action="${resultUrl}"
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
