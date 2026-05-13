import { apiError, apiSuccess } from "@/lib/api/json-response";
import { requireLibrarySuperAdmin } from "@/lib/supabase/require-library-super-admin";

export const runtime = "nodejs";

export async function GET() {
  const gate = await requireLibrarySuperAdmin();
  if (!gate.ok) {
    return apiError(gate.message, gate.status);
  }

  const razorpayKeyId = Boolean(process.env.RAZORPAY_KEY_ID?.trim());
  const razorpayKeySecret = Boolean(process.env.RAZORPAY_KEY_SECRET?.trim());
  const etimeBasic =
    Boolean(process.env.ETIME_BASIC_USER?.trim()) &&
    Boolean(process.env.ETIME_BASIC_PASSWORD?.trim());
  const etimeAuth = Boolean(process.env.ETIME_AUTHORIZATION?.trim());
  const etimeOrigin = Boolean(process.env.ETIME_API_ORIGIN?.trim());
  const etimeUserPass =
    Boolean(process.env.ETIME_CORPORATE_ID?.trim()) &&
    Boolean(process.env.ETIME_USER?.trim()) &&
    Boolean(process.env.ETIME_PASS?.trim());

  return apiSuccess("Environment flags (values are never returned).", {
    razorpay: { keyId: razorpayKeyId, keySecret: razorpayKeySecret },
    etime: {
      apiOrigin: etimeOrigin,
      basicCredentials: etimeBasic,
      authorizationHeader: etimeAuth,
      corporateUserPass: etimeUserPass,
      ready: etimeOrigin && (etimeBasic || etimeAuth || etimeUserPass),
    },
  });
}
