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
  supportingImageUrl,
  paymentId,
  consultationId
} = req.body;
if (consultationId && paymentId) {
  const squareResponse = await fetch(
    `https://connect.squareup.com/v2/payments/${encodeURIComponent(paymentId)}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
        "Square-Version": "2025-01-23"
      }
    }
  );

  const squareResult = await squareResponse.json();
  const squarePayment = squareResult.payment;

  if (
    !squareResponse.ok ||
    !squarePayment ||
    squarePayment.id !== paymentId ||
    squarePayment.status !== "APPROVED" ||
    squarePayment.amount_money?.amount !== 1000 ||
    squarePayment.amount_money?.currency !== "USD"
  ) {
    return res.status(400).json({
      success: false,
      error: "Could not verify payment authorization"
    });
  }
  const { data: existing, error: lookupError } = await supabase
    .from("consultations")
    .select("id, payment_id")
    .eq("id", consultationId)
    .eq("customer_phone", customerPhone)
    .single();

  if (lookupError || !existing || existing.payment_id) {
    return res.status(400).json({
      success: false,
      error: "Could not link payment to consultation"
    });
  }

  const { data: updated, error: updateError } = await supabase
    .from("consultations")
    .update({ payment_id: paymentId })
    .eq("id", consultationId)
    .eq("customer_phone", customerPhone)
    .is("payment_id", null)
    .select()
    .single();

  if (updateError || !updated) {
    return res.status(400).json({
      success: false,
      error: "Could not link payment to consultation"
    });
  }

  return res.status(200).json({
    success: true,
    consultation: updated
  });
}
    const { data, error } = await supabase
      .from("consultations")
      .insert([
        {
          customer_phone: customerPhone || null,
          customer_message: customerMessage || null,
          supporting_image_url: supportingImageUrl || null,
payment_id: paymentId || null
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
