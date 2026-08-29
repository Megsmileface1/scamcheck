export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { squareCustomerId, squareCardId } = req.body;

    if (!squareCustomerId || !squareCardId) {
      return res.status(400).json({
        success: false,
        error: "Missing saved payment information"
      });
    }

    const idempotencyKey =
      "saved-" +
      Date.now().toString() +
      "-" +
      Math.random().toString(36).substring(2);

    const squareResponse = await fetch(
      "https://connect.squareupsandbox.com/v2/payments",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Square-Version": "2026-08-19",
          "Authorization": `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`
        },
        body: JSON.stringify({
          source_id: squareCardId,
          idempotency_key: idempotencyKey,
          amount_money: {
            amount: 1000,
            currency: "USD"
          },
          customer_id: squareCustomerId,
         autocomplete: false,
          note: "ScamCheck returning customer consultation"
        })
      }
    );

    const data = await squareResponse.json();

    if (!squareResponse.ok) {
      console.error("Saved card payment error:", data);

      return res.status(squareResponse.status).json({
        success: false,
        error: "Saved card payment could not be completed",
        details: data
      });
    }

    return res.status(200).json({
      success: true,
      payment: data.payment
    });

  } catch (error) {
    console.error("Saved card charge error:", error);

    return res.status(500).json({
      success: false,
      error: "Saved card payment server error"
    });
  }
}
