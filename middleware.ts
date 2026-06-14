export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/", "/nieuw", "/zaak/:path*"],
};
