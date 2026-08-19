# Contributing

This is primarily a personal project, but issues and small PRs are welcome.

- **Bugs / ideas**: open an issue. For anything beyond a small fix, open the issue before
  starting work so the approach can be agreed first — see the existing issues for the current
  build roadmap.
- **Conventions**: see [`AGENTS.md`](AGENTS.md) for the tech stack, project structure, and hard
  constraints (single-Worker deployment, no Tailwind, API error shape, etc.) that any change
  should follow.
- **Tests**: there's no staging environment — CI (type checks, lint, tests) is what gates
  `main`, so PRs need to pass it.
- **Commits/PRs**: keep them scoped to one change; describe the *why*, not just the *what*.
