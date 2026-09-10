export function getVideoEmbed(url: string): { type: "youtube" | "video" | "link"; src: string } | null {
  if (!url || !url.trim()) return null;
  const u = url.trim();

  // YouTube (watch?v=, youtu.be/, shorts/, embed/)
  const ytMatch = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  if (ytMatch && ytMatch[1]) {
    return { type: "youtube", src: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}` };
  }

  // Direct video
  if (/\.(mp4|webm|mov|ogg)($|\?)/i.test(u) || u.includes("video/upload")) {
    return { type: "video", src: u };
  }

  return { type: "link", src: u };
}
