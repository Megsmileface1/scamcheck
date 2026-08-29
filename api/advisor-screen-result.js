export default async function handler(req, res) {
  res.setHeader("Content-Type", "text/xml");

  const digits = req.body.Digits || "";
const paymentId = req.query.paymentId || "";
  if (digits === "1") {
        if (paymentId) {
      const completeResponse = await fetch(
        "https://scamcheck-lac.vercel.app/api/complete-payment",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            paymentId: paymentId
          })
        }
      );

      if (!completeResponse.ok) {
        console.error("Payment completion failed");
      }
    }
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
