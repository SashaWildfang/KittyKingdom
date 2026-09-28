import { ArrowUp, BookOpen, Heart, HeartHandshake, LifeBuoy, Newspaper, ShoppingBag, Star, Trophy, UserRound } from "lucide-react";
import { canViewStaffPage, getCurrentUser } from "../lib/auth";
import { canSeeDating } from "../lib/dating/access";
import { REVIEWS_URL } from "../lib/reviews";

const DISCORD_INVITE = "https://discord.com/invite/M9XKHFdYQV";
const PATREON_URL = "https://www.patreon.com/c/thekittykingdom/membership";

function DiscordLogo({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 127.14 96.36" width={size} height={size} aria-hidden="true" fill="currentColor">
      <path d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0 105.89 105.89 0 0 0 19.39 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2.03a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2.03a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15ZM42.45 65.69C36.18 65.69 31 60 31 53s5-12.74 11.43-12.74S54 46 53.89 53s-5.05 12.69-11.44 12.69Zm42.24 0C78.41 65.69 73.25 60 73.25 53s5-12.74 11.44-12.74S96.23 46 96.12 53s-5.04 12.69-11.43 12.69Z" />
    </svg>
  );
}

/** The footer on every page: quick links for where you can go, what you can do and where to get help. */
export async function SiteFooter() {
  const user = await getCurrentUser().catch(() => null);
  const linked = Boolean(user?.discordId);
  const social = linked ? await canSeeDating(user?.discordId).catch(() => false) : false;
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer" aria-label="Footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <a className="site-footer-logo" href="/home" aria-label="Kitty Kingdom home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" width="44" height="44" />
            <span>
              <strong>Kitty Kingdom</strong>
              <small>A cozy 18+ furry community</small>
            </span>
          </a>
          <div className="site-footer-socials" aria-label="Find us">
            <a href={DISCORD_INVITE} aria-label="Join our Discord" title="Discord">
              <DiscordLogo size={18} />
            </a>
            <a href={PATREON_URL} target="_blank" rel="noopener noreferrer" aria-label="Support us on Patreon" title="Patreon">
              <Heart size={17} aria-hidden="true" />
            </a>
            <a href={REVIEWS_URL} target="_blank" rel="noopener noreferrer" aria-label="Read our reviews" title="Reviews">
              <Star size={17} aria-hidden="true" />
            </a>
          </div>
          <a className="site-footer-join" href="/join">
            <DiscordLogo size={16} /> Join the server
          </a>
        </div>

        <nav className="site-footer-cols" aria-label="Footer links">
          <div>
            <h3>Explore</h3>
            <a href="/home">Home</a>
            <a href="/news">
              <Newspaper size={13} aria-hidden="true" /> News
            </a>
            {social ? (
              <a href="/social">
                <HeartHandshake size={13} aria-hidden="true" /> Social
              </a>
            ) : null}
            <a href="/leaderboards">
              <Trophy size={13} aria-hidden="true" /> Leaderboards
            </a>
            <a href="/store">
              <ShoppingBag size={13} aria-hidden="true" /> Store
            </a>
          </div>
          <div>
            <h3>Community</h3>
            <a href={DISCORD_INVITE}>Discord</a>
            <a href={PATREON_URL} target="_blank" rel="noopener noreferrer">
              Patreon
            </a>
            {canViewStaffPage(user) ? <a href="/staff">Staff</a> : null}
            <a href={REVIEWS_URL} target="_blank" rel="noopener noreferrer">
              Reviews
            </a>
          </div>
          <div>
            <h3>Your account</h3>
            {user ? (
              <>
                <a href="/account">
                  <UserRound size={13} aria-hidden="true" /> My Account
                </a>
                {social ? <a href="/social/profile">My Social profile</a> : null}
                {social ? <a href="/social/settings">Social settings</a> : null}
              </>
            ) : (
              <>
                <a href="/login">Log in</a>
                <a href="/register">Create an account</a>
              </>
            )}
          </div>
          <div>
            <h3>Help</h3>
            <a href="/faq">
              <BookOpen size={13} aria-hidden="true" /> FAQ &amp; Guide
            </a>
            <a href="/support">
              <LifeBuoy size={13} aria-hidden="true" /> Support
            </a>
            <a href="/privacy">Privacy Policy</a>
            <a href="/terms">Terms of Service</a>
          </div>
        </nav>
      </div>
      <div className="site-footer-bottom">
        <p>© {year} Kitty Kingdom. All rights reserved.</p>
        <a href="#" className="site-footer-top">
          <ArrowUp size={14} aria-hidden="true" /> Back to top
        </a>
      </div>
    </footer>
  );
}
