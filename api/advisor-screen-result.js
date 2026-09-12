import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

export default async function handler(req, res) {
  res.setHeader("Content-Type", "text/xml");

  const digits = req.body.Digits || "";
  const paymentId = req.query.paymentId || "";
  const prepaid = req.query.prepaid === "1";
  const consultationId = req.query.consultationId || "";

  if (digits === "1") {

    /*
      PREPAID FAMILY PLAN CALL
    */
    if (prepaid) {
      if (!consultationId) {
        return res.status(200).send(`
          <Response>
            <Say>
              We are sorry. We could not verify this prepaid consultation.
            </Say>
            <Hangup/>
          </Response>
        `);
      }

      try {
        const {
          data: consultation,
          error: consultationError
        } = await supabase
          .from("consultations")
          .select("id, customer_phone, status, accepted_at")
          .eq("id", consultationId)
          .single();

        if (
          consultationError ||
          !consultation ||
          !consultation.customer_phone
        ) {
          console.error(
            "Could not verify prepaid consultation:",
            consultationError
          );

          return res.status(200).send(`
            <Response>
              <Say>
                We are sorry. We could not verify this prepaid consultation.
              </Say>
              <Hangup/>
            </Response>
          `);
        }

        /*
          If Twilio somehow sends the acceptance request twice,
          do not deduct a second credit.
        */
       if (consultation.accepted_at) {
          return res.status(200).send(`
            <Response>
            </Response>
          `);
        }

        const {
          data: users,
          error: userError
        } = await supabase
          .from("users")
          .select("id, call_credits")
          .eq(
            "phone_number",
            consultation.customer_phone
          )
          .limit(1);

        if (
          userError ||
          !users ||
          users.length === 0
        ) {
          console.error(
            "Could not find prepaid customer:",
            userError
          );

          return res.status(200).send(`
            <Response>
              <Say>
                We are sorry. We could not verify an available prepaid call.
              </Say>
              <Hangup/>
            </Response>
          `);
        }

        const user = users[0];
        const currentCredits =
          Number(user.call_credits || 0);

        if (currentCredits < 1) {
          return res.status(200).send(`
            <Response>
              <Say>
                We are sorry. There are no prepaid ScamCheck calls remaining.
              </Say>
              <Hangup/>
            </Response>
          `);
        }

        /*
          Deduct exactly one credit.

          Matching the existing credit balance helps prevent
          two requests from using the same credit at the same time.
        */
        const {
          data: updatedUsers,
          error: creditError
        } = await supabase
          .from("users")
          .update({
            call_credits: currentCredits - 1
          })
          .eq("id", user.id)
          .eq("call_credits", currentCredits)
          .select("id, call_credits");

        if (
          creditError ||
          !updatedUsers ||
          updatedUsers.length === 0
        ) {
          console.error(
            "Could not deduct prepaid credit:",
            creditError
          );

          return res.status(200).send(`
            <Response>
              <Say>
                We are sorry. We could not use the prepaid call. Please try again shortly.
              </Say>
              <Hangup/>
            </Response>
          `);
        }

        const {
          error: acceptanceError
        } = await supabase
          .from("consultations")
          .update({
            status: "accepted",
            accepted_at: new Date().toISOString()
          })
          .eq("id", consultationId);

        if (acceptanceError) {
          console.error(
            "Could not mark prepaid consultation accepted:",
            acceptanceError
          );

          /*
            Put the credit back if we could not record
            the consultation as accepted.
          */
          const {
            error: restoreError
          } = await supabase
            .from("users")
            .update({
              call_credits: currentCredits
            })
            .eq("id", user.id)
            .eq(
              "call_credits",
              currentCredits - 1
            );

          if (restoreError) {
            console.error(
              "Could not restore prepaid credit:",
              restoreError
            );
          }

          return res.status(200).send(`
            <Response>
              <Say>
                We are sorry. We could not begin the prepaid consultation. Please try again shortly.
              </Say>
              <Hangup/>
            </Response>
          `);
        }

        return res.status(200).send(`
          <Response>
          </Response>
        `);

      } catch (error) {
        console.error(
          "Prepaid acceptance error:",
          error
        );

        return res.status(200).send(`
          <Response>
            <Say>
              We are sorry. We could not begin the prepaid consultation. Please try again shortly.
            </Say>
            <Hangup/>
          </Response>
        `);
      }
    }

    /*
      NORMAL $10 SQUARE CALL
      Existing behavior remains the same.
    */
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
          console.error(
            "Payment completion failed"
          );

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
          const {
            error: consultationUpdateError
          } = await supabase
            .from("consultations")
            .update({
              status: "accepted",
              accepted_at:
                new Date().toISOString()
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
        console.error(
          "Payment completion request failed:",
          error
        );

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

  /*
    Advisor did not press 1.

    Normal paid calls cancel the authorization.
    Prepaid calls have not used a credit, so nothing
    needs to be restored or deducted.
  */
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

  return res.status(200).send(`
    <Response>
      <Reject reason="busy"/>
    </Response>
  `);
}
