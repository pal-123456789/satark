# Satark · सतर्क — Investor Fraud Shield

> **Spot the fraud. See through the hype. Pause before you lose.**
> A Bharat-first, private, offline-capable investor-protection tool built for the **SANGYAN Investor Resilience Hackathon** (SEBI · NSDL · IIT (BHU) Varanasi).

Satark is **public-good investor-protection infrastructure, not a fintech product.** It never gives buy/sell/hold advice, never predicts prices, never promotes a broker, and nothing you paste into it ever leaves your device.

---

## The problem → user → solution

**Problem.** India has 16+ crore Demat accounts, 70%+ of new ones from Tier-2/3 cities. Scammers exploit this with fake "SEBI-registered" advisors, guaranteed-return pitches, pump-and-dump Telegram groups, cloned broker links, and remote-access-app traps. Victims usually realise only after the money is gone.

**User.** A first-time investor in a Tier-2/3 town, more comfortable in Hindi or Gujarati than English, who just received a "too good to be true" message and has no quick, trustworthy way to check it.

**Solution.** Paste any suspicious message, link, UPI id, or "SEBI number" into Satark. In seconds — fully offline, in your language, read aloud if you like — it returns an **explainable, calibrated risk assessment** (not a scary binary), tells you *exactly which red flags* it found and *why*, and tells you what to do next. If you've already been hit, it switches to recovery mode and drafts your complaint.

## Why it is trustworthy by design

- **Deterministic verdicts.** The risk score comes from an auditable weighted signal engine, not a black-box model. Every point of risk maps to a named red flag with a plain-language reason and a regulatory citation. A language model may *rephrase* the explanation, but it can **never** change the verdict — so the safety call is reproducible and hallucination-free.
- **Honest uncertainty.** Satark communicates *how risky* and *why*, never a false "100% safe / 100% scam".
- **Private & offline.** 100% client-side. No login, no SMS/OTP/PII harvesting, no analytics. Installs as a PWA and keeps working with no network.

## Flagship + connected surfaces

| Surface | What it does | SANGYAN track |
|---|---|---|
| **Scam & Claim Verifier** (flagship) | Explainable risk verdict for any message/link/UPI/"SEBI no"/screenshot | A — Fraud |
| **Hype X-ray** | "Is this educating you or selling you?" + evidence-honesty, never binary | E — Misinformation |
| **Cooling-off + Decision Journal** | A deliberate pause + 4 questions before you act on a tip | D — Behaviour |
| **Recovery + SCORES draft** | If already scammed: 1930/bank steps + an auto-drafted complaint | B — Rights |
| **Learn** | 30-second plain-language micro-lessons with everyday analogies | C — Education |

## Tech

Zero-dependency, zero-build **vanilla-JS ES-module PWA** — tiny bundle, instant load on low-end Android, works offline. Voice via the on-device Web Speech API (hi/en/gu). Optional screenshot OCR. The whole fraud engine is plain JavaScript with a frozen JSON knowledge base, so it is portable, inspectable, and testable.

## Run it

```bash
npm test          # run the engine test suite (Node 18+, zero dependencies)
npm run serve     # serve the PWA at http://localhost:8080
```

## Status

Day 1 — engine core + app shell live and tested (`node --test`: all green). Knowledge base, multilingual layer, voice, OCR, benchmark, and supporting surfaces in progress.

## Guardrails (hard constraints)

No stock tips · no buy/sell/hold or price predictions · no trading algorithms · no broker/instrument promotion · no monetisation funnels · no SMS/OTP/PII harvesting. Market concepts are explained for *understanding and safety only*, never as a personalised recommendation.

_MIT licensed. A public-good project._
