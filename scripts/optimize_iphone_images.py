import os
import sys
from concurrent.futures import ProcessPoolExecutor
from PIL import Image

IPHONES_DIR = "public/images/iphones"
THUMB_WIDTH = 360


def process_iphone_asset(filename: str) -> tuple[str, int, int]:
    """Converte PNGs residuais e gera variante responsiva -360w.webp."""
    if filename.endswith("-360w.webp"):
        return filename, 0, 0

    src_path = os.path.join(IPHONES_DIR, filename)
    stem, ext = os.path.splitext(filename)
    ext_lower = ext.lower()
    if ext_lower not in {".png", ".webp"}:
        return filename, 0, 0

    full_webp_path = os.path.join(IPHONES_DIR, f"{stem}.webp")
    thumb_webp_path = os.path.join(IPHONES_DIR, f"{stem}-{THUMB_WIDTH}w.webp")

    im = Image.open(src_path)
    if im.mode not in {"RGB", "RGBA"}:
        im = im.convert("RGBA")

    if ext_lower == ".png":
        im.save(full_webp_path, "WEBP", quality=85, method=6)

    orig_w, orig_h = im.size
    if orig_w > THUMB_WIDTH:
        thumb_h = max(1, round((orig_h * THUMB_WIDTH) / orig_w))
        thumb_im = im.resize((THUMB_WIDTH, thumb_h), Image.Resampling.LANCZOS)
    else:
        thumb_im = im

    thumb_im.save(thumb_webp_path, "WEBP", quality=82, method=6)
    return filename, os.path.getsize(full_webp_path), os.path.getsize(thumb_webp_path)


def optimize_brand_and_og_assets() -> None:
    """Otimiza poster do hero, imagens OG (WhatsApp) e logos sem quebrar dimensões."""
    poster_jpg = "public/hero-poster.jpg"
    poster_webp = "public/hero-poster.webp"
    if os.path.exists(poster_jpg):
        im = Image.open(poster_jpg).convert("RGB")
        # Mantém proporção 9:16 nítida em mobile (720px largura -> 1280px altura)
        w, h = im.size
        target_w = min(w, 720)
        if w != target_w:
            im = im.resize((target_w, round((h * target_w) / w)), Image.Resampling.LANCZOS)
        im.save(poster_webp, "WEBP", quality=78, method=6)
        im.save(poster_jpg, "JPEG", quality=78, optimize=True, progressive=True)

    troca_png = "public/images/troca-facil-og.png"
    troca_jpg = "public/images/troca-facil-og.jpg"
    if os.path.exists(troca_png):
        im = Image.open(troca_png).convert("RGB")
        if im.size[0] > 1200:
            im = im.resize((1200, 630), Image.Resampling.LANCZOS)
        im.save(troca_jpg, "JPEG", quality=84, optimize=True, progressive=True)
        # Mantém .png compacto (quantizado) caso algum bot/link antigo aponte para ele
        im.quantize(colors=256, method=Image.Quantize.MEDIANCUT).save(
            troca_png,
            "PNG",
            optimize=True,
        )

    for png_path in ["public/images/og-banner.png", "public/images/og-preview.png"]:
        if os.path.exists(png_path):
            im = Image.open(png_path)
            if im.mode == "RGBA":
                im.quantize(colors=256, method=Image.Quantize.FASTOCTREE).save(
                    png_path,
                    "PNG",
                    optimize=True,
                )

    logo_png = "public/images/logo.png"
    if os.path.exists(logo_png):
        im = Image.open(logo_png).convert("RGBA")
        if im.size[0] > 512:
            ratio = 512 / im.size[0]
            im = im.resize((512, max(1, round(im.size[1] * ratio))), Image.Resampling.LANCZOS)
        im.save(logo_png, "PNG", optimize=True)

    logo_icon_png = "public/images/logo-icon.png"
    logo_icon_webp = "public/images/logo-icon-nav.webp"
    if os.path.exists(logo_icon_png):
        im = Image.open(logo_icon_png).convert("RGBA")
        nav_h = 96
        nav_w = max(1, round((im.size[0] * nav_h) / im.size[1]))
        im.resize((nav_w, nav_h), Image.Resampling.LANCZOS).save(
            logo_icon_webp,
            "WEBP",
            quality=85,
            method=6,
        )
        if im.size[1] > 512:
            h512 = 512
            w512 = max(1, round((im.size[0] * h512) / im.size[1]))
            im.resize((w512, h512), Image.Resampling.LANCZOS).save(
                logo_icon_png,
                "PNG",
                optimize=True,
            )


def main() -> None:
    if not os.path.exists(IPHONES_DIR):
        print(f"Directory {IPHONES_DIR} not found.")
        sys.exit(1)

    files = sorted(
        f
        for f in os.listdir(IPHONES_DIR)
        if f.endswith((".png", ".webp")) and not f.endswith("-360w.webp")
    )
    print(f"Gerando miniaturas -360w.webp para {len(files)} imagens...")
    with ProcessPoolExecutor() as executor:
        results = list(executor.map(process_iphone_asset, files))

    full_total = sum(r[1] for r in results)
    thumb_total = sum(r[2] for r in results)
    print(f"Full WebPs: {full_total / (1024 * 1024):.2f} MB | -360w.webp: {thumb_total / (1024 * 1024):.2f} MB")

    optimize_brand_and_og_assets()
    print("Poster, OG e logos otimizados com sucesso.")


if __name__ == "__main__":
    main()
