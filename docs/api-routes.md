# Mani Library — API guide (order of use)

Use one **base host** for the website and its `/api/...` routes:

| Environment | Example base (no trailing slash) |
|---------------|-----------------------------------|
| Local Next.js | `http://localhost:3000` |
| Production | `https://your-domain.com` |

Replace `BASE` below with that value (e.g. `http://localhost:3000`).

### JSON shape for every `BASE/api/...` route (Postman)

| Outcome | Body always includes |
|---------|----------------------|
| **Success** | `"ok": true`, `"message": "<short human-readable sentence>"`, plus route-specific fields (`rows`, `stats`, `membership`, `order_id`, …). |
| **Error** | `"ok": false`, `"error": "<reason>"`, `"message": "<same text as error>"`, plus optional extras (`hint`, `snippet`, …). |

Implementation: `src/lib/api/json-response.ts` (`apiSuccess`, `apiError`, `apiSuccessWithEnvelope`).  
**eTime proxy** routes add `ok` + `message` on top of the vendor JSON (`Error`, `InOutPunchData`, `PunchData`, …).

For **Supabase Auth** (register + login), you also need values from `.env` / Supabase dashboard:

| Variable | Used for |
|----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Full Supabase API root, e.g. `https://abcdefgh.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (safe for signup / password login from Postman if you treat the key as secret in production) |

Replace `SUPABASE_URL` and `ANON_KEY` in the steps below with those real values.

---

## 1. Register (create account)

There is **no** `BASE/api/register` route. Sign-up is **Supabase Auth**.

### Full API link (paste in Postman)

```
POST {{SUPABASE_URL}}/auth/v1/signup
```

Example: `POST https://abcdefgh.supabase.co/auth/v1/signup`

### How to send the request in Postman

| Tab | Action |
|-----|--------|
| **Method** | `POST` |
| **URL** | Paste the link above (your real `SUPABASE_URL`). |
| **Headers** | Add `apikey` = your **anon** key. Add `Content-Type` = `application/json`. |
| **Body** | **raw** → **JSON** |

### Body JSON — fields

| Field | Required? | Notes |
|-------|-----------|--------|
| `email` | **Yes** | Valid email; becomes the login id. |
| `password` | **Yes** | Min length depends on Supabase project settings (app UI uses ≥ 6). |
| `data` | No | Optional metadata stored on the user. This app expects `full_name` and optionally `phone` inside `data`. |

**Example body**

```json
{
  "email": "member@example.com",
  "password": "your-secure-password",
  "data": {
    "full_name": "Priya Sharma",
    "phone": "+91 98765 43210"
  }
}
```

### What you get back

JSON includes `user` and may include `session` (with `access_token`) if email confirmation is off. If your project requires **email confirmation**, there may be no session until the user confirms — then they use **Login** (section 2).

**Database:** A trigger or backend usually creates `public.profiles` for the new `auth.users` row. If `member_number` is missing, some member APIs will fail until an admin assigns it.

---

## 2. Login (get a session on this app)

Use this so Postman gets the **same session cookies** as the website. Then you can call `/api/me/...` and other routes without copying cookies from the browser.

### API link (local — paste in Postman)

```
http://localhost:3000/api/auth/login
```

On production, use your real host, e.g. `https://your-domain.com/api/auth/login`.

### How to send it in Postman

| Step | What to do |
|------|------------|
| 1 | Set method to **`POST`**. |
| 2 | In the URL bar, paste **`http://localhost:3000/api/auth/login`**. |
| 3 | Open the **Body** tab → choose **raw** → on the right choose **JSON**. |
| 4 | Paste the JSON below (use your real email and password). |
| 5 | Click **Send**. |

### Pass this in the body (JSON)

| Field | Required? |
|-------|-----------|
| `email` | **Yes** |
| `password` | **Yes** |

**Example (copy and edit)**

```json
{
  "email": "member@example.com",
  "password": "your-secure-password"
}
```

### What comes back when login works

Status **200** and a body like:

```json
{
  "ok": true,
  "message": "Login successful.",
  "user": {
    "id": "uuid-of-auth-user",
    "email": "member@example.com"
  }
}
```

If email or password is wrong, you get **401** and `{ "ok": false, "error": "..." }`.

### Cookies in Postman (important)

This route also returns **`Set-Cookie`** headers (Supabase session). So the next requests to `http://localhost:3000/api/...` can use the same session **if Postman keeps cookies**:

- In Postman, open **Settings** (gear) → enable **“Automatically follow redirects”** if you use redirects elsewhere.
- Send your **login** request first, then send **member/admin** requests to the **same host** (`localhost:3000`) in the same Postman **collection** / tab flow — Postman stores cookies per domain.

