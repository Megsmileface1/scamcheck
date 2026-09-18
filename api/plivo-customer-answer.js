import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const paymentId =
    req.query.paymentId || "";

  const consultationId =
    req.query.consultationId || "";

  const roomId =
    req.query.roomId || "";

  const prepaid =
    req.query.prepaid === "1";

  const callUuid =
    req.body.CallUUID || "";

  if (!consultationId || !roomId) {
    console.error(
      "Missing consultation or Plivo conference room"
    );

    res.setHeader(
      "Content-Type",
      "application/xml"
    );

    return res.status(200).send(`
      <Response>
        <Speak>
          We are sorry. ScamCheck cannot connect your call right now.
        </Speak>
        <Hangup/>
      </Response>
    `);
  }

  /*
    Store the real Plivo CallUUID when the
    customer actually answers the call.
  */
  if (callUuid) {
    try {
      const { error } = await supabase
        .from("consultations")
        .update({
          call_sid: callUuid
        })
        .eq("id", consultationId);

      if (error) {
        console.error(
          "Could not store Plivo CallUUID:",
          error
        );
      }
    } catch (error) {
      console.error(
        "Plivo CallUUID logging error:",
        error
      );
    }
  }

  /*
    The customer has answered.
    Now ring the advisor while the customer
    waits in the private conference.
  */
  try {
    const advisorResponse = await fetch(
      "https://askscamcheck.com/api/plivo-start-advisor",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          paymentId,
          consultationId,
          roomId,
          prepaid
        })
      }
    );

    if (!advisorResponse.ok) {
      console.error(
        "Could not start Plivo advisor call"
      );

      res.setHeader(
        "Content-Type",
        "application/xml"
      );

      return res.status(200).send(`
        <Response>
          <Speak>
            We are sorry. An advisor cannot be reached right now.
          </Speak>
          <Hangup/>
        </Response>
      `);
    }
  } catch (error) {
    console.error(
      "Plivo advisor start request failed:",
      error
    );

    res.setHeader(
      "Content-Type",
      "application/xml"
    );

    return res.status(200).send(`
      <Response>
        <Speak>
          We are sorry. An advisor cannot be reached right now.
        </Speak>
        <Hangup/>
      </Response>
    `);
  }

  res.setHeader(
    "Content-Type",
    "application/xml"
  );

  return res.status(200).send(`
    <Response>
      <Speak>
        Please hold while ScamCheck connects you to an advisor.
      </Speak>

      <Conference
        startConferenceOnEnter="false"
        endConferenceOnExit="false"
      
      >${roomId}</Conference>
    </Response>
  `);
}
