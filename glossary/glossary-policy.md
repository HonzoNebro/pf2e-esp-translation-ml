# Glossary Policy

This project uses glossaries to keep AI-assisted translation consistent.

The glossary is a terminology guide, not an automatic replacement table.
Approved terms indicate the preferred Spanish rendering when that term appears
with the same meaning and grammatical role. They must not be applied blindly
inside larger names, titles, sentences, Foundry labels, or proper nouns.

Priority order:

1. Official Spanish manuals.
2. Existing project translations when they do not conflict with official manuals.
3. AI proposals that are explicitly reviewed or marked for review.

Conflict handling:

- If a project translation conflicts with an official Spanish manual, use the manual term.
- If two manual sources conflict, mark the term as `needs_review`.
- If an AI proposal has no reliable source, mark it as `needs_review`.
- If a glossary term appears inside a larger phrase, translate the whole phrase naturally.
- Do not commit PDFs or long-form extracted text from PDFs.

Recommended term status values:

- `approved`: accepted term.
- `needs_review`: unresolved conflict or low confidence.
- `deprecated`: known old term kept for lookup only.
