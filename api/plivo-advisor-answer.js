export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const paymentId =
    req.query.paymentId || "";

  const consultationId =
    req.query.consultationId || "";

  const roomId =
    req.query.roomId || "";

  const prepaid =
    req.query.prepaid === "1";

  if (!consultationId || !roomId) {
    res.setHeader(
      "Content-Type",
      "application/xml"
    );

    return res.status(200).send(`
      <Response>
        <Speak>
          We are sorry. This ScamCheck consultation cannot be connected.
        </Speak>
        <Hangup/>
      </Response>
    `);
  }

  const params = new URLSearchParams({
    paymentId,
    consultationId,
    roomId,
    prepaid: prepaid ? "1" : "0"
  });

  const actionUrl =
    `https://askscamcheck.com/api/plivo-advisor-accept?${params.toString()}`;

  res.setHeader(
    "Content-Type",
    "application/xml"
  );

  return res.status(200).send(`
    <Response>
      <GetDigits
        action="${actionUrl.replace(/&/g, "&amp;")}"
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
