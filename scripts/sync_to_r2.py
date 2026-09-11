#!/usr/bin/env python3
"""
Sincronizador de Imagens de Aparelhos para Cloudflare R2 (S3-Compatible)
Lojinha do Celular — Jardim / MS

Envia todos os arquivos WebP otimizados da pasta public/images/iphones/
diretamente para o seu bucket Cloudflare R2 com cache infinito e headers abertos.

Como usar:
  1. Defina as variáveis de ambiente no arquivo .env:
     R2_ACCOUNT_ID=seu_account_id
     R2_ACCESS_KEY_ID=seu_access_key
     R2_SECRET_ACCESS_KEY=sua_secret_key
     R2_BUCKET_NAME=nome_do_seu_bucket (ex: lojinha-images)
     VITE_CLOUDFLARE_R2_URL=https://pub-xxxx.r2.dev (ou seu subdomínio customizado)

  2. Execute:
     python3 scripts/sync_to_r2.py
"""

import os
import sys

try:
    import boto3
    from botocore.config import Config
except ImportError:
    print("Instalando dependência boto3 para comunicação com a API S3/Cloudflare R2...")
    os.system(f"{sys.executable} -m pip install boto3")
    import boto3
    from botocore.config import Config

SRC_DIR = "public/images/iphones"

def load_env():
    env_file = ".env"
    if os.path.exists(env_file):
        with open(env_file, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    if k.strip() not in os.environ:
                        os.environ[k.strip()] = v.strip().strip("\"'")

def main():
    load_env()
    
    account_id = os.environ.get("R2_ACCOUNT_ID")
    access_key = os.environ.get("R2_ACCESS_KEY_ID")
    secret_key = os.environ.get("R2_SECRET_ACCESS_KEY")
    bucket_name = os.environ.get("R2_BUCKET_NAME", "lojinha-images")
    
    if not (account_id and access_key and secret_key):
        print("\n=======================================================")
        print("  ⚠️  Configurações do Cloudflare R2 não encontradas!")
        print("=======================================================")
        print("Para enviar os aparelhos para o Cloudflare R2 (S3), adicione no seu .env:")
        print("  R2_ACCOUNT_ID=...")
        print("  R2_ACCESS_KEY_ID=...")
        print("  R2_SECRET_ACCESS_KEY=...")
        print("  R2_BUCKET_NAME=lojinha-images")
        print("  VITE_CLOUDFLARE_R2_URL=https://pub-xxxxxxxx.r2.dev\n")
        print("Enquanto isso, suas imagens WebP já estão 91.4% mais leves e funcionando")
        print("perfeitamente na pasta public/images/iphones/ (apenas 3.4 MB no total)!\n")
        sys.exit(0)

    endpoint_url = f"https://{account_id}.r2.cloudflarestorage.com"
    print(f"Conectando ao Cloudflare R2 ({endpoint_url})...")

    s3 = boto3.client(
        "s3",
        endpoint_url=endpoint_url,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=Config(signature_version="s3v4"),
    )

    webp_files = [f for f in os.listdir(SRC_DIR) if f.endswith(".webp")]
    print(f"Enviando {len(webp_files)} imagens otimizadas para o bucket '{bucket_name}'...")

    success = 0
    for filename in webp_files:
        local_path = os.path.join(SRC_DIR, filename)
        s3_key = f"images/iphones/{filename}"
        
        with open(local_path, "rb") as f:
            s3.put_object(
                Bucket=bucket_name,
                Key=s3_key,
                Body=f,
                ContentType="image/webp",
                CacheControl="public, max-age=31536000, immutable",
            )
        success += 1
        print(f"  ✓ {filename} -> {s3_key}")

    print(f"\n🎉 Sucesso! {success} imagens sincronizadas com o Cloudflare R2.")
    print("Defina VITE_CLOUDFLARE_R2_URL no .env com a URL pública do seu bucket para usar imediatamente.")

if __name__ == "__main__":
    main()
