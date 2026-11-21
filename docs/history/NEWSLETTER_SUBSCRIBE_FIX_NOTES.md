# Newsletter Subscribe Fix — What Was Actually Wrong

## The bug

The landing page's newsletter signup form had a handler that did this,
in full:

```js
const handleNewsletter = (e) => {
  e.preventDefault()
  if (email) setNewsletterDone(true)
}
```

That's it. It never called an API, never touched the database — it just
flipped a local "You're in!" message. Every email typed into that form
was thrown away. That's exactly why nothing showed up in the database or
the admin subscriber count: there was nothing writing anything, anywhere.

## What's fixed

**1. A real subscribe endpoint and table.** Landing-page visitors usually
don't have an account yet, so this needed its own path — a new
`newsletter_subscribers` table (separate from `notification_preferences`,
which requires a logged-in user) plus a public, rate-limited
`POST /api/newsletter/subscribe` endpoint. The landing page form now
actually calls it, with real loading and error states instead of always
showing success.

**2. Sending now reaches both audiences.** The newsletter send logic
previously only pulled from `notification_preferences.marketing_emails`
(registered users). It now merges in `newsletter_subscribers` too, deduped
by email — a registered user's account takes precedence if the same
email shows up in both places. The admin subscriber count reflects both
sources.

**3. Unsubscribe works correctly for both.** Registered users unsubscribing
updates their account preference; anonymous subscribers unsubscribing
updates their `newsletter_subscribers` row. The signed unsubscribe link
now encodes which one it's targeting, so each type of recipient hits the
right table.

**4. A real RLS bug, found while fixing this.** `notification_preferences`
had row-level security turned on but **no policy was ever defined for
it** — meaning any direct client read or write to that table was silently
denied by default, for everyone, always. This is the same class of bug as
the earlier profile-save issue, just one table over. It hadn't surfaced
yet because nothing had tried to access this table directly from the
client before. Added proper read/update/insert-own policies.

**5. Logged-in Newsletter page + sidebar link**, as requested — a new
`/newsletter` page (linked in the sidebar just below Community) where a
logged-in user can see their subscription status, toggle it, and browse
past sent issues.

## Required setup

Run these two new migrations, in order:
1. `supabase/migrations/011_newsletter_subscribers.sql`
2. `supabase/migrations/012_notification_preferences_rls.sql`

## Verifying it yourself

```bash
npm run build   # verified clean, zero errors
```

Test end-to-end: submit the landing page form → check the
`newsletter_subscribers` table has the row → check the admin newsletter
page's subscriber count went up → send a test campaign → check the email
arrives and its unsubscribe link actually flips the row back to
`unsubscribed`.
