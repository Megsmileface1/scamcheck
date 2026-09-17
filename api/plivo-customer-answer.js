export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const paymentId = req.query.paymentId || "";
  const consultationId = req.query.consultationId || "";

  const plivoNumber = process.env.PLIVO_PHONE_NUMBER;
  const advisorPhone = process.env.SCAMCHECK_ADVISOR_PHONE;

  if (!plivoNumber || !advisorPhone) {
    console.error("Missing Plivo number or advisor phone");

    res.setHeader("Content-Type", "application/xml");

    return res.status(200).send(`
      <Response>
        <Speak>
          We are sorry. ScamCheck cannot connect your call right now.
        </Speak>
        <Hangup/>
      </Response>
    `);
  }

  const actionUrl =
    `https://askscamcheck.com/api/plivo-advisor-status?paymentId=${encodeURIComponent(paymentId)}&consultationId=${encodeURIComponent(consultationId)}`;

  const confirmUrl =
    `https://askscamcheck.com/api/plivo-advisor-confirm?paymentId=${encodeURIComponent(paymentId)}&consultationId=${encodeURIComponent(consultationId)}`;

  res.setHeader("Content-Type", "application/xml");

  return res.status(200).send(`
    <Response>
      <Speak>
        Please hold while ScamCheck connects you to an advisor.
      </Speak>

      <Dial
        callerId="${plivoNumber}"
        timeout="20"
        action="${actionUrl}"
        method="POST"
        callbackUrl="${actionUrl}"
        callbackMethod="POST"
        confirmSound="${confirmUrl}"
        confirmKey="1"
        confirmTimeout="5"
      >
        <Number>${advisorPhone}</Number>
      </Dial>
    </Response>
  `);
}
