import { authkitProxy } from "@workos-inc/authkit-nextjs";

export default authkitProxy({
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: ["/sign-in", "/auth/callback"],
  },
});

export const config = {
  matcher: ["/app/:path*", "/onboarding/:path*", "/sign-in", "/auth/callback"],
};