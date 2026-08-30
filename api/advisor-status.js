export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const dialCallStatus = req.body.DialCallStatus || "";
const paymentId = req.query.paymentId || "";
 if (
  paymentId &&
  ["busy", "no-answer", "failed", "canceled"].includes(dialCallStatus)
) {
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
  console.log("Advisor call status:", dialCallStatus);

  res.setHeader("Content-Type", "text/xml");
let paymentCompleted = false;

if (paymentId) {
  try {
    const paymentResponse = await fetch(
      `https://connect.squareupsandbox.com/v2/payments/${paymentId}`,
      {
        method: "GET",
        headers: {
          "Square-Version": "2026-08-19",
          "Authorization": `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`
        }
      }
    );

    const paymentData = await paymentResponse.json();

    paymentCompleted =
      paymentResponse.ok &&
      paymentData.payment &&
      paymentData.payment.status === "COMPLETED";
  } catch (error) {
    console.error("Could not verify payment status:", error);
  }
}

return res.status(200).send(
  paymentCompleted
    ? "<Response><Hangup/></Response>"
    : "<Response><Say>We are sorry. A ScamCheck advisor is not available right now. Your payment was not charged. Please try again shortly.</Say><Hangup/></Response>"
);
}
