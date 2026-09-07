import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);
export default async function handler(req, res) {
  res.setHeader("Content-Type", "text/xml");

  const digits = req.body.Digits || "";
 
const paymentId = req.query.paymentId || "";
  if (digits === "1") {
       if (paymentId) {
  try {
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

      return res.status(200).send(`
        <Response>
          <Say>
           We are sorry. We could not complete the payment, so the consultation cannot begin. Please try again shortly.
          </Say>
          <Hangup/>
        </Response>
      `);
    }
   try {
  const { error: consultationUpdateError } = await supabase
    .from("consultations")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString()
    })
    .eq("payment_id", paymentId);

  if (consultationUpdateError) {
    console.error(
      "Could not mark consultation accepted:",
      consultationUpdateError
    );
  }
} catch (consultationUpdateError) {
  console.error(
    "Consultation acceptance logging error:",
    consultationUpdateError
  );
}
  } catch (error) {
    console.error("Payment completion request failed:", error);

    return res.status(200).send(`
      <Response>
        <Say>
          We are sorry. We could not complete the payment, so the consultation cannot begin. Please try again shortly.
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
