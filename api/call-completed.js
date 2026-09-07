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
    const callSid = req.body.CallSid || "";
    const callStatus = req.body.CallStatus || "";

    if (!callSid) {
      return res.status(400).json({
        success: false,
        error: "Missing call SID"
      });
    }

    const { error } = await supabase
      .from("consultations")
      .update({
        status: callStatus || "completed",
        completed_at: new Date().toISOString()
      })
      .eq("call_sid", callSid);

    if (error) {
      console.error("Could not mark consultation completed:", error);

      return res.status(500).json({
        success: false,
        error: "Could not update consultation"
      });
    }

    return res.status(200).json({
      success: true
    });

  } catch (error) {
    console.error("Call completed webhook error:", error);

    return res.status(500).json({
      success: false,
      error: "Call completed server error"
    });
  }
}
