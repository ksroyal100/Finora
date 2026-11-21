# The Real Bug: Resend Failures Were Being Reported as Success

## What was actually wrong

Not a missing feature — a genuine bug in the email-sending code. The
Resend SDK's `.emails.send()` method does **not throw an exception** when
Resend rejects a send at the API level (unverified sending domain, invalid
API key, sandbox-mode restrictions on recipients, etc.). Instead, it
resolves normally and puts the problem in `result.error`.

The code only had a `try/catch` around the call and never checked
`result.error` — so every one of those rejections was silently treated as
a success. That's exactly the symptom you saw: campaigns showed as "sent"
with a status and count in the app, but recipients never actually got an
email, because Resend never actually delivered it and nothing was
checking for that.

This bug existed in **two places**:
- `sendRawEmail()` — used by the newsletter system
- `sendEmail()` — the original template-based sender used for password
  resets, subscription confirmations, security alerts, and more

Both are fixed now to check `result.error` and only report success when
Resend actually accepted the message.

## What else was added, so this is diagnosable going forward

**"Send Test" button** in the newsletter composer (founder app) — sends
the real, current version of a campaign to one address you choose, using
the exact same code path as a real send. If your Resend setup has a
problem (unverified domain, bad key, etc.), you'll see the *actual* error
message immediately, instead of finding out after a real send silently
didn't work.

**Better failure messaging on a real send** — if a campaign send has
failures, the result screen now explains the most likely causes
(unverified domain, invalid key, sandbox restrictions) and points you to
Send Test and the Resend dashboard's activity log, instead of just showing
a bare failure count.

## What you should actually do now

1. **Use Send Test first**, before trusting any real campaign. Send one to
   your own email and confirm it actually arrives (check spam too).
2. **If Send Test fails**, the error message it shows you is the real
   Resend error — it'll tell you directly whether it's your API key, your
   domain verification, or something else.
3. **The most common real-world cause**: a Resend account can only send to
   arbitrary recipients once you've verified a sending domain. Until then,
   Resend restricts sending to the email address on your own account. If
   you haven't verified a domain in your Resend dashboard yet, that's
   almost certainly the actual cause here — this bug fix will now surface
   that error clearly instead of hiding it.

## Verifying it yourself

```bash
npm run build   # both backend and founder app, verified clean
```
