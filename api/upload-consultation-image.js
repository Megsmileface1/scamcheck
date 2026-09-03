import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { fileName, fileType, fileData } = req.body;

    if (!fileName || !fileData) {
      return res.status(400).json({ error: "Missing image data" });
    }

    const buffer = Buffer.from(fileData, "base64");

    const safeFileName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    const { error: uploadError } = await supabase.storage
      .from("consultation-images")
      .upload(safeFileName, buffer, {
        contentType: fileType || "image/jpeg",
        upsert: false
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from("consultation-images")
      .getPublicUrl(safeFileName);

    return res.status(200).json({
      success: true,
      imageUrl: data.publicUrl
    });

  } catch (error) {
    console.error("Upload consultation image error:", error);

    return res.status(500).json({
      error: "Could not upload image"
    });
  }
}
