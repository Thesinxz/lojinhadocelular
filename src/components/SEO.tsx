import { useEffect } from "react";

type SEOProps = {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
  jsonLd?: Record<string, any>;
};

export default function SEO({
  title,
  description,
  image,
  url,
  type = "website",
  jsonLd,
}: SEOProps) {
  useEffect(() => {
    // Título
    const defaultTitle = "Lojinha do Celular — iPhones e Android em Jardim-MS";
    const fullTitle = title ? `${title} — Lojinha do Celular` : defaultTitle;
    document.title = fullTitle;

    // Descrição
    const defaultDesc =
      "Lojinha do Celular — iPhones lacrados e seminovos importados dos EUA com 1 ano de garantia. Xiaomi, Realme, Tecno e manutenção em celulares. Jardim-MS e Guia Lopes da Laguna.";
    const metaDesc = description || defaultDesc;

    setMeta("description", metaDesc);
    setOgMeta("og:title", title || defaultTitle);
    setOgMeta("og:description", metaDesc);
    setOgMeta("og:type", type);

    if (url) {
      setOgMeta("og:url", url);
    }

    if (image) {
      const absoluteImage = image.startsWith("/")
        ? `${window.location.origin}${image}`
        : image;
      setOgMeta("og:image", absoluteImage);
      setTwitterMeta("twitter:image", absoluteImage);
    }

    setTwitterMeta("twitter:title", title || defaultTitle);
    setTwitterMeta("twitter:description", metaDesc);

    // Injeção de JSON-LD dinâmico
    let scriptEl = document.getElementById("dynamic-jsonld") as HTMLScriptElement | null;
    if (jsonLd) {
      if (!scriptEl) {
        scriptEl = document.createElement("script");
        scriptEl.id = "dynamic-jsonld";
        scriptEl.type = "application/ld+json";
        document.head.appendChild(scriptEl);
      }
      scriptEl.textContent = JSON.stringify(jsonLd);
    } else if (scriptEl) {
      scriptEl.remove();
    }
  }, [title, description, image, url, type, jsonLd]);

  return null;
}

function setMeta(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setOgMeta(property: string, content: string) {
  let el = document.querySelector(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setTwitterMeta(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}
