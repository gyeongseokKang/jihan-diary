#!/usr/bin/env node
/**
 * 새 일기 글 뼈대 만들기
 *
 * 사용법:
 *   node scripts/new-post.mjs [옵션] <사진1> [사진2 ...]
 *   npm run new-post -- [옵션] <사진1> [사진2 ...]
 *
 * 옵션:
 *   --title "제목"     글 제목 (기본: 빈 제목 자리표시)
 *   --date YYYY-MM-DD  날짜 직접 지정 (기본: 사진 EXIF 촬영일 → 없으면 오늘)
 *   --publish          draft: false 로 생성 (기본은 draft: true, 본문 작성 후 false로 바꾸기)
 *   --no-geocode       장소 이름(역지오코딩) 조회 생략
 *
 * 하는 일:
 *   1) 사진 EXIF에서 촬영일(DateTimeOriginal)과 GPS 좌표를 읽음
 *   2) 사진을 public/photos/YYYY-MM-DD/ 로 원본 그대로 복사
 *   3) OpenStreetMap Nominatim으로 좌표 → 장소 이름 조회 (초당 1회 제한, 실패 시 빈 값)
 *   4) src/content/posts/YYYY-MM-DD.md 를 frontmatter와 함께 생성 (본문은 비워 둠)
 */
import { copyFile, mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import exifr from 'exifr';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const USER_AGENT = 'jihan-diary/1.0 (+https://github.com/gyeongseokKang/jihan-diary)';
const WEB_IMAGE = /\.(jpe?g|png|webp|gif|avif)$/i;

// ---------- 인자 파싱 ----------
const args = process.argv.slice(2);
const opts = { title: '', date: '', publish: false, geocode: true };
const files = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--title') opts.title = args[++i] ?? '';
  else if (a === '--date') opts.date = args[++i] ?? '';
  else if (a === '--publish') opts.publish = true;
  else if (a === '--no-geocode') opts.geocode = false;
  else if (a === '-h' || a === '--help') { usage(); process.exit(0); }
  else if (a.startsWith('--')) { console.error(`알 수 없는 옵션: ${a}`); usage(); process.exit(1); }
  else files.push(a);
}
function usage() {
  console.log('사용법: node scripts/new-post.mjs [--title "제목"] [--date YYYY-MM-DD] [--publish] [--no-geocode] <사진...>');
}
if (opts.date && !/^\d{4}-\d{2}-\d{2}$/.test(opts.date)) {
  console.error('--date 는 YYYY-MM-DD 형식이어야 해요.'); process.exit(1);
}

// ---------- 유틸 ----------
const exists = (p) => access(p).then(() => true, () => false);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const seoulDate = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(d);
const q = (s) => JSON.stringify(s); // JSON 문자열은 유효한 YAML 문자열

/** EXIF DateTimeOriginal 은 시간대 정보 없는 "현지 시각"이라 exifr이 로컬 Date로 만들어 줌.
 *  박스/PC 시간대와 관계없이 찍힌 그 날짜(벽시계 기준)를 쓰기 위해 로컬 구성요소를 사용. */
const localYmd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

let lastRequest = 0;
const geoCache = new Map();
async function reverseGeocode(lat, lng) {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (geoCache.has(key)) return geoCache.get(key);
  const wait = 1100 - (Date.now() - lastRequest);
  if (wait > 0) await sleep(wait); // Nominatim 이용 정책: 초당 최대 1회
  lastRequest = Date.now();
  let place = '';
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.search = new URLSearchParams({ format: 'jsonv2', lat: String(lat), lon: String(lng), zoom: '17', 'accept-language': 'ko' }).toString();
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const j = await res.json();
      const a = j.address ?? {};
      const parts = [
        a.city || a.town || a.county || a.province || a.state,
        a.borough || a.city_district,
        a.suburb || a.quarter || a.village || a.neighbourhood,
        j.name && j.name !== (a.suburb || a.quarter) ? j.name : '',
      ].filter(Boolean);
      place = [...new Set(parts)].join(' ') || (j.display_name ?? '');
    } else {
      console.warn(`  ! 장소 조회 실패 (HTTP ${res.status}) → place 비워 둠`);
    }
  } catch (e) {
    console.warn(`  ! 장소 조회 실패 (${e.message}) → place 비워 둠`);
  }
  geoCache.set(key, place);
  return place;
}

function safeName(name, used) {
  const ext = path.extname(name).toLowerCase();
  let base = path.basename(name, path.extname(name)).normalize('NFC')
    .replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '') || 'photo';
  let out = `${base}${ext}`;
  for (let n = 2; used.has(out); n++) out = `${base}-${n}${ext}`;
  used.add(out);
  return out;
}

