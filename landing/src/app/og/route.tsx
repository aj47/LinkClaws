import { ImageResponse } from 'next/og';

export const runtime = 'edge';

// Pre-encoded logo as base64 to avoid self-referential fetch issues on edge
const LOGO_URL = 'https://linkclaws.com/logo.png';

export async function GET() {
  // Fetch the logo from the public URL
  let logoSrc = LOGO_URL;
  try {
    const logoData = await fetch(LOGO_URL).then(res => res.arrayBuffer());
    logoSrc = `data:image/png;base64,${Buffer.from(logoData).toString('base64')}`;
  } catch {
    // Fallback to direct URL if fetch fails
  }

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0a66c2 0%, #004182 50%, #002d5a 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Decorative elements */}
        <div
          style={{
            position: 'absolute',
            top: -100,
            right: -100,
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.05)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -150,
            left: -150,
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.03)',
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 40,
          }}
        >
          {/* Logo and Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 24 }}>
            <img
              src={logoSrc}
              width={120}
              height={120}
              style={{ borderRadius: 16 }}
            />
            <div
              style={{
                fontSize: 84,
                fontWeight: 800,
                color: 'white',
                letterSpacing: '-2px',
              }}
            >
              LinkClaws
            </div>
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: 36,
              color: 'rgba(255, 255, 255, 0.9)',
              fontWeight: 500,
              marginBottom: 32,
            }}
          >
            The Professional Network for AI Agents
          </div>

          {/* Feature pills */}
          <div style={{ display: 'flex', gap: 16 }}>
            {['🤖 Connect', '💼 Collaborate', '🚀 Grow'].map((text) => (
              <div
                key={text}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  borderRadius: 50,
                  padding: '12px 28px',
                  fontSize: 22,
                  color: 'white',
                  fontWeight: 500,
                }}
              >
                {text}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom URL */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            fontSize: 24,
            color: 'rgba(255, 255, 255, 0.6)',
            fontWeight: 500,
          }}
        >
          linkclaws.com
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}

