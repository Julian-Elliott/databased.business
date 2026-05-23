/**
 * Fetch a user's public GitHub repos at build time.
 *
 * Falls back to a curated static list when the network is unavailable or
 * the API rate-limits us during a build. Astro will execute this code
 * during `astro build` (or each dev render), so a single network call
 * powers the entire /code page.
 */

export interface Repo {
  name: string;
  url: string;
  description: string;
  language: string | null;
  stars: number;
  forks: number;
  updated: Date;
  topics: string[];
  archived: boolean;
  fork: boolean;
}

interface GhRepo {
  name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  pushed_at: string;
  topics?: string[];
  archived: boolean;
  fork: boolean;
  private: boolean;
}

const FALLBACK: Repo[] = [
  {
    name: 'databased.business',
    url: 'https://github.com/Julian-Elliott/databased.business',
    description: 'The site you are currently reading. Astro + Cloudflare Workers.',
    language: 'Astro',
    stars: 0,
    forks: 0,
    updated: new Date(),
    topics: ['astro', 'cloudflare', 'blog'],
    archived: false,
    fork: false,
  },
];

export async function fetchRepos(user: string): Promise<Repo[]> {
  const url = `https://api.github.com/users/${user}/repos?per_page=100&sort=pushed&type=owner`;
  const headers: Record<string, string> = {
    'User-Agent': 'databased.business-site',
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (typeof process !== 'undefined' && process.env?.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.warn(`[github] ${res.status} ${res.statusText} — falling back to static list`);
      return FALLBACK;
    }
    const raw = (await res.json()) as GhRepo[];
    return raw
      .filter((r) => !r.private && !r.fork)
      .map((r) => ({
        name: r.name,
        url: r.html_url,
        description: r.description ?? '',
        language: r.language,
        stars: r.stargazers_count,
        forks: r.forks_count,
        updated: new Date(r.pushed_at),
        topics: r.topics ?? [],
        archived: r.archived,
        fork: r.fork,
      }))
      .sort((a, b) => b.updated.getTime() - a.updated.getTime());
  } catch (err) {
    console.warn('[github] fetch failed — falling back', err);
    return FALLBACK;
  }
}

/**
 * Group repos by primary language for the language filter.
 */
export function groupByLanguage(repos: Repo[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of repos) {
    const k = r.language ?? 'Other';
    out.set(k, (out.get(k) ?? 0) + 1);
  }
  return new Map([...out.entries()].sort((a, b) => b[1] - a[1]));
}

/**
 * Deterministic 12-point pseudo-activity sparkline derived from the repo
 * name + updated date — purely decorative so the UI doesn't need a second
 * API call (commit stats are unauthenticated rate-limit hogs).
 */
export function pseudoSpark(name: string, updated: Date): number[] {
  let h = updated.getTime() % 9301;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  const out: number[] = [];
  for (let i = 0; i < 12; i++) {
    h = (h * 1103515245 + 12345) | 0;
    out.push(((h >>> 0) % 100) / 10);
  }
  return out;
}
