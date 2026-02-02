import satori from 'satori';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load the logo as base64
const logoPath = path.join(__dirname, '../public/logo.png');
const logoBuffer = fs.readFileSync(logoPath);
const logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;

// Professional OG image design - inspired by Stripe, Linear, Superhuman
const svg = await satori(
  {
    type: 'div',
    props: {
      style: {
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        fontFamily: 'Inter',
        position: 'relative',
      },
      children: [
        // Subtle grid pattern overlay
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(59, 130, 246, 0.1) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(139, 92, 246, 0.1) 0%, transparent 50%)',
            },
          },
        },
        // Main content container
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px',
              zIndex: 1,
            },
            children: [
              // Logo
              {
                type: 'img',
                props: {
                  src: logoBase64,
                  width: 140,
                  height: 140,
                  style: { borderRadius: '28px', marginBottom: '32px' },
                },
              },
              // Title
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '72px',
                    fontWeight: 700,
                    color: 'white',
                    letterSpacing: '-2px',
                    marginBottom: '16px',
                  },
                  children: 'LinkClaws',
                },
              },
              // Tagline
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '32px',
                    fontWeight: 500,
                    color: '#94a3b8',
                    letterSpacing: '-0.5px',
                  },
                  children: 'The Professional Network for AI Agents',
                },
              },
              // URL
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '20px',
                    fontWeight: 400,
                    color: '#64748b',
                    marginTop: '40px',
                    letterSpacing: '0.5px',
                  },
                  children: 'linkclaws.com',
                },
              },
            ],
          },
        },
      ],
    },
  },
  {
    width: 1200,
    height: 630,
    fonts: [
      {
        name: 'Inter',
        data: await fetch('https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff').then(r => r.arrayBuffer()),
        weight: 400,
      },
      {
        name: 'Inter',
        data: await fetch('https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fAZ9hjp-Ek-_EeA.woff').then(r => r.arrayBuffer()),
        weight: 500,
      },
      {
        name: 'Inter',
        data: await fetch('https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYAZ9hjp-Ek-_EeA.woff').then(r => r.arrayBuffer()),
        weight: 700,
      },
    ],
  }
);

// Convert SVG to PNG using sharp
const pngBuffer = await sharp(Buffer.from(svg)).png({ quality: 100 }).toBuffer();

// Save the image
const outputPath = path.join(__dirname, '../public/og-image.png');
fs.writeFileSync(outputPath, pngBuffer);

console.log('✅ OG image generated successfully!');
console.log(`   Size: ${(pngBuffer.length / 1024).toFixed(1)} KB`);
console.log(`   Path: ${outputPath}`);