If a later request returns **401**, send **login** again to refresh the session.

### Alternative — login only on Supabase (no app cookies)

If you need tokens without hitting Next.js:

```
POST {{SUPABASE_URL}}/auth/v1/token?grant_type=password
```

Headers: `apikey` = anon key, `Content-Type` = `application/json`.  
Body: same `{ "email", "password" }`.  
That does **not** set cookies for `BASE/api/...`; use **`/api/auth/login`** above for this app’s APIs.

---

## 3. Member — after login (website + APIs)

Do these in a sensible order: profile → optional KYC uploads → check seats → buy membership → confirm payment.

---

### 3.1 Save profile / KYC intake fields

**Link**

```
PATCH BASE/api/me/profile-intake
```

Example: `PATCH http://localhost:3000/api/me/profile-intake`

| Tab | Action |
|-----|--------|
| **Headers** | Session **Cookie** (**required**) — send **`POST BASE/api/auth/login`** first in Postman, or paste `Cookie` from the browser after `BASE/login`. Also set `Content-Type` = `application/json`. |
| **Body** | **raw** → **JSON** — send **at least one** field |

| Field | Required? | Rules |
|-------|-----------|--------|
| `aadhaar_last_four` | No* | Exactly 4 digits, or `null`. |
| `student_roll_number` | No | String or `null`. |
| `institution_type` | No | One of: `school`, `college`, `freelance`, `other`, or `null`. |
| `preparing_for` | No | String or `null`. |

\*At least one of the four keys must be present in the JSON.

---

### 3.2 Upload KYC documents (optional)

**Link**

```
POST BASE/api/me/verification/document
```

| Tab | Action |
|-----|--------|
| **Headers** | `Cookie` (**required**). Do **not** set `Content-Type` manually. |
| **Body** | **form-data** |

| Key | Type | Required? | Allowed values |
|-----|------|-------------|------------------|
| `file` | File | **Yes** | JPEG, PNG, WebP, or PDF, max 5 MB. |
| `docType` | Text | **Yes** | `aadhaar_front`, `aadhaar_back`, or `student_id`. |

Upload is only allowed when profile `verification_status` is `none` or `resubmit`.

---

### 3.3 Upload or remove avatar (optional)

**Upload**

```
POST BASE/api/me/avatar
```

| Body (form-data) | Required? |
|------------------|-----------|
| `file` (image) | **Yes** — JPEG / PNG / WebP, max 2 MB |

**Remove**

```
DELETE BASE/api/me/avatar
```

| Body | none |

Both need **`Cookie`**.

---

### 3.4 See which seats are taken (before buying)

**Link**

```
GET BASE/api/memberships/seat-occupancy?planKind=long_term
```

or

```
GET BASE/api/memberships/seat-occupancy?planKind=short_term
```

| Query param | Required? | Value |
|-------------|-----------|--------|
| `planKind` | **Yes** | `long_term` or `short_term` |

| Headers | No `Cookie` required |

---

### 3.5 Buy membership (create pending row + Razorpay order)

**Link**

```
POST BASE/api/payments/razorpay/create-order
```

| Headers | Session **Cookie** (**required**) — use **`POST BASE/api/auth/login`** first, or sign in on `BASE/login` in the browser. |
| **Body** | **raw** → **JSON** |

| Field | Required? | Notes |
|-------|-----------|--------|
| `planKind` | **Yes** | `short_term` or `long_term`. |
| `seatNumber` | **Yes** | Integer seat number. |
| `membershipStartDate` | **Yes** | `YYYY-MM-DD`, on or after “today” in the app’s library timezone. |
| `durationKey` | **Yes** | Short-term: `st_1d`, `st_7d`. Long-term: `lt_1m`, `lt_3m`, `lt_6m`, `lt_12m`. |

**Example**

```json
{
  "planKind": "long_term",
  "seatNumber": 12,
  "membershipStartDate": "2026-06-01",
  "durationKey": "lt_1m"
}
```

**Response:** Save `paymentId`, `membershipId`, `orderId`, `amount`, `keyId` — you need `paymentId` and Razorpay fields for the next step (checkout is normally done in the browser with Razorpay.js; in Postman you only simulate the **server** calls after you have a real payment id and signature from checkout).

---

### 3.6 Confirm payment (after Razorpay checkout)

**Link**

```
POST BASE/api/payments/razorpay/verify
```

| Headers | `Cookie` (**required**) |
| **Body** | **JSON** |

