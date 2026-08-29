export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
  const { customerPhone, paymentId } = req.body;
    if (!customerPhone) {
      return res.status(400).json({
        error: "Missing customer phone number"
      });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
    const advisorPhone = process.env.SCAMCHECK_ADVISOR_PHONE;

    const auth =
      Buffer.from(`${accountSid}:${authToken}`).toString("base64");

    const twiml = `
      <Response>
        <Say>
          Please hold while ScamCheck connects you to an advisor.
        </Say>
      <Dial
  callerId="${twilioNumber}"
 action="https://scamcheck-lac.vercel.app/api/advisor-status"
  method="POST"
>
     <Number timeout="20" url="https://scamcheck-lac.vercel.app/api/advisor-screen?paymentId=${encodeURIComponent(paymentId || "")}">${advisorPhone}</Number>
        </Dial>
      </Response>
    `;

    const body = new URLSearchParams({
      To: customerPhone,
      From: twilioNumber,
      Twiml: twiml
    });

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Twilio error:", data);

      return res.status(response.status).json({
        success: false,
        error: "Call could not be started",
        details: data
      });
    }

    return res.status(200).json({
      success: true,
      callSid: data.sid
    });

  } catch (error) {
    console.error("Call error:", error);

    return res.status(500).json({
      success: false,
      error: "Call server error"
    });
  }
}
