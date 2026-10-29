import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { ORB_PITCH_EXPIRES_AT } from "@/lib/orbPitch";

const EXPIRED_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Link expired</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#120E10;color:#F3E9D7;font:18px/1.5 system-ui,sans-serif;text-align:center;padding:24px}a{color:#F2B33D}</style></head><body><main><h1 style="font-size:28px;margin:0 0 12px">This link has expired.</h1><p>If you'd like to see it again, ask James at <a href="mailto:itsolamco@gmail.com">itsolamco@gmail.com</a>.</p><p><a href="https://itsolamco.in">itsolamco.in</a></p></main></body></html>`;

// The Orb pitch: a private, temporary page (and its videos) under /orb.
function orbPitch(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const noindex = "noindex, nofollow, noarchive";

  if (Date.now() > Date.parse(ORB_PITCH_EXPIRES_AT)) {
    return new NextResponse(EXPIRED_PAGE, {
      status: 410,
      headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": noindex, "Cache-Control": "no-store" },
    });
  }

  const response =
    pathname === "/orb" || pathname === "/orb/"
      ? NextResponse.rewrite(new URL("/orb/index.html", request.url))
      : NextResponse.next();
  response.headers.set("X-Robots-Tag", noindex);
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/orb" || pathname.startsWith("/orb/")) return orbPitch(request);

  const isLoginPage = pathname === "/admin/login";
  const isAdminApi = pathname.startsWith("/api/admin");
  const isLoginApi = pathname === "/api/admin/login";

  if (isLoginPage || (isAdminApi && isLoginApi)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    if (isAdminApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/admin/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/orb", "/orb/:path*"],
};
