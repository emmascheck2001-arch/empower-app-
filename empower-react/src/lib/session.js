// Module-level flags that survive client-side navigation within a single SPA session
// (no page reload between routes). Used to guarantee a user who JUST finished setup is
// never bounced back into setup by a lagging read-after-write, which caused onboarding loops.
export const sessionFlags = { justOnboardedUid: null }
