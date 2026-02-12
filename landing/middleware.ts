import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Configure your credentials here
const USERNAME = process.env.DASHBOARD_USER || 'admin';
const PASSWORD = process.env.DASHBOARD_PASS || 'openclaw123';

export function middleware(request: NextRequest) {
  // Only protect dashboard routes
  if (!request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.next();
  }

  // Skip auth in development if explicitly disabled
  if (process.env.NODE_ENV === 'development' && process.env.DASHBOARD_AUTH_DISABLED === 'true') {
    return NextResponse.next();
  }

  // Check for Basic Auth credentials
  const authHeader = request.headers.get('authorization');

  if (authHeader) {
    const authValue = authHeader.split(' ').pop();
    const [user, pwd] = atob(authValue).split(':');

    if (user === USERNAME && pwd === PASSWORD) {
      return NextResponse.next();
    }
  }

  // Return 401 with WWW-Authenticate header to trigger browser's login dialog
  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Dashboard"',
    },
  });
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
