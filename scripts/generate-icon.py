"""Generate Cashflow COD app icon (1024×1024 PNG).

Design: rounded-square gradient background (Shopify accent green to a deep
teal), a stylised wallet in the centre with bold white "COD" text, a
small peek-out card with a stripe + dots, and a yellow lightning bolt
top-left signalling "1-click" / instant checkout.
"""

from PIL import Image, ImageDraw, ImageFilter, ImageFont

SIZE = 1024
RADIUS = 220  # corner radius
ACCENT = (0, 128, 96)        # Shopify green
ACCENT_DEEP = (0, 70, 65)
HIGHLIGHT = (255, 255, 255)
ACCENT_SOFT = (158, 230, 192)

BOLD_FONT = "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf"


def rounded_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return mask


def linear_gradient(size: int, top: tuple, bottom: tuple) -> Image.Image:
    grad = Image.new("RGB", (1, size))
    for y in range(size):
        t = y / (size - 1)
        r = int(top[0] * (1 - t) + bottom[0] * t)
        g = int(top[1] * (1 - t) + bottom[1] * t)
        b = int(top[2] * (1 - t) + bottom[2] * t)
        grad.putpixel((0, y), (r, g, b))
    return grad.resize((size, size))


def make_icon() -> Image.Image:
    base = linear_gradient(SIZE, ACCENT, ACCENT_DEEP).convert("RGBA")

    # Top sheen
    sheen = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sheen)
    sd.ellipse((-200, -440, SIZE + 200, 360), fill=(255, 255, 255, 32))
    base.alpha_composite(sheen)

    d = ImageDraw.Draw(base)

    # Wallet body
    wallet_left = 200
    wallet_right = 824
    wallet_top = 360
    wallet_bottom = 800
    wallet_radius = 70

    # Drop shadow
    shadow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    sd2 = ImageDraw.Draw(shadow)
    sd2.rounded_rectangle(
        (wallet_left + 14, wallet_top + 30, wallet_right + 14, wallet_bottom + 30),
        radius=wallet_radius,
        fill=(0, 0, 0, 130),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=22))
    base.alpha_composite(shadow)

    # Wallet body (white)
    d.rounded_rectangle(
        (wallet_left, wallet_top, wallet_right, wallet_bottom),
        radius=wallet_radius,
        fill=HIGHLIGHT,
    )
    # Wallet flap (soft mint)
    flap_h = 130
    d.rounded_rectangle(
        (wallet_left, wallet_top, wallet_right, wallet_top + flap_h),
        radius=wallet_radius,
        fill=ACCENT_SOFT,
    )
    d.rectangle(
        (wallet_left, wallet_top + flap_h - wallet_radius, wallet_right, wallet_top + flap_h),
        fill=ACCENT_SOFT,
    )

    # Card peeking out the top-right of the wallet
    card_left = 540
    card_top = 270
    card_right = 800
    card_bottom = 410
    # Card shadow
    cs = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    csd = ImageDraw.Draw(cs)
    csd.rounded_rectangle(
        (card_left + 6, card_top + 12, card_right + 6, card_bottom + 12),
        radius=24,
        fill=(0, 0, 0, 110),
    )
    cs = cs.filter(ImageFilter.GaussianBlur(radius=10))
    base.alpha_composite(cs)
    d.rounded_rectangle(
        (card_left, card_top, card_right, card_bottom),
        radius=24,
        fill=ACCENT,
    )
    # Magnetic stripe
    d.rectangle((card_left, card_top + 30, card_right, card_top + 56), fill=(15, 30, 25, 220))
    # Dots
    for x in range(card_left + 22, card_right - 30, 36):
        d.ellipse((x, card_top + 86, x + 18, card_top + 104), fill=HIGHLIGHT)

    # "COD" text centered on the wallet body (below the flap)
    text = "COD"
    font_size = 220
    font = ImageFont.truetype(BOLD_FONT, font_size)
    bbox = d.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    text_x = (wallet_left + wallet_right) // 2 - tw // 2 - bbox[0]
    text_y = wallet_top + flap_h + (wallet_bottom - wallet_top - flap_h) // 2 - th // 2 - bbox[1]
    d.text((text_x, text_y), text, font=font, fill=ACCENT)

    # Lightning bolt (top-left) - signals "1-click / instant"
    bolt = [
        (180, 200),
        (340, 200),
        (270, 360),
        (380, 360),
        (200, 580),
        (290, 410),
        (180, 410),
    ]
    bolt_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bolt_layer)
    bd.polygon(bolt, fill=(255, 210, 60, 255))
    # Bolt glow
    glow = bolt_layer.filter(ImageFilter.GaussianBlur(radius=18))
    base.alpha_composite(glow)
    base.alpha_composite(bolt_layer)
    # Bolt edge
    d.line(bolt + [bolt[0]], fill=(180, 130, 0, 200), width=4)

    # Mask everything to a Shopify-style squircle
    mask = rounded_mask(SIZE, RADIUS)
    out = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    out.paste(base, (0, 0), mask)
    return out


if __name__ == "__main__":
    icon = make_icon()
    out_dir = "/home/ubuntu/repos/cashflow-cod/apps/admin/public"
    icon.save(f"{out_dir}/app-icon.png", "PNG")
    icon.resize((512, 512), Image.LANCZOS).save(f"{out_dir}/app-icon-512.png", "PNG")
    icon.resize((192, 192), Image.LANCZOS).save(f"{out_dir}/app-icon-192.png", "PNG")
    icon.resize((64, 64), Image.LANCZOS).save(f"{out_dir}/favicon.png", "PNG")
    print(f"Wrote {out_dir}/app-icon*.png")
