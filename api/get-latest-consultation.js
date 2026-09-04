import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { data, error } = await supabase
      .from("consultations")
      .select("id, created_at, customer_phone, customer_message, supporting_image_url")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      throw error;
    }

    return res.status(200).json({
      success: true,
      consultation: data
    });
  } catch (error) {
    console.error("Get latest consultation error:", error);
    return res.status(500).json({
      error: "Could not load consultation"
    });
  }
}