// ---------- 메인 ----------
if (files.length === 0) { usage(); process.exit(1); }

const infos = [];
for (const f of files) {
  const abs = path.resolve(f);
  if (!(await exists(abs))) { console.error(`파일이 없어요: ${f}`); process.exit(1); }
  if (!WEB_IMAGE.test(abs)) console.warn(`  ! ${path.basename(abs)}: 브라우저에서 안 보일 수 있는 형식이에요 (HEIC 등은 JPG로 변환 권장)`);
  let taken = null, lat = null, lng = null;
  try {
    const ex = await exifr.parse(abs, { pick: ['DateTimeOriginal', 'CreateDate', 'GPSLatitude', 'GPSLongitude', 'GPSLatitudeRef', 'GPSLongitudeRef'], gps: true });
    taken = ex?.DateTimeOriginal ?? ex?.CreateDate ?? null;
    if (Number.isFinite(ex?.latitude) && Number.isFinite(ex?.longitude) && !(ex.latitude === 0 && ex.longitude === 0)) {
      lat = +ex.latitude.toFixed(6); lng = +ex.longitude.toFixed(6);
    }
  } catch { /* EXIF 없음 */ }
  infos.push({ abs, taken: taken instanceof Date && !isNaN(taken) ? taken : null, lat, lng });
}

// 날짜 결정: --date > 가장 이른 촬영일 > 오늘(서울)
const takenDates = infos.map((i) => i.taken).filter(Boolean).sort((a, b) => a - b);
let date = opts.date || (takenDates[0] ? localYmd(takenDates[0]) : '');
if (!date) { date = seoulDate(new Date()); console.warn(`  ! 사진에 촬영일 정보가 없어 오늘 날짜(${date})를 사용해요. --date 로 바꿀 수 있어요.`); }
const otherDays = [...new Set(takenDates.map(localYmd))].filter((d) => d !== date);
if (otherDays.length) console.warn(`  ! 다른 날짜에 찍힌 사진도 있어요: ${otherDays.join(', ')}`);

// 파일 경로 결정 (같은 날 글이 있으면 -2, -3 ...)
let slug = date;
for (let n = 2; await exists(path.join(ROOT, 'src/content/posts', `${slug}.md`)); n++) slug = `${date}-${n}`;
const photoDir = path.join(ROOT, 'public/photos', slug);
await mkdir(photoDir, { recursive: true });

// 사진 복사 (촬영 시각 순) + 장소 조회
infos.sort((a, b) => (a.taken?.getTime() ?? Infinity) - (b.taken?.getTime() ?? Infinity));
const used = new Set();
const photos = [];
for (const info of infos) {
  const name = safeName(path.basename(info.abs), used);
  await copyFile(info.abs, path.join(photoDir, name));
  const p = { src: `/photos/${slug}/${name}` };
  if (info.lat != null) {
    const place = opts.geocode ? await reverseGeocode(info.lat, info.lng) : '';
    p.location = { lat: info.lat, lng: info.lng, place };
  }
  photos.push(p);
  console.log(`  ✓ ${p.src}${p.location ? `  📍 ${p.location.lat}, ${p.location.lng} ${p.location.place}` : ''}`);
}

// frontmatter 작성
const first = photos.find((p) => p.location)?.location;
const lines = ['---', `title: ${q(opts.title)}`, `date: ${date}`];
if (!opts.publish) lines.push('draft: true # 본문을 다 쓰면 false 로 바꾸거나 이 줄을 지우세요');
if (first) lines.push('location:', `  lat: ${first.lat}`, `  lng: ${first.lng}`, `  place: ${q(first.place)}`);
lines.push(photos.length ? 'photos:' : 'photos: []');
for (const p of photos) {
  lines.push(`  - src: ${q(p.src)}`);
  if (p.location) lines.push('    location:', `      lat: ${p.location.lat}`, `      lng: ${p.location.lng}`, `      place: ${q(p.location.place)}`);
}
lines.push('---', '', '');

const mdPath = path.join(ROOT, 'src/content/posts', `${slug}.md`);
await writeFile(mdPath, lines.join('\n'), 'utf8');
console.log(`\n✓ 글 파일 생성: ${path.relative(ROOT, mdPath)}`);
if (!opts.title) console.log('  → title 을 채워 주세요.');
console.log('  → 본문(--- 아래)에 일기를 쓰고, draft 줄을 정리한 뒤 commit & push 하면 자동 배포돼요.');
