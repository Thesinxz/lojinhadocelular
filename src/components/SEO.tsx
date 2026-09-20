import { useEffect } from "react";

type SEOProps = {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
};

export default function SEO({
  title,
  description,
  image,
  url,
  type = "website",
  noindex = false,
  jsonLd,
}: SEOProps) {
  const jsonLdString = jsonLd ? JSON.stringify(jsonLd) : "";

  useEffect(() => {
    // Título
    const defaultTitle = "Lojinha do Celular — iPhones e Android em Jardim-MS";
    const fullTitle = title
      ? title.includes("Lojinha do Celular")
        ? title
        : `${title} — Lojinha do Celular`
      : defaultTitle;
    document.title = fullTitle;

    // Descrição
    const defaultDesc =
      "Lojinha do Celular — iPhones lacrados e seminovos importados dos EUA com 1 ano de garantia. Xiaomi, Realme, Tecno e manutenção em celulares. Jardim-MS e Guia Lopes da Laguna.";
    const metaDesc = description || defaultDesc;

    setMeta("description", metaDesc);
    setOgMeta("og:title", title || defaultTitle);
    setOgMeta("og:description", metaDesc);
    setOgMeta("og:type", type);

    // Meta Robots (Indexação / Noindex)
    if (noindex) {
      setMeta("robots", "noindex, nofollow");
    } else {
      setMeta(
        "robots",
        "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
      );
    }

    // Canonical & OG URL limpas (remove hash fragments e query strings indesejadas)
    let canonicalUrl = "";
    if (url) {
      canonicalUrl = url.split("#")[0].split("?")[0];
    } else if (typeof window !== "undefined") {
      const isLocal =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";
      const domain = isLocal
        ? window.location.origin
        : "https://lojinhadocelular.com";
      const cleanPath =
        window.location.pathname === "/index.html"
          ? "/"
          : window.location.pathname;
      canonicalUrl = `${domain}${cleanPath}`;
    }

    if (canonicalUrl) {
      setCanonical(canonicalUrl);
      setOgMeta("og:url", canonicalUrl);
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
    if (jsonLdString) {
      if (!scriptEl) {
        scriptEl = document.createElement("script");
        scriptEl.id = "dynamic-jsonld";
        scriptEl.type = "application/ld+json";
        document.head.appendChild(scriptEl);
      }
      scriptEl.textContent = jsonLdString;
    } else if (scriptEl) {
      scriptEl.remove();
    }
  }, [title, description, image, url, type, noindex, jsonLdString]);

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

function setCanonical(url: string) {
  let el = document.querySelector(`link[rel="canonical"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  const absoluteUrl = url.startsWith("http")
    ? url
    : `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`;
  el.setAttribute("href", absoluteUrl);
}
