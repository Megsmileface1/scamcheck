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

  const callUuid =
    req.body.CallUUID || "";

  try {
    let consultation = null;

    /*
      Prefer the consultation ID because it directly
      identifies this ScamCheck consultation.
    */
    if (consultationId) {
      const {
        data,
        error
      } = await supabase
        .from("consultations")
        .select(
          "id, status, accepted_at, completed_at"
        )
        .eq("id", consultationId)
        .single();

      if (!error) {
        consultation = data;
      }
    }

    /*
      Fall back to the actual Plivo CallUUID if needed.
    */
    if (!consultation && callUuid) {
      const {
        data,
        error
      } = await supabase
        .from("consultations")
        .select(
          "id, status, accepted_at, completed_at"
        )
        .eq("call_sid", callUuid)
        .single();

      if (!error) {
        consultation = data;
      }
    }

    if (!consultation) {
      console.error(
        "Could not find consultation for completed Plivo call"
      );

      return res.status(200).json({
        success: true
      });
    }

    /*
      If the advisor accepted the call, the consultation
      is complete when the customer call ends.
    */
    if (consultation.accepted_at) {
      if (!consultation.completed_at) {
        const { error: completionError } =
          await supabase
            .from("consultations")
            .update({
              status: "completed",
              completed_at:
                new Date().toISOString()
            })
            .eq("id", consultation.id);

        if (completionError) {
          console.error(
            "Could not mark Plivo consultation completed:",
            completionError
          );
        }
      }

      return res.status(200).json({
        success: true,
        completed: true
      });
    }

    /*
      The call ended before the advisor accepted.

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
            "Could not cancel payment after customer call ended"
          );
        }
      } catch (error) {
        console.error(
          "Payment cancellation request failed:",
          error
        );
      }
    }

    const { error: failedError } =
      await supabase
        .from("consultations")
        .update({
          status: "failed"
        })
        .eq("id", consultation.id)
        .is("accepted_at", null);

    if (failedError) {
      console.error(
        "Could not mark unfinished Plivo consultation failed:",
        failedError
      );
    }

    return res.status(200).json({
      success: true,
      completed: false
    });

  } catch (error) {
    console.error(
      "Plivo call completion error:",
      error
    );

    return res.status(500).json({
      success: false
    });
  }
}
