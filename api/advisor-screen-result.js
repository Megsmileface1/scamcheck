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

  res.setHeader("Content-Type", "text/xml");
  return res.status(200).send(`
    <Response>
      <Say>
        We are sorry. We could not complete the payment, so the consultation cannot begin. You will not be charged. Please try again shortly.
      </Say>
      <Hangup/>
    </Response>
  `);
}
    }
    return res.status(200).send(`
      <Response>
      </Response>
    `);
  }
if (paymentId) {
  try {
    const cancelResponse = await fetch(
      "https://scamcheck-lac.vercel.app/api/cancel-payment",
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

    if (!cancelResponse.ok) {
      console.error("Payment cancellation failed");
    }
  } catch (error) {
    console.error("Payment cancellation error:", error);
  }
}
  return res.status(200).send(`
  <Response>
    <Reject reason="busy"/>
  </Response>
`);
}
