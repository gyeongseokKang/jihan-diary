# 🌱 지한군일기

지한이의 하루하루를 담는 부모의 일기 사이트예요.

- 사이트: https://gyeongseokkang.github.io/jihan-diary/
- 지도: https://gyeongseokkang.github.io/jihan-diary/map/
- `main` 브랜치에 push 하면 GitHub Actions가 빌드해서 GitHub Pages에 자동 배포해요.

> ⚠️ **현재 임시 상태:** 자동 배포 워크플로가 아직 `.github/deploy.yml.template` 에 있어요.
> 켜기 전까지는 push 후 `npm run deploy:manual` 로 배포해 주세요 (gh-pages 브랜치에 올라가요).
> 켜는 방법: `gh auth refresh -h github.com -s workflow` 로 권한을 추가한 뒤
> `git mv .github/deploy.yml.template .github/workflows/deploy.yml` → commit & push →
> 저장소 Settings › Pages › Source 를 **GitHub Actions** 로 바꾸기.

## 새 글 올리기

### 방법 1. 도우미 스크립트 (추천)

```bash
npm install            # 처음 한 번만
npm run new-post -- --title "제목" 사진1.jpg 사진2.jpg
# 또는: node scripts/new-post.mjs --title "제목" 사진1.jpg 사진2.jpg
```

스크립트가 하는 일:

1. 사진에서 촬영일과 GPS 좌표를 읽어요.
2. 사진을 `public/photos/YYYY-MM-DD/` 로 복사해요.
3. 좌표를 OpenStreetMap(Nominatim)으로 장소 이름으로 바꿔요. 실패하면 `place` 는 비워 둬요.
4. `src/content/posts/YYYY-MM-DD.md` 를 만들어요. 같은 날 글이 이미 있으면 `YYYY-MM-DD-2.md` 로 만들어요.

옵션:

| 옵션 | 설명 |
| --- | --- |
| `--title "제목"` | 글 제목 |
| `--date YYYY-MM-DD` | 날짜 직접 지정 (기본: 사진 촬영일, 없으면 오늘) |
| `--publish` | `draft: true` 없이 바로 공개 상태로 생성 |
| `--no-geocode` | 장소 이름 조회 생략 (좌표만 기록) |

그다음:

1. 만들어진 `.md` 파일의 `---` 아래에 일기 본문을 써요.
2. `draft: true` 줄을 지워요. (남아 있으면 사이트에 안 보여요.)
3. 확인 후 올려요:

```bash
npm run build          # (선택) 로컬에서 오류 확인
git add .
git commit -m "일기: 2026-10-15"
git push
```

1~2분 뒤 사이트에 반영돼요.

### 방법 2. 직접 만들기

1. 사진을 `public/photos/2026-10-15/` 폴더에 넣어요.
2. `src/content/posts/2026-10-15.md` 파일을 만들어요:

```markdown
---
title: "첫 산책"
date: 2026-10-15
location:            # (선택) 글 대표 위치
  lat: 37.5665
  lng: 126.9780
  place: "서울특별시 중구"
photos:
  - /photos/2026-10-15/1.jpg          # 경로만 써도 되고
  - src: /photos/2026-10-15/2.jpg      # 설명·위치를 붙여도 돼요
    alt: "사진 설명"
    location:
      lat: 37.5665
      lng: 126.9780
      place: "서울특별시 중구"
---

여기에 일기 본문을 마크다운으로 써요.
```

3. commit & push.

## frontmatter 규칙

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| `title` | ✅ | 글 제목 |
| `date` | ✅ | `YYYY-MM-DD` |
| `photos` | | 사진 목록. 첫 사진이 목록의 대표 사진이에요. 경로는 `/photos/...` 로 시작 |
| `location` | | `{ lat, lng, place }` 글 대표 위치 |
| `photos[].location` | | 사진별 위치 |
| `draft` | | `true` 면 사이트에 안 보여요 |

형식이 틀리면 빌드가 실패해서 잘못된 글이 배포되지 않아요.
위치가 있는 글은 글 화면 아래의 작은 지도와 **지도** 페이지에 표시돼요.

## 참고

- 사진은 JPG/PNG/WebP를 써 주세요. 아이폰 HEIC는 브라우저에서 안 보일 수 있어요.
- 사진이 크면 사이트가 느려질 수 있으니, 가능하면 긴 변 2000px 정도로 줄여서 올려요.
- 로컬 미리보기: `npm run dev` → http://localhost:4321/jihan-diary/

## 구조

```
src/content/posts/      일기 마크다운
public/photos/          사진 (글 날짜별 폴더)
src/content.config.ts   frontmatter 검증 스키마
src/pages/              목록 / 글 상세 / 지도 페이지
scripts/new-post.mjs    새 글 도우미
.github/workflows/      GitHub Pages 자동 배포
```