| Field | Required? |
|-------|-----------|
| `razorpay_order_id` | **Yes** |
| `razorpay_payment_id` | **Yes** |
| `razorpay_signature` | **Yes** |
| `payment_id` | **Yes** | UUID returned from step 3.5 |

---

### 3.7 Reconcile payment if verify was missed (optional)

**Link**

```
POST BASE/api/payments/razorpay/reconcile
```

| Headers | `Cookie` (**required**) |
| **Body** | **JSON** `{ "razorpay_payment_id": "pay_..." }` |

| Field | Required? |
|-------|-----------|
| `razorpay_payment_id` | **Yes** — must start with `pay_`. |

---

### 3.8 Check active membership

**Link**

```
GET BASE/api/memberships/me-active
```

| Headers | `Cookie` (**required**) |
| **Body** | none |

---

### 3.9 Today’s attendance (member)

**Link**

```
GET BASE/api/me/today-attendance
```

| Headers | `Cookie` (**required**) |
| **Body** | none |

Requires `member_number` on `profiles` and eTime configured on the server.

---

### 3.10 Razorpay demo only (no membership row)

Not part of the normal member journey; for testing Razorpay keys only.

**Create order**

```
POST BASE/api/create-order
```

Body JSON: `amount` (**Yes**, integer paise, min 100), `currency` (optional, default `INR`), `receipt` (optional).

**Verify signature only**

```
POST BASE/api/verify-payment
```

Body: `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature` (all **Yes**). No `Cookie`.

---

## 4. Admin (library staff)

Every URL below needs a session **`Cookie`** for a user with **`profiles.is_admin = true`**. Get it with **`POST BASE/api/auth/login`** (admin email/password) in Postman, or sign in on **`BASE/login`** in the browser and copy the cookie.

---

### 4.1 Dashboard numbers

```
GET BASE/api/admin/overview
```

| Params | none | Body | none |

---

### 4.2 Members + membership rows

```
GET BASE/api/admin/members/list
```

| Params | none | Body | none |

---

### 4.3 Payments

```
GET BASE/api/admin/payments/list
```

| Params | none | Body | none |

---

### 4.4 Approve KYC for a user

```
POST BASE/api/admin/profiles/verify
```

**Body JSON**

| Field | Required? |
|-------|-----------|
| `user_id` | **Yes** — `auth.users` id (UUID). |

---

### 4.5 Reject or ask member to resubmit KYC

```
POST BASE/api/admin/profiles/verification-respond
```

| Field | Required? |
|-------|-----------|
| `user_id` | **Yes** |
| `action` | **Yes** — `reject` or `request_resubmit` |
| `student_message` | No — text shown to student path in DB (optional) |

---

### 4.6 Download KYC files for one member

```
GET BASE/api/admin/members/USER_UUID/kyc-documents
```

Replace `USER_UUID` in the path. No query params.

---

### 4.7 Attendance by date range

```
GET BASE/api/admin/attendance/daily?fromDate=DD/MM/YYYY&toDate=DD/MM/YYYY
```

| Query param | Required? | Example |
|-------------|-------------|---------|
| `fromDate` | No (defaults today) | `12/05/2026` |
| `toDate` | No | same as from for one day |
| `empcode` | No | filter one device code |

---

### 4.8 Last punches

```
GET BASE/api/admin/attendance/last-punches
```

| Query param | Required? |
|-------------|-----------|
| `empcode` | No |
| `lastRecord` | No — eTime cursor |

---

### 4.9 Raw eTime (debug / integration)

| Purpose | Link |
|---------|------|
| In/out summary | `GET BASE/api/integrations/etime/in-out?fromDate=DD/MM/YYYY&toDate=DD/MM/YYYY` |
| Raw punches | `GET BASE/api/integrations/etime/punch-mcid?fromDate=DD/MM/YYYY_HH:mm&toDate=DD/MM/YYYY_HH:mm` |
| Last punch stream | `GET BASE/api/integrations/etime/last-punch` (+ optional `empcode`, `lastRecord`) |

`fromDate` / `toDate` are **required** on the first two. All need **admin** `Cookie`.

---

## 5. Superadmin

Every URL needs a session **`Cookie`** for a user with **`profiles.is_superadmin = true`** (see `supabase/add-is-superadmin.sql`). Use **`POST BASE/api/auth/login`** with that user’s email and password in Postman, or the browser + copy cookie.

---

### 5.1 List memberships

```
GET BASE/api/superadmin/memberships
```

| Query param | Required? | Notes |
|-------------|-----------|--------|
| `q` | No | If 1–4 digits, filters by `member_number`. |

---

### 5.2 Edit one membership

