import crypto from "crypto";

export default function handler(req, res) {
  if (!process.env.ADVISOR_PASSWORD) {
    return res.status(500).json({ authenticated: false });
  }

  const cookies = req.headers.cookie || "";

  const sessionToken = crypto
    .createHmac("sha256", process.env.ADVISOR_PASSWORD)
    .update("scamcheck-advisor-session")
    .digest("hex");

  const expectedCookie = `scamcheck_advisor=${sessionToken}`;

  if (!cookies.includes(expectedCookie)) {
    return res.status(401).json({
      authenticated: false
    });
  }

  return res.status(200).json({
    authenticated: true
  });
}
