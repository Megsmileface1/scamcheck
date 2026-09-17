import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const consultationId =
    req.query.consultationId || "";

  const roomId =
    req.query.roomId || "";

  const callUuid =
    req.body.CallUUID || "";

  if (!roomId) {
    console.error("Missing Plivo conference room ID");

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
  if (consultationId && callUuid) {
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
        waitSound=""
      >${roomId}</Conference>
    </Response>
  `);
}
