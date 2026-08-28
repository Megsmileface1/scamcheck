export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const dialCallStatus = req.body.DialCallStatus || "";

  console.log("Advisor call status:", dialCallStatus);

  return res.status(200).send("OK");
}
