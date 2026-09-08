import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { data, error } = await supabase
      .from("advisor_availability")
      .select("is_available")
      .eq("id", 1)
      .single();

    if (error) {
      throw error;
    }

    return res.status(200).json({
      success: true,
      isAvailable: data.is_available
    });

  } catch (error) {
    console.error("Advisor availability status error:", error);

    return res.status(500).json({
      success: false,
      error: "Could not check advisor availability"
    });
  }
}
