import { NextResponse, type NextRequest } from "next/server";
import { isQuadLandingHost, QUAD_APP_URL } from "@/lib/deployment/domains";

export function middleware(request: NextRequest) {
  if (!isQuadLandingHost(request.headers.get("host"))) return NextResponse.next();

  const target = new URL(request.nextUrl.pathname + request.nextUrl.search, QUAD_APP_URL);
  return NextResponse.redirect(target, 308);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
