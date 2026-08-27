export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { callSid } = req.body;

    if (!callSid) {
      return res.status(400).json({
        success: false,
        error: "Missing call SID"
      });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    const auth = Buffer.from(
      `${accountSid}:${authToken}`
    ).toString("base64");

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callSid}.json`,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Twilio call status error:", data);

      return res.status(response.status).json({
        success: false,
        error: "Could not check call status",
        details: data
      });
    }

    return res.status(200).json({
      success: true,
      status: data.status,
      duration: data.duration
    });

  } catch (error) {
    console.error("Call status server error:", error);

    return res.status(500).json({
      success: false,
      error: "Call status server error"
    });
  }
}
