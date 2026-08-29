export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const dialCallStatus = req.body.DialCallStatus || "";
const paymentId = req.query.paymentId || "";
  console.log("Advisor call status:", dialCallStatus);

  res.setHeader("Content-Type", "text/xml");
return res.status(200).send("<Response><Say>We are sorry. A ScamCheck advisor is not available right now. Please try again shortly.</Say><Hangup/></Response>");
}
