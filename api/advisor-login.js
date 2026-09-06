export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false });
  }

  const { password } = req.body || {};

  if (!process.env.ADVISOR_PASSWORD) {
    console.error("ADVISOR_PASSWORD is not configured.");
    return res.status(500).json({ success: false });
  }

  if (password !== process.env.ADVISOR_PASSWORD) {
    return res.status(401).json({
      success: false,
      message: "Incorrect password."
    });
  }

  return res.status(200).json({
    success: true
  });
}
