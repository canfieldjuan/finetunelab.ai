import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  // This endpoint should be protected and only callable by the logged-in user.
  // In production, validate the user's session and identity here.
  // For MVP, use Supabase Admin API to delete the user (requires service role key).
  const { SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL } = process.env;
  if (!SUPABASE_SERVICE_ROLE_KEY || !NEXT_PUBLIC_SUPABASE_URL) {
    console.error("Missing Supabase service role key or URL", {
      SUPABASE_SERVICE_ROLE_KEY: !!SUPABASE_SERVICE_ROLE_KEY,
      NEXT_PUBLIC_SUPABASE_URL: !!NEXT_PUBLIC_SUPABASE_URL,
    });
    return res.status(500).json({ error: "Missing Supabase service role key or URL" });
  }
  const { user_id } = req.body;
  if (!user_id) {
    console.error("Missing user_id in request body", req.body);
    return res.status(400).json({ error: "Missing user_id" });
  }
  try {
    const resp = await fetch(`${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users/${user_id}`, {
      method: "DELETE",
      headers: {
        apiKey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    if (resp.ok) {
      return res.status(200).json({ success: true });
    } else {
      const error = await resp.json();
      console.error("Supabase delete user error", error);
      return res.status(500).json({ error });
    }
  } catch (err) {
    console.error("Unexpected error in delete-account API", err);
    return res.status(500).json({ error: "Unexpected error" });
  }
}
