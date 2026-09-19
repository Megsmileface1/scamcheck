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
        success: false,
        error: "Missing customer phone number"
      });
    }

    if (!paymentId || !consultationId) {
      return res.status(400).json({
        success: false,
        error: "Missing payment or consultation"
      });
    }

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
      Verify that the existing consultation
      belongs to this customer and payment.
    */
    const {
      data: consultation,
      error: consultationError
    } = await supabase
      .from("consultations")
      .select("id")
      .eq("id", consultationId)
      .eq("customer_phone", customerPhone)
      .eq("payment_id", paymentId)
      .single();

    if (
      consultationError ||
      !consultation
    ) {
      console.error(
        "Could not verify consultation:",
        consultationError
      );

      return res.status(400).json({
        success: false,
        error: "Could not verify consultation"
      });
    }

    /*
      Every normal paid consultation uses
      its existing consultation ID as its
      unique private conference room.
    */
    const phoneDigits =
  String(customerPhone).replace(/\D/g, "");

const plivoCustomerPhone =
  phoneDigits.length === 10
    ? `+1${phoneDigits}`
    : phoneDigits.length === 11 &&
      phoneDigits.startsWith("1")
      ? `+${phoneDigits}`
      : customerPhone;
    const roomId =
      `scamcheck-${consultationId}`;

    const params = new URLSearchParams({
      paymentId,
      consultationId:
        String(consultationId),
      roomId,
      prepaid: "0"
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
        "Plivo error:",
        data
      );

      return res.status(response.status).json({
        success: false,
        error: "Call could not be started",
        details: data
      });
    }

    /*
      Plivo returns a request UUID here.
      The actual CallUUID is stored when
      the customer answers.
    */
    const requestUuid =
      data.request_uuid || null;

    const { error: updateError } =
      await supabase
        .from("consultations")
        .update({
          status: "calling"
        })
        .eq("id", consultationId);

    if (updateError) {
      console.error(
        "Could not mark consultation calling:",
        updateError
      );
    }

    return res.status(200).json({
      success: true,
      callSid: requestUuid,
      consultationId
    });

  } catch (error) {
    console.error(
      "Plivo call error:",
      error
    );

    return res.status(500).json({
      success: false,
      error: "Call server error"
    });
  }
}
