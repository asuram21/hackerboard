# 위드시큐 블로그 자동 발행 (TPUB)

티스토리(withsecu.tistory.com)는 글쓰기 API가 없으므로, 글쓰기 화면에서 `publisher.js`를 실행해
이미지 업로드 → 본문 → 제목 → 카테고리 → 태그 → 대표이미지 → 공개/예약 발행을 한 번에 처리한다.
원고와 이미지는 이 폴더에 올리고, 브라우저는 raw.githubusercontent.com 에서 직접 받는다.

## 폴더 구조

```
blog/
  publisher.js          티스토리 글쓰기 화면용 발행기
  tools/make_thumb.py   1200x630 대표이미지 생성기 (위드시큐 CI)
  img/                  여러 글에서 같이 쓰는 이미지 (키트 사진 등)
  posts/<YYYY-MM-DD-slug>/
    post.json           제목·카테고리·태그·이미지·공개/예약 설정
    body.html           본문 (이미지 자리에 {{KEY}})
    *.jpg               이 글 전용 이미지
```

## post.json

```json
{
  "title": "[제어시스템 보안] Chapter 6. ...",
  "category": "제어시스템 보안",
  "tags": ["IEC62443", "SPDL"],
  "visibility": "public",          // public | protected | private
  "reserve": "2027-01-14 09:00",   // 생략하면 즉시 발행 (한국 시간)
  "thumb": "THUMB",                 // 대표이미지로 쓸 images.key
  "images": [
    {"key": "THUMB", "file": "thumb.jpg"},
    {"key": "KIT", "file": "../../img/hackerboard_kit.jpg"},
    {"key": "LAYOUT", "file": "layout.jpg", "upload": false, "alt": "설명"}
  ]
}
```

- `images` 순서대로 티스토리에 업로드되고 `{{KEY}}` 자리에 들어간다. 첫 이미지를 대표이미지로 둔다.
- `"upload": false` 이면 업로드하지 않고 GitHub 주소를 그대로 `<img>`로 넣는다.
- 카테고리는 티스토리 카테고리 이름 그대로 (하위 카테고리도 이름만).

## 실행 (글쓰기 화면 https://withsecu.tistory.com/manage/newpost/ 에서)

```js
const R='https://raw.githubusercontent.com/asuram21/hackerboard/<커밋>/blog/';
(0,eval)(await fetch(R+'publisher.js',{cache:'no-store'}).then(r=>r.text()));
await TPUB.run(R+'posts/<폴더>/', {mode:'publish'});   // 발행(또는 예약)
// {mode:'draft'} 임시저장만, {mode:'publish', dryRun:true} 발행 직전까지 점검
await TPUB.latest();  // 방금 올라간 글 확인
```

raw 주소는 브랜치 대신 커밋 해시를 쓴다(캐시 때문에 방금 올린 파일이 안 보이는 일을 막음).

## 원칙

- 공개 발행·예약은 원고를 BLAST가 승인한 뒤에만 실행한다.
- 「위드시큐 소식」 글에는 개인 이름·학교·학과를 쓰지 않는다 (회사 명의 + 글 BLAST).
- `posts/_test` 는 점검용 원고다. 발행하지 않는다.
