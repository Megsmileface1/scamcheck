import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      customerPhone,
      customerMessage,
      supportingImageUrl
    } = req.body;

    const { data, error } = await supabase
      .from("consultations")
      .insert([
        {
          customer_phone: customerPhone || null,
          customer_message: customerMessage || null,
          supporting_image_url: supportingImageUrl || null
        }
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    return res.status(200).json({
      success: true,
      consultation: data
    });
  } catch (error) {
    console.error("Save consultation error:", error);

    return res.status(500).json({
      error: "Could not save consultation"
    });
  }
}
