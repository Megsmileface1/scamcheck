import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    const { consultationId, paymentId } = req.body || {};

    if (!consultationId || !paymentId) {
      return res.status(400).json({
        success: false,
        error: "Missing consultation or payment"
      });
    }

    const { data, error } = await supabase
      .from("consultations")
      .select("status")
      .eq("id", consultationId)
      .eq("payment_id", paymentId)
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        error: "Consultation not found"
      });
    }

    return res.status(200).json({
      success: true,
      status: data.status
    });
  } catch (error) {
    console.error("Call status server error:", error);

    return res.status(500).json({
      success: false,
      error: "Call status server error"
    });
  }
}
