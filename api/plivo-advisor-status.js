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

  const paymentId =
    req.query.paymentId || "";

  const consultationId =
    req.query.consultationId || "";

  const prepaid =
    req.query.prepaid === "1";

  try {
    let consultation = null;

    /*
      Check whether the consultation was accepted
      and get the customer's Plivo CallUUID.
    */
    if (consultationId) {
      const {
        data,
        error: consultationError
      } = await supabase
        .from("consultations")
        .select("id, accepted_at, call_sid")
        .eq("id", consultationId)
        .single();

      if (!consultationError) {
        consultation = data;
      }

      /*
        If the consultation was already accepted,
        the advisor hangup is normal.
      */
      if (
        consultation &&
        consultation.accepted_at
      ) {
        return res.status(200).json({
          success: true,
          accepted: true
        });
      }
    }

    /*
      Advisor never accepted.

      End the customer's waiting Plivo call so
      the customer is not left in the conference.
    */
    if (
      consultation &&
      consultation.call_sid
    ) {
      try {
        const authId =
          process.env.PLIVO_AUTH_ID;

        const authToken =
          process.env.PLIVO_AUTH_TOKEN;

        if (authId && authToken) {
          const auth = Buffer.from(
            `${authId}:${authToken}`
          ).toString("base64");

          const hangupResponse = await fetch(
            `https://api.plivo.com/v1/Account/${authId}/Call/${consultation.call_sid}/`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Basic ${auth}`
              }
            }
          );

          if (!hangupResponse.ok) {
            console.error(
              "Could not end waiting customer Plivo call"
            );
          }
        }
      } catch (error) {
        console.error(
          "Customer Plivo hangup failed:",
          error
        );
      }
    }

    /*
      Normal calls cancel the Square authorization.
      Prepaid calls have not used a credit.
    */
    if (paymentId && !prepaid) {
      try {
        const cancelResponse = await fetch(
          "https://askscamcheck.com/api/cancel-payment",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              paymentId
            })
          }
        );

        if (!cancelResponse.ok) {
          console.error(
            "Could not cancel payment after advisor call ended"
          );
        }
      } catch (error) {
        console.error(
          "Payment cancellation request failed:",
          error
        );
      }
    }

    if (consultationId) {
      const { error: updateError } =
        await supabase
          .from("consultations")
          .update({
            status: "failed"
          })
          .eq("id", consultationId)
          .is("accepted_at", null);

      if (updateError) {
        console.error(
          "Could not mark consultation failed:",
          updateError
        );
      }
    }

    return res.status(200).json({
      success: true,
      accepted: false
    });

  } catch (error) {
    console.error(
      "Plivo advisor status error:",
      error
    );

    return res.status(500).json({
      success: false
    });
  }
}