```
PATCH BASE/api/superadmin/memberships/MEMBERSHIP_UUID
```

Replace `MEMBERSHIP_UUID` in the URL.

**Body JSON** — include only fields to change:

| Field | Required? |
|-------|-----------|
| any of `plan_kind`, `status`, `seat_number`, `starts_at`, `ends_at`, `valid_from`, `valid_until`, `notes` | send at least one |

`plan_kind`: `short_term` | `long_term`  
`status`: `pending_payment` | `active` | `expired` | `cancelled`

---

### 5.3 Delete membership (dangerous)

```
DELETE BASE/api/superadmin/memberships/MEMBERSHIP_UUID
```

No body. Removes linked payments and the membership row.

---

## Quick reference — session `Cookie`

| Who | Easiest in Postman |
|-----|---------------------|
| Member | `POST http://localhost:3000/api/auth/login` with member `email` + `password` → then call member APIs on the same host. |
| Admin | Same URL with an admin account (`profiles.is_admin = true`). |
| Superadmin | Same URL with a superadmin account (`profiles.is_superadmin = true`). |

**Fallback:** sign in on `BASE/login` in Chrome → DevTools → Network → copy the **`Cookie`** request header → paste as header `Cookie` in Postman.

---

## Appendix — all Next.js `/api` routes and example success `message`

| Method | Path | Example success `message` |
|--------|------|----------------------------|
| `POST` | `/api/auth/login` | `Login successful.` |
| `POST` | `/api/create-order` | `Razorpay order created (demo checkout).` |
| `POST` | `/api/verify-payment` | `Payment signature verified (demo checkout).` |
| `GET` | `/api/memberships/seat-occupancy` | `Active long-term seat numbers loaded (N seats).` |
| `GET` | `/api/memberships/me-active` | `Active membership found…` or `Signed in; no active membership…` |
| `PATCH` | `/api/me/profile-intake` | `Profile / intake fields saved.` |
| `POST` | `/api/me/verification/document` | `KYC document uploaded; profile set to pending review.` |
| `POST` / `DELETE` | `/api/me/avatar` | `Avatar uploaded…` / `Avatar removed…` |
| `GET` | `/api/me/today-attendance` | `Today's attendance summary loaded.` |
| `POST` | `/api/payments/razorpay/create-order` | `Membership and Razorpay checkout order created…` |
| `POST` | `/api/payments/razorpay/verify` | `Payment verified…` or `Payment was already recorded…` |
| `POST` | `/api/payments/razorpay/reconcile` | `Payment reconciled with Razorpay…` |
| `GET` | `/api/admin/overview` | `Admin overview statistics loaded.` |
| `GET` | `/api/admin/members/list` | `Loaded N recent membership row(s)…` |
| `GET` | `/api/admin/payments/list` | `Loaded N recent payment row(s)…` |
| `POST` | `/api/admin/profiles/verify` | `Member verification approved…` |
| `POST` | `/api/admin/profiles/verification-respond` | `Verification rejected…` / `…resubmit requested…` |
| `GET` | `/api/admin/members/:userId/kyc-documents` | `Loaded N KYC document(s)…` or empty list message |
| `GET` | `/api/admin/attendance/daily` | `Daily attendance loaded (N row(s); source: …).` |
| `GET` | `/api/admin/attendance/last-punches` | `Last punches loaded (N row(s); source: …).` |
| `GET` | `/api/integrations/etime/in-out` | `eTime In/Out punch data returned (vendor JSON).` |
| `GET` | `/api/integrations/etime/punch-mcid` | `eTime MCID punch data returned (vendor JSON).` |
| `GET` | `/api/integrations/etime/last-punch` | `eTime last punch data returned (vendor JSON).` |
| `GET` | `/api/superadmin/memberships` | `Loaded N membership row(s)…` or `No memberships found…` |
| `PATCH` | `/api/superadmin/memberships/:id` | `Membership updated.` |
| `DELETE` | `/api/superadmin/memberships/:id` | `Membership and related payment rows deleted.` |

---

## Errors (short)

| Status | Meaning |
|--------|---------|
| 400 | Bad or missing JSON / params / validation. |
| 401 | Missing or expired session `Cookie` (for routes that need it). |
| 403 | Wrong role (e.g. not admin). |
| 404 | Wrong id or no matching row. |
| 409 | Seat overlap or already has active membership. |
| 502 / 503 | Upstream (eTime, storage, Razorpay) or missing server env vars. |

---

*Next.js routes live under `src/app/api/`. Register uses Supabase Auth (`/auth/v1/signup`). App login for APIs: `POST /api/auth/login`.*
