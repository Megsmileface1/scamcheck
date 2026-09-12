import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const dialCallStatus =
    req.body.DialCallStatus || "";

  const paymentId =
    req.query.paymentId || "";

  const prepaid =
    req.query.prepaid === "1";

  const consultationId =
    req.query.consultationId || "";

  /*
    PREPAID FAMILY PLAN CALL

    There is no Square payment to check.
    The advisor acceptance step marks the
    consultation as accepted.
  */
  if (prepaid) {
    let prepaidAccepted = false;

    if (consultationId) {
      try {
        const {
          data: consultation,
          error: consultationError
        } = await supabase
          .from("consultations")
          .select("id, status")
          .eq("id", consultationId)
          .single();

        if (consultationError) {
          console.error(
            "Could not verify prepaid consultation status:",
            consultationError
          );
        } else {
          prepaidAccepted =
            consultation &&
            consultation.status === "accepted";
        }

      } catch (error) {
        console.error(
          "Prepaid consultation status error:",
          error
        );
      }
    }

    console.log(
      "Prepaid advisor call status:",
      dialCallStatus
    );

    res.setHeader(
      "Content-Type",
      "text/xml"
    );

    return res.status(200).send(
      prepaidAccepted
        ? "<Response><Hangup/></Response>"
        : "<Response><Say>We are sorry. A ScamCheck advisor is not available right now. Your prepaid call was not used. Please try again shortly.</Say><Hangup/></Response>"
    );
  }

  /*
    NORMAL $10 SQUARE CALL
    Existing behavior remains the same.
  */
  if (
    paymentId &&
    [
      "busy",
      "no-answer",
      "failed",
      "canceled"
    ].includes(dialCallStatus)
  ) {
    try {
      const cancelResponse = await fetch(
        "https://scamcheck-lac.vercel.app/api/cancel-payment",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            paymentId: paymentId
          })
        }
      );

      if (!cancelResponse.ok) {
        console.error(
          "Payment cancellation failed"
        );
      }

    } catch (error) {
      console.error(
        "Payment cancellation error:",
        error
      );
    }
  }

  console.log(
    "Advisor call status:",
    dialCallStatus
  );

  res.setHeader(
    "Content-Type",
    "text/xml"
  );

  let paymentCompleted = false;
  let paymentStatus = "";

  if (paymentId) {
    try {
      const paymentResponse = await fetch(
        `https://connect.squareup.com/v2/payments/${paymentId}`,
        {
          method: "GET",
          headers: {
            "Square-Version": "2026-08-19",
            "Authorization":
              `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`
          }
        }
      );

      const paymentData =
        await paymentResponse.json();

      paymentStatus =
        paymentData.payment?.status || "";

      paymentCompleted =
        paymentResponse.ok &&
        paymentData.payment &&
        paymentData.payment.status ===
          "COMPLETED";

      if (paymentStatus === "APPROVED") {
        try {
          const cancelResponse =
            await fetch(
              "https://scamcheck-lac.vercel.app/api/cancel-payment",
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json"
                },
                body: JSON.stringify({
                  paymentId: paymentId
                })
              }
            );

          if (!cancelResponse.ok) {
            console.error(
              "Payment cancellation failed"
            );
          }

        } catch (error) {
          console.error(
            "Could not cancel approved payment:",
            error
          );
        }
      }

    } catch (error) {
      console.error(
        "Could not verify payment status:",
        error
      );

      try {
        const cancelResponse =
          await fetch(
            "https://scamcheck-lac.vercel.app/api/cancel-payment",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json"
              },
              body: JSON.stringify({
                paymentId: paymentId
              })
            }
          );

        if (!cancelResponse.ok) {
          console.error(
            "Payment cancellation failed"
          );
        }

      } catch (cancelError) {
        console.error(
          "Payment cancellation error:",
          cancelError
        );
      }
    }
  }

  return res.status(200).send(
    paymentCompleted
      ? "<Response><Hangup/></Response>"
      : "<Response><Say>We are sorry. A ScamCheck advisor is not available right now. Your payment was not completed. Please try again shortly.</Say><Hangup/></Response>"
  );
}
