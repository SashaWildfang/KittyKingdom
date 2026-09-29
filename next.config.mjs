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
  // Dating became "Social" (dates and friends): old links keep working
  async redirects() {
    return [
      { source: "/dating", destination: "/social", permanent: true },
      { source: "/dating/:path*", destination: "/social/:path*", permanent: true },
      // Social settings moved to Settings (the gear next to the bell)
      { source: "/social/settings", destination: "/settings", permanent: false },
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Everything except the transcript viewers (Admin's, and members' on My Account), which the
      // site frames itself (those routes send their own stricter, sandboxed policy)
      { source: "/((?!api/admin/transcript-files/|api/transcripts/).*)", headers: frameProtection },
    ];
  },
};

export default nextConfig;
