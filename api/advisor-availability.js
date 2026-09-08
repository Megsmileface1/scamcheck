import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("advisor_availability")
        .select("is_available")
        .eq("id", 1)
        .single();

      if (error) {
        throw error;
      }

      return res.status(200).json({
        success: true,
        isAvailable: data.is_available
      });
    }

    if (req.method === "POST") {
      if (!process.env.ADVISOR_PASSWORD) {
        return res.status(500).json({
          error: "Advisor authentication is not configured"
        });
      }

      const cookies = req.headers.cookie || "";

      const sessionToken = crypto
        .createHmac("sha256", process.env.ADVISOR_PASSWORD)
        .update("scamcheck-advisor-session")
        .digest("hex");

      const expectedCookie = `scamcheck_advisor=${sessionToken}`;

      if (!cookies.includes(expectedCookie)) {
        return res.status(401).json({
          error: "Unauthorized"
        });
      }

      const { isAvailable } = req.body;

      if (typeof isAvailable !== "boolean") {
        return res.status(400).json({
          error: "Invalid availability value"
        });
      }

      const { error } = await supabase
        .from("advisor_availability")
        .update({
          is_available: isAvailable
        })
        .eq("id", 1);

      if (error) {
        throw error;
      }

      return res.status(200).json({
        success: true,
        isAvailable
      });
    }

    return res.status(405).json({
      error: "Method not allowed"
    });

  } catch (error) {
    console.error("Advisor availability error:", error);

    return res.status(500).json({
      success: false,
      error: "Could not manage advisor availability"
    });
  }
}
