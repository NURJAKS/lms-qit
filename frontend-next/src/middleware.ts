import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Protected routes and their required roles
const ROUTES = {
  admin: ['admin', 'director', 'curator'],
  teacher: ['teacher', 'admin', 'director', 'curator'],
  parent: ['parent', 'admin', 'director', 'curator'],
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Get token and role from cookies
  const token = request.cookies.get('auth-token')?.value;
  const role = request.cookies.get('user-role')?.value;

  // 1. If trying to access /app/* without being logged in
  if (pathname.startsWith('/app') && !token) {
    const url = new URL('/login', request.url);
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // 2. Role-based access control
  if (token && role) {
    // Admin routes protection
    if (pathname.startsWith('/app/admin')) {
      if (!ROUTES.admin.includes(role)) {
        return NextResponse.redirect(new URL('/app', request.url));
      }
    }

    // Teacher routes protection
    if (pathname.startsWith('/app/teacher')) {
      if (!ROUTES.teacher.includes(role)) {
        return NextResponse.redirect(new URL('/app', request.url));
      }
    }

    // Parent routes protection
    if (pathname.startsWith('/app/parent-dashboard')) {
      if (!ROUTES.parent.includes(role)) {
        return NextResponse.redirect(new URL('/app', request.url));
      }
    }
    
    // Redirect logged in users away from login/register
    if (pathname === '/login' || pathname === '/register') {
      return NextResponse.redirect(new URL('/app', request.url));
    }
  }

  return NextResponse.next();
}

// Matcher configuration for routes to apply middleware
export const config = {
  matcher: [
    '/app/:path*',
    '/login',
    '/register',
  ],
};
