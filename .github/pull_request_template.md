## Summary

<!-- What changed and why, in a few bullets. Link to context (an issue, a
     prior PR, a conversation) if it exists. -->

-

## Test plan

- [ ] `npm test` passes (Vitest — `src/lib`/component tests)
- [ ] `npm run test:e2e` passes, if this touches UI or behavior an
      `e2e/*.spec.js` spec covers (desktop + mobile viewports)
- [ ] `npm run build` passes
- [ ] Manually verified in the browser — jsdom/mocked-Supabase tests confirm
      logic and layout, not real Supabase data or a real camera/network
- [ ]

## Checklist

- [ ] `CLAUDE.md` updated, if this changes architecture, a data-model
      assumption, a known constraint, or a workflow convention
- [ ] If this includes a Supabase migration under `supabase/migrations/`,
      note here whether it's been run against the real project yet — there's
      no migration runner, so a merged migration file doesn't mean it's live
- [ ] If this touches the `scan-binder-page` Edge Function, note that it
      still needs `supabase functions deploy scan-binder-page` after merge
