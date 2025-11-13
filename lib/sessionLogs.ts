import { supabase } from "./supabaseClient";

export async function logSessionEvent(userId: string, event: string, conversationId?: string) {
  // Insert a session log row in Supabase
  return supabase.from("session_logs").insert({
    user_id: userId,
    event,
    conversation_id: conversationId || null,
  });
}
