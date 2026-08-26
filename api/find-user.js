export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        error: "Missing phone number"
      });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

    const response = await fetch(
      `${supabaseUrl}/rest/v1/users?phone_number=eq.${encodeURIComponent(phone)}&select=id,phone_number,square_customer_id,square_card_id`,
      {
        method: "GET",
        headers: {
          "apikey": supabaseSecretKey,
          "Authorization": `Bearer ${supabaseSecretKey}`,
          "Content-Type": "application/json"
        }
      }
    );

    const users = await response.json();

    if (!response.ok) {
      console.error("Supabase error:", users);

      return res.status(response.status).json({
        success: false,
        error: "Could not look up customer"
      });
    }

    if (!users || users.length === 0) {
      return res.status(200).json({
        success: true,
        found: false
      });
    }

    const user = users[0];

    return res.status(200).json({
      success: true,
      found: true,
      user: {
        id: user.id,
        phone_number: user.phone_number,
        square_customer_id: user.square_customer_id,
        square_card_id: user.square_card_id
      }
    });

  } catch (error) {
    console.error("Find user error:", error);

    return res.status(500).json({
      success: false,
      error: "Customer lookup server error"
    });
  }
}
