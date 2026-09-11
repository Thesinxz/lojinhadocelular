import os
import sys
from concurrent.futures import ProcessPoolExecutor
from PIL import Image

SRC_DIR = "public/images/iphones"

def convert_image(filename):
    if not filename.endswith(".png"):
        return 0, 0
    png_path = os.path.join(SRC_DIR, filename)
    webp_name = os.path.splitext(filename)[0] + ".webp"
    webp_path = os.path.join(SRC_DIR, webp_name)
    
    orig_size = os.path.getsize(png_path)
    im = Image.open(png_path)
    im.save(webp_path, "WEBP", quality=85, method=4)
    webp_size = os.path.getsize(webp_path)
    return orig_size, webp_size

def main():
    if not os.path.exists(SRC_DIR):
        print(f"Directory {SRC_DIR} not found.")
        sys.exit(1)
        
    png_files = [f for f in os.listdir(SRC_DIR) if f.endswith(".png")]
    print(f"Otimizando {len(png_files)} imagens com aceleração multi-core...")
    
    with ProcessPoolExecutor() as executor:
        results = list(executor.map(convert_image, png_files))
        
    total_orig = sum(r[0] for r in results)
    total_webp = sum(r[1] for r in results)
    
    print(f"Tamanho original (PNGs): {total_orig / (1024*1024):.2f} MB")
    print(f"Tamanho otimizado (WebPs): {total_webp / (1024*1024):.2f} MB")
    print(f"Economia de espaço: {((total_orig - total_webp) / total_orig) * 100:.1f}%")
    print(f"Total de imagens WebP geradas com sucesso: {len(png_files)}")

if __name__ == "__main__":
    main()
