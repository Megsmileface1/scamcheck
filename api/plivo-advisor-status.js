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
    /*
      If the consultation was already accepted,
      the advisor hangup is normal and we must
      not cancel payment or change it to failed.
    */
    if (consultationId) {
      const {
        data: consultation,
        error: consultationError
      } = await supabase
        .from("consultations")
        .select("id, accepted_at")
        .eq("id", consultationId)
        .single();

      if (
        !consultationError &&
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
      Advisor never accepted the consultation.

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
