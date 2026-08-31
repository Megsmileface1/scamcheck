export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  const paymentId = req.query.paymentId;

  if (!paymentId) {
    return res.status(400).json({
      success: false,
      error: "Missing payment ID"
    });
  }

  try {
    const response = await fetch(
      `https://connect.squareupsandbox.com/v2/payments/${paymentId}`,
      {
        method: "GET",
        headers: {
          "Square-Version": "2026-08-19",
          "Authorization": `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: "Could not check payment status"
      });
    }

    return res.status(200).json({
      success: true,
      status: data.payment.status
    });

  } catch (error) {
    console.error("Payment status error:", error);

    return res.status(500).json({
      success: false,
      error: "Payment status server error"
    });
  }
}
