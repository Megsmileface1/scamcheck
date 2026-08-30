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
return res.status(200).send(
  dialCallStatus === "completed"
    ? "<Response><Hangup/></Response>"
    : "<Response><Say>We are sorry. A ScamCheck advisor is not available right now. Please try again shortly.</Say><Hangup/></Response>"
);
}
