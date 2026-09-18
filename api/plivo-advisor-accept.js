import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  res.setHeader(
    "Content-Type",
    "application/xml"
  );

  const digits =
    req.body.Digits || "";

  const paymentId =
    req.query.paymentId || "";

  const consultationId =
    req.query.consultationId || "";

  const roomId =
    req.query.roomId || "";

  const prepaid =
    req.query.prepaid === "1";

  if (!consultationId || !roomId) {
    return res.status(200).send(`
      <Response>
        <Speak>
          We are sorry. This ScamCheck consultation cannot be connected.
        </Speak>
        <Hangup/>
      </Response>
    `);
  }

  if (digits === "1") {

    /*
      PREPAID FAMILY PLAN CALL
    */
    if (prepaid) {
      try {
        const {
          data: consultation,
          error: consultationError
        } = await supabase
          .from("consultations")
          .select(
            "id, customer_phone, status, accepted_at"
          )
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
              <Speak>
                We are sorry. We could not verify this prepaid consultation.
              </Speak>
              <Hangup/>
            </Response>
          `);
        }

        /*
          If Plivo somehow sends the acceptance
          request twice, do not deduct a second credit.
        */
        if (consultation.accepted_at) {
          return res.status(200).send(`
            <Response>
              <Conference
                startConferenceOnEnter="true"
                endConferenceOnExit="true"
              >${roomId}</Conference>
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
              <Speak>
                We are sorry. We could not verify an available prepaid call.
              </Speak>
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
              <Speak>
                We are sorry. There are no prepaid ScamCheck calls remaining.
              </Speak>
              <Hangup/>
            </Response>
          `);
        }

        /*
          Deduct exactly one credit.
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
              <Speak>
                We are sorry. We could not use the prepaid call. Please try again shortly.
              </Speak>
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
            accepted_at:
              new Date().toISOString()
          })
          .eq("id", consultationId);

        if (acceptanceError) {
          console.error(
            "Could not mark prepaid consultation accepted:",
            acceptanceError
          );

          /*
            Restore the credit if acceptance
            could not be recorded.
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
              <Speak>
                We are sorry. We could not begin the prepaid consultation. Please try again shortly.
              </Speak>
              <Hangup/>
            </Response>
          `);
        }

        return res.status(200).send(`
          <Response>
            <Conference
              startConferenceOnEnter="true"
              endConferenceOnExit="true"
            >${roomId}</Conference>
          </Response>
        `);

      } catch (error) {
        console.error(
          "Prepaid acceptance error:",
          error
        );

        return res.status(200).send(`
          <Response>
            <Speak>
              We are sorry. We could not begin the prepaid consultation. Please try again shortly.
            </Speak>
            <Hangup/>
          </Response>
        `);
      }
    }

    /*
      NORMAL $10 SQUARE CALL
    */
    if (!paymentId) {
      return res.status(200).send(`
        <Response>
          <Speak>
            We are sorry. We could not verify the payment for this consultation.
          </Speak>
          <Hangup/>
        </Response>
      `);
    }

    try {
      const completeResponse = await fetch(
        "https://askscamcheck.com/api/complete-payment",
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

      if (!completeResponse.ok) {
        console.error(
          "Payment completion failed"
        );

        return res.status(200).send(`
          <Response>
            <Speak>
              We are sorry. We could not complete the payment, so the consultation cannot begin. Please try again shortly.
            </Speak>
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
          .eq("id", consultationId);

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

      /*
        Payment succeeded.
        The advisor now starts and joins the
        customer's private conference.
      */
      return res.status(200).send(`
        <Response>
          <Conference
            startConferenceOnEnter="true"
            endConferenceOnExit="true"
          >${roomId}</Conference>
        </Response>
      `);

    } catch (error) {
      console.error(
        "Payment completion request failed:",
        error
      );

      return res.status(200).send(`
        <Response>
          <Speak>
            We are sorry. We could not complete the payment, so the consultation cannot begin. Please try again shortly.
          </Speak>
          <Hangup/>
        </Response>
      `);
    }
  }

  /*
    Advisor did not press 1.

    Normal paid calls cancel the authorization.
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
      <Speak>
        The consultation was not accepted.
      </Speak>
      <Hangup/>
    </Response>
  `);
}
