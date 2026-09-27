/** @type {import('next').NextConfig} */

// Security headers for every page and API response.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

// No other site may frame our pages (clickjacking), no plugins, forms only post back to us.
const frameProtection = [
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
  },
];

const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Everything except the admin transcript viewer, which the Admin tab frames itself
      // (that route sends its own stricter, sandboxed policy)
      { source: "/((?!api/admin/transcript-files/).*)", headers: frameProtection },
    ];
  },
};

export default nextConfig;
