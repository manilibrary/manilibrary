/**
 * Mock occupancy for UI-only membership / seat flow (replace with Supabase later).
 */

/** Long-term hall: fixed desks not sold (matches Expo defaults). */
export const LONG_TERM_BLOCKED = new Set([9, 56, 60, 61]);

/** Long-term: taken by other members (monthly / longer plans). */
export const LONG_TERM_MEMBER_OCCUPIED = new Set([20, 21, 30, 31, 48, 49, 72, 73]);

/**
 * “Home” desk — same member’s reserved long-term seat when away (design concept).
 */
export const LONG_TERM_HOME_HELD = new Set([14, 15, 16]);

/** Short-term: day / week passes currently checked in. */
export const SHORT_TERM_OCCUPIED = new Set([7, 8, 22, 23, 44, 45, 58, 59]);
