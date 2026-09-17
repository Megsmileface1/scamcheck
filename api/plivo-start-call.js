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
    const {
      customerPhone,
      paymentId,
      consultationId
    } = req.body;

    if (!customerPhone) {
      return res.status(400).json({
        error: "Missing customer phone number"
      });
    }

    const authId = process.env.PLIVO_AUTH_ID;
    const authToken = process.env.PLIVO_AUTH_TOKEN;
    const plivoNumber = process.env.PLIVO_PHONE_NUMBER;

    if (!authId || !authToken || !plivoNumber) {
      console.error("Missing Plivo environment variables");

      return res.status(500).json({
        success: false,
        error: "Plivo is not configured"
      });
    }

    /*
      Every consultation gets its own private conference room.
      We use the existing consultation ID when available.
    */
    const roomId =
      consultationId ||
      `scamcheck-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}`;

    const params = new URLSearchParams({
      paymentId: paymentId || "",
      consultationId: consultationId || "",
      roomId
    });

    const answerUrl =
      `https://askscamcheck.com/api/plivo-customer-answer?${params.toString()}`;

    const hangupUrl =
      `https://askscamcheck.com/api/plivo-call-completed?${params.toString()}`;

    const auth = Buffer.from(
      `${authId}:${authToken}`
    ).toString("base64");

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
          to: customerPhone,
          answer_url: answerUrl,
          answer_method: "POST",
          hangup_url: hangupUrl,
          hangup_method: "POST"
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Plivo error:", data);

      return res.status(response.status).json({
        success: false,
        error: "Call could not be started",
        details: data
      });
    }

    /*
      Plivo returns a request UUID when the outbound call is created.
      The actual CallUUID arrives later at the answer/hangup webhook.
    */
    const requestUuid = data.request_uuid || null;

    try {
      let consultationError = null;
      let consultationUpdated = false;

      if (consultationId) {
        const {
          data: updatedConsultations,
          error: updateError
        } = await supabase
          .from("consultations")
          .update({
            customer_phone: customerPhone || null,
            payment_id: paymentId || null,
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
      callSid: requestUuid
    });

  } catch (error) {
    console.error("Plivo call error:", error);

    return res.status(500).json({
      success: false,
      error: "Call server error"
    });
  }
}
