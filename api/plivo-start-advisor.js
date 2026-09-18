export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const {
      paymentId,
      consultationId,
      roomId,
      prepaid
    } = req.body;

    if (!consultationId || !roomId) {
      return res.status(400).json({
        success: false,
        error: "Missing consultation or conference room"
      });
    }

    const authId = process.env.PLIVO_AUTH_ID;
    const authToken = process.env.PLIVO_AUTH_TOKEN;
    const plivoNumber = process.env.PLIVO_PHONE_NUMBER;
    const advisorPhone =
      process.env.SCAMCHECK_ADVISOR_PHONE;

    if (
      !authId ||
      !authToken ||
      !plivoNumber ||
      !advisorPhone
    ) {
      console.error(
        "Missing Plivo or advisor environment variables"
      );

      return res.status(500).json({
        success: false,
        error: "Advisor calling is not configured"
      });
    }

    const params = new URLSearchParams({
      paymentId: paymentId || "",
      consultationId,
      roomId,
      prepaid: prepaid ? "1" : "0"
    });

    const answerUrl =
      `https://askscamcheck.com/api/plivo-advisor-answer?${params.toString()}`;

    const hangupUrl =
      `https://askscamcheck.com/api/plivo-advisor-status?${params.toString()}`;

    const auth = Buffer.from(
      `${authId}:${authToken}`
    ).toString("base64");

    const response = await fetch(
      `https://api.plivo.com/v1/Account/${authId}/Call/`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: plivoNumber,
          to: advisorPhone,
          answer_url: answerUrl,
          answer_method: "POST",
          hangup_url: hangupUrl,
          hangup_method: "POST",
          hangup_on_ring: 20
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "Plivo advisor call error:",
        data
      );

      return res.status(response.status).json({
        success: false,
        error: "Advisor call could not be started"
      });
    }

    return res.status(200).json({
      success: true,
      requestUuid: data.request_uuid || null
    });

  } catch (error) {
    console.error(
      "Plivo advisor call server error:",
      error
    );

    return res.status(500).json({
      success: false,
      error: "Advisor call server error"
    });
  }
}z
