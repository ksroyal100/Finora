# Legal Risk Reduction — What Changed, and What Still Needs a Lawyer

## Read this part first

I'm not a lawyer, and nothing here is legal advice. What I did is reduce
real, specific risk in your code and legal documents. I did not, and can't,
make "no legal action after launch" achievable — no one can promise that,
for any business. Some of what's below is genuinely important to get a
real attorney to look at before you charge people money for financial
software. I'll say exactly which parts, at the end.

## 1. The AI Coach's actual behavior changed, not just its wording

The old system prompt described the AI as "a knowledgeable, encouraging
financial advisor" whose job was to "provide actionable, personalized
advice based on the user's financial situation," with "investment
strategies" listed as an area of expertise. That phrasing is close to a
textbook description of regulated investment advice (Investment Advisers
Act of 1940 in the US, and equivalents elsewhere) — the specific thing you
said you want to avoid.

The new prompt (`src/lib/ai/groq.ts`) draws a hard, explicit line:

- **Can do**: explain financial concepts in general terms, help organize
  and total the numbers a user enters themselves, run Finora's
  calculators, describe widely-accepted general principles ("an emergency
  fund commonly covers 3-6 months of expenses").
- **Cannot do**: recommend or endorse any specific security, ticker, fund,
  or crypto asset; predict market direction or returns; give individualized
  tax or legal instructions; imply an advisory or fiduciary relationship.
- **Must refuse**: insider trading, market manipulation, tax evasion,
  money laundering/structuring, securities fraud, unlicensed lending
  schemes — with a brief explanation why, not a lecture.

This isn't just a longer prompt — it changes what the model will actually
say. I also patched the three other AI-generation functions (financial
health analysis, budget analysis, goal planning) so their JSON output is
constrained to general savings/budgeting language, not investment
recommendations, since those were generating advice-shaped content too.

**The UI matters as much as the prompt.** A model can be perfectly
constrained and a product can still *look* like it's offering advice
through its framing. I found and fixed two spots:
- The AI Coach's empty-state copy previously said "ask me anything about
  investing, budgeting, taxes... I know your financial data" — reworded to
  describe education and organization, not personalized advice.
- One of the suggested quick-prompts was literally "Should I invest in
  real estate?" — a personalized-advice-seeking question your own product
  was suggesting. Changed to "What should I know before investing in real
  estate?"

Both the footer disclaimer and empty-state now explicitly say Finora is
not a registered investment adviser.

## 2. Legal documents — targeted additions, not a rewrite

Good news first: your existing Terms, Privacy Policy, and Disclaimer
(migration `009_legal_documents.sql`, extracted faithfully from your live
pages in an earlier round) were already a solid baseline — better than a
lot of real startups launch with. The Privacy Policy in particular already
explicitly named Groq, Stripe, Supabase, and covered AI memory and voice
data specifically. I didn't touch it.

What was genuinely missing, added in `010_strengthen_legal_protections.sql`:

- **Explicit "not a registered investment adviser" language**, citing the
  actual Investment Advisers Act of 1940, in both the Terms and the
  Disclaimer. The old text said "not financial/investment/tax/legal
  advice" generally, which is good, but doesn't use the specific
  regulatory framing that matters if this is ever tested.
- **An explicit "no fiduciary relationship" statement** — a distinct legal
  concept from "not advice," worth stating separately.
- **An 18+ age eligibility requirement** in the Terms — this was missing
  entirely.
- **An explicit prohibition on using the Service or AI features to plan or
  facilitate financial crimes** (insider trading, market manipulation,
  money laundering, tax evasion, securities fraud) in the Acceptable Use
  section — directly answering what you asked for.
- **"Past performance is not indicative of future results"** in the
  Disclaimer — standard, expected boilerplate for anything discussing
  investments, and it was absent.

Every change is versioned: the prior content is snapshotted into
`legal_document_revisions` before the update runs, so there's a permanent
record of exactly what your Terms said before and after — which itself can
matter if you ever need to show what a user agreed to on a given date.

## What I will not claim

- This does not make you compliant with securities law in any specific
  state or country — that depends on exactly what your product does, where
  your users are, and how it's marketed, which I can't fully assess.
- This does not review your actual pricing/marketing copy, your onboarding
  flow, or your marketing site for advice-adjacent claims outside the AI
  Coach and legal pages themselves — worth a pass if you haven't done one.
- This is not a substitute for an actual licensed attorney reviewing your
  specific business before you take payment from real customers.

## What I'd genuinely get a lawyer for before launch

In order of how much I'd worry about them:

1. **Whether AI Coach's scope (even now) requires investment adviser
   registration in your state.** The line between "educational tool" and
   "advice" is fact-specific and state law varies. A quick call with a
   securities attorney (many will do a scoped review for a flat fee) is
   the single highest-value thing you could do before launch.
2. **Your actual business entity and where it's registered** — the
   mailing address in your newsletter footer and Terms should be a real
   registered business address, not a placeholder.
3. **Terms enforceability specifics** — arbitration clauses, class-action
   waivers, and governing-law choice are real liability-reduction tools I
   did not add, because they're a business decision with jurisdiction-
   specific enforceability rules that a generic template shouldn't guess
   at for you.
4. **Data protection compliance** if you have or expect EU users (GDPR) or
   California users (CCPA) beyond what a general privacy policy covers —
   these have specific procedural requirements (e.g., a formal Data
   Processing Agreement with Groq/Stripe/Supabase) that go beyond what's
   disclosed in a policy page.

None of this needs to block a small first launch with a handful of real
users — but before meaningfully scaling toward $100k in a regulated-
adjacent space, it's worth the few hundred dollars for an actual review.

## Verifying it yourself

```bash
npm run build   # verified clean, zero errors
```

Run `supabase/migrations/010_strengthen_legal_protections.sql` against
your database (it only touches the `terms` and `disclaimer` documents,
snapshotting the prior version first).
