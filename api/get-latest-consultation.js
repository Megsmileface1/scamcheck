import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

export default async function handler(req, res) {
    if (!process.env.ADVISOR_PASSWORD) {
    return res.status(500).json({ error: "Advisor authentication is not configured" });
  }

  const cookies = req.headers.cookie || "";

  const sessionToken = crypto
    .createHmac("sha256", process.env.ADVISOR_PASSWORD)
    .update("scamcheck-advisor-session")
    .digest("hex");

  const expectedCookie = `scamcheck_advisor=${sessionToken}`;

  if (!cookies.includes(expectedCookie)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { data, error } = await supabase
      .from("consultations")
      .select("id, created_at, customer_phone, customer_message, supporting_image_url, payment_id, status, call_sid, accepted_at, completed_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      throw error;
    }
let imageSignedUrl = null;

if (data.supporting_image_url) {
  const { data: signedData, error: signedError } = await supabase.storage
    .from("consultation-images")
    .createSignedUrl(data.supporting_image_url, 600);

  if (!signedError && signedData) {
    imageSignedUrl = signedData.signedUrl;
  }
}
    return res.status(200).json({
      success: true,
      consultation: {
  ...data,
  supporting_image_signed_url: imageSignedUrl
}
    });
  } catch (error) {
    console.error("Get latest consultation error:", error);
    return res.status(500).json({
      error: "Could not load consultation"
    });
  }
}
