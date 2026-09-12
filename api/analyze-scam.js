export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    const { text } = req.body || {};

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: "Please enter a message to analyze."
      });
    }

    const cleanText = text.trim();

    // Limit submission size to help control cost and abuse.
    if (cleanText.length > 10000) {
      return res.status(400).json({
        success: false,
        error: "Please shorten the message to 10,000 characters or less."
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.error("OPENAI_API_KEY is not configured.");

      return res.status(500).json({
        success: false,
        error: "The automated check is temporarily unavailable."
      });
    }

    const instructions = `
You are the automated scam-analysis system for ScamCheck.

Analyze the user's submitted communication for signs of fraud or deception.

Look for indicators including:
- urgency, threats, pressure, or artificial deadlines
- requests for gift cards, cryptocurrency, wire transfers, cash, or unusual payment methods
- requests for passwords, verification codes, banking information, Social Security numbers, or other sensitive information
- impersonation of banks, government agencies, businesses, employers, family members, technical support, or other trusted organizations
- suspicious links, domains, email addresses, or contact instructions that appear in the submitted text
- unexpected prizes, refunds, inheritances, investments, jobs, loans, romance requests, account problems, or payment demands
- requests to move conversations away from normal or official communication channels
- secrecy requests
- common phishing, advance-fee, investment, romance, employment, technical-support, account-takeover, and impersonation patterns
- inconsistencies or other warning signs in the wording or circumstances

Important rules:
- Analyze only the information provided.
- Do not claim that you searched the internet, databases, complaint records, phone-number reports, email reputation services, or websites.
- Do not claim that other people have reported the message unless that information was actually supplied.
- Do not guarantee that something is safe or fraudulent.
- Never tell the user that a low-risk result proves the sender is legitimate.
- If information is insufficient, say so.
- Encourage verification through independently obtained official contact information when appropriate.
- Never advise the user to call a phone number, click a link, or use contact information contained in the suspicious message itself.

Return the analysis in this exact format:

RISK LEVEL: [HIGH RISK, CAUTION, or LOWER RISK]

WHY:
[Give a concise plain-English explanation.]

WARNING SIGNS:
[Give the most important warning signs. If none are obvious, say that.]

WHAT TO DO:
[Give short, practical next steps.]

REMEMBER:
This is an automated informational opinion, not a guarantee. If you are still unsure, talk to a ScamCheck advisor.
`;

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-5.6-luna",
          instructions: instructions,
          input: cleanText,
          max_output_tokens: 700
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "OpenAI API error:",
        response.status,
        data?.error?.message || "Unknown error"
      );

      return res.status(500).json({
        success: false,
        error: "The automated check is temporarily unavailable."
      });
    }

    let analysis = data.output_text;

    if (!analysis && Array.isArray(data.output)) {
      analysis = data.output
        .flatMap(item => item.content || [])
        .filter(item => item.type === "output_text")
        .map(item => item.text || "")
        .join("\n")
        .trim();
    }

    if (!analysis) {
      console.error("No analysis text returned by OpenAI.");

      return res.status(500).json({
        success: false,
        error: "The automated check could not produce a result."
      });
    }

    return res.status(200).json({
      success: true,
      analysis: analysis
    });

  } catch (error) {
    console.error("Scam analysis error:", error);

    return res.status(500).json({
      success: false,
      error: "The automated check is temporarily unavailable."
    });
  }
}
