export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const {
      phone,
      squareCustomerId,
      squareCardId
    } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: "Missing phone number"
      });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

    const lookupResponse = await fetch(
      `${supabaseUrl}/rest/v1/users?phone_number=eq.${encodeURIComponent(phone)}&select=id`,
      {
        method: "GET",
        headers: {
          "apikey": supabaseSecretKey,
          "Authorization": `Bearer ${supabaseSecretKey}`,
          "Content-Type": "application/json"
        }
      }
    );

    const existingUsers = await lookupResponse.json();

    if (!lookupResponse.ok) {
      return res.status(lookupResponse.status).json({
        success: false,
        error: "Could not check existing customer"
      });
    }

    if (existingUsers && existingUsers.length > 0) {
      const userId = existingUsers[0].id;

      const updateResponse = await fetch(
        `${supabaseUrl}/rest/v1/users?id=eq.${userId}`,
        {
          method: "PATCH",
          headers: {
            "apikey": supabaseSecretKey,
            "Authorization": `Bearer ${supabaseSecretKey}`,
            "Content-Type": "application/json",
            "Prefer": "return=representation"
          },
          body: JSON.stringify({
            square_customer_id: squareCustomerId || null,
            square_card_id: squareCardId || null
          })
        }
      );

      const updatedUsers = await updateResponse.json();

      if (!updateResponse.ok) {
        return res.status(updateResponse.status).json({
          success: false,
          error: "Could not update customer"
        });
      }

      return res.status(200).json({
        success: true,
        created: false,
        user: updatedUsers[0]
      });
    }

    const createResponse = await fetch(
      `${supabaseUrl}/rest/v1/users`,
      {
        method: "POST",
        headers: {
          "apikey": supabaseSecretKey,
          "Authorization": `Bearer ${supabaseSecretKey}`,
          "Content-Type": "application/json",
          "Prefer": "return=representation"
        },
        body: JSON.stringify({
          phone_number: phone,
          square_customer_id: squareCustomerId || null,
          square_card_id: squareCardId || null,
          call_credits: 0
        })
      }
    );

    const newUsers = await createResponse.json();

    if (!createResponse.ok) {
      return res.status(createResponse.status).json({
        success: false,
        error: "Could not create customer"
      });
    }

    return res.status(200).json({
      success: true,
      created: true,
      user: newUsers[0]
    });

  } catch (error) {
    console.error("Save user error:", error);

    return res.status(500).json({
      success: false,
      error: "Customer save server error"
    });
  }
}
