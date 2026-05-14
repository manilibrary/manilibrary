/** Fields stored in `profiles.profile_extras` (jsonb) in the new schema. */

export type ProfileExtrasShape = {
  aadhaar_last_four?: string | null;
  student_roll_number?: string | null;
  institution_type?: string | null;
  preparing_for?: string | null;
};

export function mergeProfileExtras(
  current: unknown,
  patch: Partial<ProfileExtrasShape>,
): Record<string, unknown> {
  const base =
    current && typeof current === "object" && !Array.isArray(current)
      ? { ...(current as Record<string, unknown>) }
      : {};
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) base[k] = v;
  }
  return base;
}

export function extrasToDisplayFields(extras: unknown): Required<
  Pick<ProfileExtrasShape, "aadhaar_last_four" | "student_roll_number" | "institution_type" | "preparing_for">
> {
  const o = extras && typeof extras === "object" ? (extras as Record<string, unknown>) : {};
  return {
    aadhaar_last_four: (o.aadhaar_last_four as string | null | undefined) ?? null,
    student_roll_number: (o.student_roll_number as string | null | undefined) ?? null,
    institution_type: (o.institution_type as string | null | undefined) ?? null,
    preparing_for: (o.preparing_for as string | null | undefined) ?? null,
  };
}
