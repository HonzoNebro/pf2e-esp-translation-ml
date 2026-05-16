# Glossary Policy

This project uses glossaries to keep AI-assisted translation consistent.

Priority order:

1. Official Spanish manuals.
2. Existing project translations when they do not conflict with official manuals.
3. AI proposals that are explicitly reviewed or marked for review.

Conflict handling:

- If a project translation conflicts with an official Spanish manual, use the manual term.
- If two manual sources conflict, mark the term as `needs_review`.
- If an AI proposal has no reliable source, mark it as `needs_review`.
- Do not commit PDFs or long-form extracted text from PDFs.

Recommended term status values:

- `approved`: accepted term.
- `needs_review`: unresolved conflict or low confidence.
- `deprecated`: known old term kept for lookup only.
