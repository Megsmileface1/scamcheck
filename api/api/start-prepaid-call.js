import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    const {
      customerPhone,
      consultationId
    } = req.body;

    if (!customerPhone) {
      return res.status(400).json({
        success: false,
        error: "Missing customer phone number"
      });
    }

    const phoneDigits = String(customerPhone).replace(/\D/g, "");

    if (phoneDigits.length !== 10) {
      return res.status(400).json({
        success: false,
        error: "Invalid customer phone number"
      });
    }

    /*
      Confirm this phone number currently has
      at least one prepaid ScamCheck call.
      We are ONLY checking here.

      We do NOT deduct a credit here.
    */
    const { data: users, error: userError } = await supabase
      .from("users")
      .select("id, phone_number, call_credits")
      .eq("phone_number", phoneDigits)
      .limit(1);

    if (userError) {
      console.error("Prepaid customer lookup error:", userError);

      return res.status(500).json({
        success: false,
        error: "Could not verify prepaid calls"
      });
    }

    if (
      !users ||
      users.length === 0 ||
      Number(users[0].call_credits || 0) < 1
    ) {
      return res.status(400).json({
        success: false,
        error: "No prepaid ScamCheck calls are available"
      });
    }

    /*
      If the customer already sent supporting information,
      consultationId may already exist.

      Otherwise create a new consultation.
    */
    let prepaidConsultationId = null;

    if (consultationId) {
      const { data: updatedConsultations, error: updateError } =
        await supabase
          .from("consultations")
          .update({
            customer_phone: phoneDigits,
            payment_id: null,
            status: "calling"
          })
          .eq("id", consultationId)
          .eq("customer_phone", phoneDigits)
          .select("id");

      if (updateError) {
        console.error(
          "Could not prepare prepaid consultation:",
          updateError
        );

        return res.status(500).json({
          success: false,
          error: "Could not prepare prepaid consultation"
        });
      }

      if (
        updatedConsultations &&
        updatedConsultations.length > 0
      ) {
        prepaidConsultationId =
          updatedConsultations[0].id;
      }
    }

    if (!prepaidConsultationId) {
      const { data: newConsultation, error: insertError } =
        await supabase
          .from("consultations")
          .insert([
            {
              customer_phone: phoneDigits,
              payment_id: null,
              status: "calling"
            }
          ])
          .select("id")
          .single();

      if (insertError) {
        console.error(
          "Could not create prepaid consultation:",
          insertError
        );

        return res.status(500).json({
          success: false,
          error: "Could not create prepaid consultation"
        });
      }

      prepaidConsultationId = newConsultation.id;
    }

    const accountSid =
      process.env.TWILIO_ACCOUNT_SID;

    const authToken =
      process.env.TWILIO_AUTH_TOKEN;

    const twilioNumber =
      process.env.TWILIO_PHONE_NUMBER;

    const advisorPhone =
      process.env.SCAMCHECK_ADVISOR_PHONE;

    const auth =
      Buffer.from(
        `${accountSid}:${authToken}`
      ).toString("base64");

    const encodedConsultationId =
      encodeURIComponent(
        String(prepaidConsultationId)
      );

    const twiml = `
      <Response>
        <Say>
          Please hold while ScamCheck connects you to an advisor.
        </Say>

        <Dial
          callerId="${twilioNumber}"
          action="https://scamcheck-lac.vercel.app/api/advisor-status?prepaid=1&consultationId=${encodedConsultationId}"
          method="POST"
        >
          <Number
            timeout="20"
            url="https://scamcheck-lac.vercel.app/api/advisor-screen?prepaid=1&consultationId=${encodedConsultationId}"
          >${advisorPhone}</Number>
        </Dial>
      </Response>
    `;

    const body = new URLSearchParams({
      To: phoneDigits,
      From: twilioNumber,
      Twiml: twiml,
      StatusCallback:
        "https://scamcheck-lac.vercel.app/api/call-completed",
      StatusCallbackMethod: "POST",
      StatusCallbackEvent: "completed"
    });

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type":
            "application/x-www-form-urlencoded"
        },
        body
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "Prepaid Twilio error:",
        data
      );

      await supabase
        .from("consultations")
        .update({
          status: "failed",
          completed_at:
            new Date().toISOString()
        })
        .eq("id", prepaidConsultationId);

      return res.status(response.status).json({
        success: false,
        error: "Call could not be started",
        details: data
      });
    }

    const { error: callUpdateError } =
      await supabase
        .from("consultations")
        .update({
          call_sid: data.sid,
          status: "calling"
        })
        .eq("id", prepaidConsultationId);

    if (callUpdateError) {
      console.error(
        "Could not save prepaid call SID:",
        callUpdateError
      );
    }

    return res.status(200).json({
      success: true,
      callSid: data.sid,
      consultationId:
        prepaidConsultationId
    });

  } catch (error) {
    console.error(
      "Prepaid call server error:",
      error
    );

    return res.status(500).json({
      success: false,
      error: "Prepaid call server error"
    });
  }
}
