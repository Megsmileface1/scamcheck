export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {

    const { sourceId, phone } = req.body;
let squarePhone = phone;

if (phone && !phone.startsWith("+")) {
  const digits = phone.replace(/\D/g, "");

  if (digits.length === 10) {
    squarePhone = "+1" + digits;
  } else if (digits.length === 11 && digits.startsWith("1")) {
    squarePhone = "+" + digits;
  }
}
    if (!sourceId) {
      return res.status(400).json({
        error: "Missing payment source"
      });
    }

    const idempotencyKey =
      Date.now().toString() +
      Math.random().toString(36).substring(2);

    const squareResponse = await fetch(
      "https://connect.squareupsandbox.com/v2/payments",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Square-Version": "2026-08-19",
          "Authorization":
            `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`
        },

        body: JSON.stringify({
          source_id: sourceId,
          idempotency_key: idempotencyKey,

          amount_money: {
            amount: 1000,
            currency: "USD"
          },

         autocomplete: false,
          note: "ScamCheck consultation"
        })
      }
    );

    const data = await squareResponse.json();

    if (!squareResponse.ok) {

      console.error("Square error:", data);

      return res.status(squareResponse.status).json({
        success: false,
        error: "Payment could not be completed",
        details: data
      });
    }
let squareCustomerId = null;
let squareCardId = null;

if (phone) {
  const customerResponse = await fetch(
    "https://connect.squareupsandbox.com/v2/customers",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Square-Version": "2026-08-19",
        "Authorization": `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        idempotency_key:
          "cust-" + Date.now() + "-" +
          Math.random().toString(36).substring(2),
       phone_number: squarePhone
      })
    }
  );

  const customerData = await customerResponse.json();

 if (!customerResponse.ok) {
  console.error("Square customer error:", customerData);

  try {
   const cancelResponse = await fetch(
  `https://connect.squareupsandbox.com/v2/payments/${data.payment.id}/cancel`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Square-Version": "2026-08-19",
      "Authorization": `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`
    },
    body: JSON.stringify({})
  }
);

if (!cancelResponse.ok) {
  console.error("Square payment cancellation failed");
}
  } catch (cancelError) {
    console.error("Payment cancellation error:", cancelError);
  }

  throw new Error("Could not create Square customer");
}

  squareCustomerId = customerData.customer.id;

  const cardResponse = await fetch(
    "https://connect.squareupsandbox.com/v2/cards",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Square-Version": "2026-08-19",
        "Authorization": `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        idempotency_key:
          "card-" + Date.now() + "-" +
          Math.random().toString(36).substring(2),
        source_id: data.payment.id,
        card: {
          customer_id: squareCustomerId
        }
      })
    }
  );

  const cardData = await cardResponse.json();

 if (!cardResponse.ok) {
  console.error("Square card error:", cardData);

  try {
    await fetch(
      `https://connect.squareupsandbox.com/v2/payments/${data.payment.id}/cancel`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Square-Version": "2026-08-19",
          "Authorization": `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`
        },
        body: JSON.stringify({})
      }
    );
  } catch (cancelError) {
    console.error("Payment cancellation error:", cancelError);
  }

  throw new Error("Card could not be saved");
}

  squareCardId = cardData.card.id;
}
   return res.status(200).json({
  success: true,
  payment: data.payment,
  squareCustomerId: squareCustomerId,
  squareCardId: squareCardId
});

  } catch (error) {

    console.error("Payment error:", error);

    return res.status(500).json({
      success: false,
      error: "Payment server error"
    });
  }
}
