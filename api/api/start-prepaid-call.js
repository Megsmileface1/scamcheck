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

    const phoneDigits =
      String(customerPhone).replace(/\D/g, "");

    if (phoneDigits.length !== 10) {
      return res.status(400).json({
        success: false,
        error: "Invalid customer phone number"
      });
    }

    /*
      Confirm this phone number currently has
      at least one prepaid ScamCheck call.

      We only check here.
      The credit is deducted after the advisor
      presses 1 to accept the consultation.
    */
    const {
      data: users,
      error: userError
    } = await supabase
      .from("users")
      .select(
        "id, phone_number, call_credits"
      )
      .eq("phone_number", phoneDigits)
      .limit(1);

    if (userError) {
      console.error(
        "Prepaid customer lookup error:",
        userError
      );

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
      Reuse an existing consultation when possible.
      Otherwise create a new one.
    */
    let prepaidConsultationId = null;

    if (consultationId) {
      const {
        data: updatedConsultations,
        error: updateError
      } = await supabase
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
      const {
        data: newConsultation,
        error: insertError
      } = await supabase
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

      prepaidConsultationId =
        newConsultation.id;
    }

    /*
      PLIVO CALL
    */
    const authId =
      process.env.PLIVO_AUTH_ID;

    const authToken =
      process.env.PLIVO_AUTH_TOKEN;

    const plivoNumber =
      process.env.PLIVO_PHONE_NUMBER;

    if (
      !authId ||
      !authToken ||
      !plivoNumber
    ) {
      console.error(
        "Missing Plivo environment variables"
      );

      return res.status(500).json({
        success: false,
        error: "Plivo is not configured"
      });
    }

    /*
      Every prepaid consultation gets its own
      private conference room.
    */
    const roomId =
      `scamcheck-${prepaidConsultationId}`;

    const params = new URLSearchParams({
      paymentId: "",
      consultationId:
        String(prepaidConsultationId),
      roomId,
      prepaid: "1"
    });

    const answerUrl =
      `https://askscamcheck.com/api/plivo-customer-answer?${params.toString()}`;

    const hangupUrl =
      `https://askscamcheck.com/api/plivo-call-completed?${params.toString()}`;

    const auth =
      Buffer.from(
        `${authId}:${authToken}`
      ).toString("base64");

    /*
      Plivo uses E.164 format for the destination.
    */
    const plivoCustomerPhone =
      `+1${phoneDigits}`;

    const response = await fetch(
      `https://api.plivo.com/v1/Account/${authId}/Call/`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: plivoNumber,
          to: plivoCustomerPhone,
          answer_url: answerUrl,
          answer_method: "POST",
          hangup_url: hangupUrl,
          hangup_method: "POST"
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "Prepaid Plivo error:",
        data
      );

      await supabase
        .from("consultations")
        .update({
          status: "failed",
          completed_at:
            new Date().toISOString()
        })
        .eq(
          "id",
          prepaidConsultationId
        );

      return res.status(response.status).json({
        success: false,
        error: "Call could not be started",
        details: data
      });
    }

    /*
      Plivo returns a request UUID here.
      The actual CallUUID is saved later when
      the customer answers.
    */
    const requestUuid =
      data.request_uuid || null;

    return res.status(200).json({
      success: true,
      callSid: requestUuid,
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
