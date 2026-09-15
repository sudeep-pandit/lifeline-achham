// Phase 2 is still single-tenant, so the public (unauthenticated) pages need
// an explicit organization id to call the public API endpoints with. Falls
// back to the seeded development organization id so `npm run dev` works
// out of the box; production deployments should always set this env var.
export const ORGANIZATION_ID =
  process.env.NEXT_PUBLIC_ORGANIZATION_ID ?? "00000000-0000-0000-0000-000000000001";
