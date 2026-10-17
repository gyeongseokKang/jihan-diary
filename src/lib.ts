import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;

export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  return posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

/** base 경로(/jihan-diary)를 붙여 줍니다. */
export function withBase(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/${path.replace(/^\//, '')}`;
}

export function photoSrc(p: string | { src: string }): string {
  return withBase(typeof p === 'string' ? p : p.src);
}

export function photoAlt(p: string | { src: string; alt?: string }, title: string, i: number): string {
  return (typeof p === 'object' && p.alt) || `${title} 사진 ${i + 1}`;
}

const fmt = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric', month: 'long', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul',
});
export function formatDate(d: Date): string {
  return fmt.format(d);
}

export type Loc = { lat: number; lng: number; place?: string };

/** 글에 연결된 위치 목록 (글 위치 + 사진별 위치, 중복 좌표 제거) */
export function postLocations(post: Post): Loc[] {
  const out: Loc[] = [];
  const seen = new Set<string>();
  const add = (l?: Loc) => {
    if (!l) return;
    const k = `${l.lat.toFixed(5)},${l.lng.toFixed(5)}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ lat: l.lat, lng: l.lng, place: l.place ?? '' });
  };
  add(post.data.location);
  for (const p of post.data.photos) if (typeof p === 'object') add(p.location);
  return out;
}

export function isoDate(d: Date): string {
  // Asia/Seoul 기준 YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(d);
}
