#!/usr/bin/env python3
"""위드시큐 블로그 대표이미지(1200x630) 생성기.

사용 예:
  python3 make_thumb.py out.jpg --label "제어시스템 보안 · Chapter 6" \
      --title "SPDL로 보는" --title "보안 개발 수명주기" \
      --sub "IEC 62443-4-1을 실무 흐름으로 읽기" \
      --box "Chapter 6 · IEC 62443-4-1" --accent "SPDL" --image photo.jpg
제목·부제는 줄마다 --title / --sub 를 반복한다. --image 는 선택(오른쪽 배치).
"""
import argparse
from PIL import Image, ImageDraw, ImageFont

FONT_DIR = '/usr/share/fonts/opentype/noto/'
KR = 1  # ttc 안의 KR 글꼴 번호
PURPLE, NAVY, SKY, LIME = (91, 33, 133), (30, 42, 120), (79, 168, 220), (140, 198, 63)


def font(weight, size):
    return ImageFont.truetype(FONT_DIR + f'NotoSansCJK-{weight}.ttc', size, index=KR)


def gradient(w, h, a=(42, 22, 80), b=(30, 42, 120)):
    img = Image.new('RGB', (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            t = (x / w + y / h) / 2
            px[x, y] = tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))
    return img


def rounded_paste(base, im, box, radius=18):
    x, y, w, h = box
    im = im.convert('RGB')
    # 비율 유지하며 채우기(가운데 자르기)
    s = max(w / im.width, h / im.height)
    im = im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS)
    l, t = (im.width - w) // 2, (im.height - h) // 2
    im = im.crop((l, t, l + w, t + h))
    mask = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, w, h), radius, fill=255)
    base.paste(im, (x, y), mask)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('out')
    p.add_argument('--label', required=True)
    p.add_argument('--title', action='append', required=True)
    p.add_argument('--sub', action='append', default=[])
    p.add_argument('--box', default='')
    p.add_argument('--accent', default='')
    p.add_argument('--image')
    p.add_argument('--footer', default='withSECU · BLAST')
    a = p.parse_args()

    W, H = 1200, 630
    img = gradient(W, H)
    d = ImageDraw.Draw(img)
    text_w = 500 if a.image else 1080
    if a.image:
        rounded_paste(img, Image.open(a.image), (600, 140, 560, 348))

    d.text((60, 78), a.label, font=font('Bold', 26), fill=LIME)
    y = 140
    tsize = 58 if a.image else 64
    for line in a.title:
        f = font('Black', tsize)
        while d.textlength(line, font=f) > text_w and tsize > 36:
            tsize -= 2
            f = font('Black', tsize)
        d.text((60, y), line, font=f, fill='white')
        y += int(tsize * 1.25)
    y += 14
    for line in a.sub:
        d.text((60, y), line, font=font('Medium', 26), fill=(225, 225, 235))
        y += 38
    if a.box or a.accent:
        y = max(y + 20, 420)
        bw = 500 if a.image else 620
        d.rounded_rectangle((60, y, 60 + bw, y + 96), 14, outline=SKY, width=3)
        if a.box:
            d.text((84, y + 14), a.box, font=font('Bold', 26), fill='white')
        if a.accent:
            d.text((84, y + 50), a.accent, font=font('Black', 28), fill=LIME)
    d.text((60, 570), a.footer, font=font('Bold', 22), fill=(200, 200, 215))
    img.save(a.out, quality=90)
    print(a.out)


if __name__ == '__main__':
    main()
