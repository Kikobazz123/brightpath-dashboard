# Licensing

This repository contains two kinds of code with two different owners, and the
distinction matters. Read this before assuming anything here is reusable.

## The UI template — MIT, third party

The dashboard and landing-page scaffolding came from
`shadcnstore/shadcn-dashboard-landing-template` (nextjs-version), which is MIT
licensed. Its notice is reproduced in full below, unaltered, because MIT
requires it. That licence covers the template's own files — the shadcn/ui
components, the layout chrome, the auth and error page shells, and the
showcase screens under `src/app/(dashboard)/` that are not part of the leads
workspace.

## The BrightPath application — not licensed for reuse

Everything written for BrightPath Solutions was authored by **Lordmark Dorgu**
for Brightpath Solutions, and is **© 2026 the repository owner. All rights
reserved.** It is *not* covered by the MIT licence below, and no permission to
copy, modify, or redistribute it is granted here.

Authorship and ownership are stated separately on purpose: naming who wrote
something is not a claim about who holds the copyright in it, which is settled
by the engagement terms rather than by this file.

That includes, non-exhaustively:

- the qualification rubric and scoring engine (`src/lib/pipeline/`)
- the API contract and lead service (`src/lib/contracts/`, `src/lib/leads/`)
- the API routes under `src/app/api/v1/`
- the leads workspace (`src/app/(dashboard)/leads/`, `src/components/leads/`)
- the AI provider and failover layer (`src/lib/ai/`)
- the verification suites in `scripts/`
- the project documentation and the brief in `brief/`

Adding an MIT notice to a repository does not place the rest of that repository
under MIT. This file states the boundary explicitly so that nobody has to infer
it, and so that the inference is not made in the wrong direction.

---

# MIT License — applies to the upstream template only

Copyright (c) 2025 ShadcnStore

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
