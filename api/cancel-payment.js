export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { paymentId } = req.body;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        error: "Missing payment ID"
      });
    }

    const squareResponse = await fetch(
      `https://connect.squareupsandbox.com/v2/payments/${paymentId}/cancel`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Square-Version": "2026-08-19",
          "Authorization": `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`
        }
      }
    );

    const data = await squareResponse.json();

    if (!squareResponse.ok) {
      console.error("Cancel payment error:", data);

      return res.status(squareResponse.status).json({
        success: false,
        error: "Payment could not be canceled",
        details: data
      });
    }

    return res.status(200).json({
      success: true,
      payment: data.payment
    });

  } catch (error) {
    console.error("Cancel payment server error:", error);

    return res.status(500).json({
      success: false,
      error: "Cancel payment server error"
    });
  }
}
