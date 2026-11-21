import type { MetadataRoute } from 'next';

/**
 * Served at /robots.txt. Asks every crawler to stay out of the whole site.
 * Advisory only: well-behaved bots obey it, scrapers don't. The real control is
 * the login wall in proxy.ts. Output: robots rules.
 */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', disallow: '/' } };
}
