import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

export function middleware(req: NextRequest) {
  const basicAuth = req.headers.get("authorization");

  if (basicAuth) {
    const [, encoded] = basicAuth.split(" ");
    const [user, pass] = Buffer.from(encoded, "base64").toString().split(":");
    const validUser = process.env.AUTH_USER ?? "admin";
    const validPass = process.env.AUTH_PASS ?? "";

    if (user === validUser && pass === validPass && pass !== "") {
      return NextResponse.next();
    }
  }

  return new NextResponse("Toegang geweigerd", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="BezwaarPilot"',
    },
  });
}
