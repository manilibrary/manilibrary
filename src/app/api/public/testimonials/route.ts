import { apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { displayPersonName } from "@/lib/format-person-name";
import { extrasToDisplayFields } from "@/lib/profiles/profile-extras";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

export async function GET() {
  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Could not load testimonials.");
  }

  const { data, error } = await admin
    .from("profiles")
    .select("full_name, avatar_url, profile_extras, user_feedback_rating, user_feedback_comment")
    .eq("user_feedback_approved", true)
    .is("deleted_at", null)
    .not("user_feedback_rating", "is", null)
    .not("user_feedback_comment", "is", null)
    .order("updated_at", { ascending: false })
    .limit(24);

  if (error) return apiErrorSafe(error, 500);

  const testimonials = (data ?? [])
    .filter((r) => r.user_feedback_comment?.trim())
    .map((r) => {
      const preparingFor = extrasToDisplayFields(r.profile_extras).preparing_for?.trim();
      return {
        fullName: displayPersonName(r.full_name, "Member"),
        subtitle: preparingFor || "Mani Library member",
        avatarUrl: r.avatar_url ?? null,
        rating: r.user_feedback_rating,
        comment: r.user_feedback_comment,
      };
    });

  return apiSuccess("OK.", { testimonials });
}
