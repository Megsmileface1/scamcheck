import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
 const { customerPhone, paymentId, consultationId } = req.body;
   
    if (!customerPhone) {
      return res.status(400).json({
        error: "Missing customer phone number"
      });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
    const advisorPhone = process.env.SCAMCHECK_ADVISOR_PHONE;

    const auth =
      Buffer.from(`${accountSid}:${authToken}`).toString("base64");

    const twiml = `
      <Response>
        <Say>
          Please hold while ScamCheck connects you to an advisor.
        </Say>
      <Dial
  callerId="${twilioNumber}"
action="https://scamcheck-lac.vercel.app/api/advisor-status?paymentId=${encodeURIComponent(paymentId || "")}"
  method="POST"
>
     <Number timeout="20" url="https://scamcheck-lac.vercel.app/api/advisor-screen?paymentId=${encodeURIComponent(paymentId || "")}">${advisorPhone}</Number>
        </Dial>
      </Response>
    `;

   const body = new URLSearchParams({
  To: customerPhone,
  From: twilioNumber,
  Twiml: twiml,
  StatusCallback: "https://scamcheck-lac.vercel.app/api/call-completed",
  StatusCallbackMethod: "POST",
  StatusCallbackEvent: "completed"
});
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Twilio error:", data);

      return res.status(response.status).json({
        success: false,
        error: "Call could not be started",
        details: data
      });
    }
try {
  let consultationError = null;
  let consultationUpdated = false;

  if (consultationId) {
    const { data: updatedConsultations, error: updateError } = await supabase
      .from("consultations")
      .update({
        customer_phone: customerPhone || null,
        payment_id: paymentId || null,
        call_sid: data.sid || null,
        status: "calling"
      })
      .eq("id", consultationId)
      .eq("customer_phone", customerPhone)
      .select("id");

    consultationError = updateError;
    consultationUpdated =
      !updateError &&
      updatedConsultations &&
      updatedConsultations.length > 0;
  }

  if (!consultationUpdated && !consultationError) {
    const { error: insertError } = await supabase
      .from("consultations")
      .insert([
        {
          customer_phone: customerPhone || null,
          payment_id: paymentId || null,
          call_sid: data.sid || null,
          status: "calling"
        }
      ]);

    consultationError = insertError;
  }

  if (consultationError) {
    console.error(
      "Could not create or update call consultation record:",
      consultationError
    );
  }
} catch (consultationError) {
  console.error(
    "Call consultation logging error:",
    consultationError
  );
}
    return res.status(200).json({
      success: true,
      callSid: data.sid
    });

  } catch (error) {
    console.error("Call error:", error);

    return res.status(500).json({
      success: false,
      error: "Call server error"
    });
  }
}
