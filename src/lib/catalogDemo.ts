import type { CategoryValue } from "@contracts/types";

export interface ClientReview {
  id: string;
  name: string;
  bought: string;
  avatarUrl: string;
}

export interface DemoVariant {
  id: number;
  productId: number;
  version: string;
  storage: string;
  color: string;
  colorHex: string | null;
  imageUrl: string | null;
  batteryHealth: string | null;
  warranty: string | null;
  condition: string | null;
  notes: string | null;
  priceCash: number;
  quantity: number;
  available: boolean;
}

export interface DemoProduct {
  id: number;
  name: string;
  brand: string;
  category: CategoryValue;
  condition: string;
  description: string | null;
  imageUrl: string | null;
  warranty: string | null;
  featured: boolean;
  active: boolean;
  createdAt: Date;
  variants: DemoVariant[];
}

export const DEMO_CLIENTS: ClientReview[] = [
  {
    id: "1",
    name: "Lucas Moreira",
    bought: "iPhone 15 Pro Max 256GB",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
  },
  {
    id: "2",
    name: "Mariana Souza",
    bought: "iPhone 13 128GB Estelar",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
  },
  {
    id: "3",
    name: "Carlos Eduardo",
    bought: "iPhone 14 Pro 128GB Roxo",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
  },
  {
    id: "4",
    name: "Beatriz Lima",
    bought: "iPhone 15 128GB Rosa",
    avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&auto=format&fit=crop&q=80",
  },
  {
    id: "5",
    name: "Rafael Mendes",
    bought: "iPhone 16 Pro 256GB Titânio",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80",
  },
];

export const DEMO_PRODUCTS: DemoProduct[] = [
  {
    id: 9001,
    name: "iPhone 16 Pro Max",
    brand: "Apple",
    category: "iphone_lacrado",
    condition: "lacrado",
    description: "O ápice da tecnologia Apple com chip A18 Pro, controle de câmera inovador e acabamento em titânio de grau aeroespacial.",
    imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-9inch-deserttitanium?wid=1000&hei=1000&fmt=png-alpha",
    warranty: "1 ano garantia Apple",
    featured: true,
    active: true,
    createdAt: new Date("2026-09-01T12:00:00Z"),
    variants: [
      {
        id: 90011,
        productId: 9001,
        version: "Pro Max",
        storage: "256GB",
        color: "Titânio Deserto",
        colorHex: "#c8b49e",
        imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-9inch-deserttitanium?wid=1000&hei=1000&fmt=png-alpha",
        batteryHealth: "100%",
        warranty: "1 ano garantia Apple",
        condition: "lacrado",
        notes: "Novo na caixa lacrada de fábrica com cabo USB-C",
        priceCash: 899900,
        quantity: 3,
        available: true,
      },
      {
        id: 90012,
        productId: 9001,
        version: "Pro Max",
        storage: "256GB",
        color: "Titânio Preto",
        colorHex: "#2b2b2d",
        imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-9inch-blacktitanium?wid=1000&hei=1000&fmt=png-alpha",
        batteryHealth: "100%",
        warranty: "1 ano garantia Apple",
        condition: "lacrado",
        notes: "Novo na caixa lacrada de fábrica com cabo USB-C",
        priceCash: 899900,
        quantity: 2,
        available: true,
      },
      {
        id: 90013,
        productId: 9001,
        version: "Pro Max",
        storage: "512GB",
        color: "Titânio Natural",
        colorHex: "#9d9893",
        imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-9inch-naturaltitanium?wid=1000&hei=1000&fmt=png-alpha",
        batteryHealth: "100%",
        warranty: "1 ano garantia Apple",
        condition: "lacrado",
        notes: "Novo na caixa lacrada de fábrica com cabo USB-C",
        priceCash: 999900,
        quantity: 1,
        available: true,
      },
    ],
  },
  {
    id: 9002,
    name: "iPhone 15 Pro",
    brand: "Apple",
    category: "iphone_seminovo",
    condition: "seminovo",
    description: "Design refinado em titânio leve com chip A17 Pro e sistema avançado de câmeras de 48MP. Estado impecável.",
    imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-1inch-naturaltitanium?wid=1000&hei=1000&fmt=png-alpha",
    warranty: "1 ano de garantia Lojinha",
    featured: true,
    active: true,
    createdAt: new Date("2026-09-01T12:00:00Z"),
    variants: [
      {
        id: 90021,
        productId: 9002,
        version: "Pro",
        storage: "128GB",
        color: "Titânio Azul",
        colorHex: "#353c45",
        imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-1inch-bluetitanium?wid=1000&hei=1000&fmt=png-alpha",
        batteryHealth: "94%",
        warranty: "1 ano de garantia Lojinha",
        condition: "seminovo",
        notes: "Aparelho importado dos EUA, sem nenhum detalhe estético",
        priceCash: 539900,
        quantity: 2,
        available: true,
      },
      {
        id: 90022,
        productId: 9002,
        version: "Pro",
        storage: "256GB",
        color: "Titânio Natural",
        colorHex: "#9d9893",
        imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-1inch-naturaltitanium?wid=1000&hei=1000&fmt=png-alpha",
        batteryHealth: "96%",
        warranty: "1 ano de garantia Lojinha",
        condition: "seminovo",
        notes: "Aparelho revisado e certificado, bateria original acima de 95%",
        priceCash: 589900,
        quantity: 1,
        available: true,
      },
    ],
  },
  {
    id: 9003,
    name: "iPhone 14",
    brand: "Apple",
    category: "iphone_seminovo",
    condition: "seminovo",
    description: "Excelente desempenho com chip A15 Bionic, modo Ação para vídeos ultrassuaves e autonomia de bateria para o dia todo.",
    imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-14-finish-select-202209-6-1inch-starlight?wid=1000&hei=1000&fmt=png-alpha",
    warranty: "1 ano de garantia Lojinha",
    featured: false,
    active: true,
    createdAt: new Date("2026-09-01T12:00:00Z"),
    variants: [
      {
        id: 90031,
        productId: 9003,
        version: "",
        storage: "128GB",
        color: "Estelar",
        colorHex: "#faf6f2",
        imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-14-finish-select-202209-6-1inch-starlight?wid=1000&hei=1000&fmt=png-alpha",
        batteryHealth: "89%",
        warranty: "1 ano de garantia Lojinha",
        condition: "seminovo",
        notes: "Excelente estado de conservação, tela original intacta",
        priceCash: 339900,
        quantity: 2,
        available: true,
      },
      {
        id: 90032,
        productId: 9003,
        version: "",
        storage: "128GB",
        color: "Meia-noite",
        colorHex: "#1f2328",
        imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-14-finish-select-202209-6-1inch-midnight?wid=1000&hei=1000&fmt=png-alpha",
        batteryHealth: "91%",
        warranty: "1 ano de garantia Lojinha",
        condition: "seminovo",
        notes: "Excelente estado de conservação",
        priceCash: 339900,
        quantity: 1,
        available: true,
      },
    ],
  },
  {
    id: 9004,
    name: "Carregador MagSafe 25W Apple",
    brand: "Apple",
    category: "acessorio",
    condition: "novo",
    description: "Carregador por indução magnética ultrarrápido original Apple, compatível com iPhones a partir da linha 12.",
    imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/MHXH3?wid=1000&hei=1000&fmt=png-alpha",
    warranty: "6 meses de garantia",
    featured: false,
    active: true,
    createdAt: new Date("2026-09-01T12:00:00Z"),
    variants: [
      {
        id: 90041,
        productId: 9004,
        version: "25W",
        storage: "Padrão",
        color: "Branco",
        colorHex: "#ffffff",
        imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/MHXH3?wid=1000&hei=1000&fmt=png-alpha",
        batteryHealth: null,
        warranty: "6 meses de garantia",
        condition: "novo",
        notes: "Acessório original lacrado na caixa",
        priceCash: 29900,
        quantity: 10,
        available: true,
      },
    ],
  },
  {
    id: 9005,
    name: "iPhone 13",
    brand: "Apple",
    category: "iphone_seminovo",
    condition: "seminovo",
    description: "Câmera dupla avançada na diagonal, tela Super Retina XDR super brilhante e chip A15 Bionic.",
    imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-13-finish-select-202207-6-1inch-midnight?wid=1000&hei=1000&fmt=png-alpha",
    warranty: "1 ano de garantia Lojinha",
    featured: false,
    active: true,
    createdAt: new Date("2026-09-01T12:00:00Z"),
    variants: [
      {
        id: 90051,
        productId: 9005,
        version: "",
        storage: "128GB",
        color: "Meia-noite",
        colorHex: "#1f2328",
        imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-13-finish-select-202207-6-1inch-midnight?wid=1000&hei=1000&fmt=png-alpha",
        batteryHealth: "88%",
        warranty: "1 ano de garantia Lojinha",
        condition: "seminovo",
        notes: "Seminovo revisado em perfeito estado",
        priceCash: 289900,
        quantity: 3,
        available: true,
      },
    ],
  },
  {
    id: 9006,
    name: "AirPods Pro (2ª Geração)",
    brand: "Apple",
    category: "acessorio",
    condition: "lacrado",
    description: "Cancelamento Ativo de Ruído até 2x melhor, Áudio Espacial Personalizado e estojo MagSafe com entrada USB-C.",
    imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/MTJV3?wid=1000&hei=1000&fmt=png-alpha",
    warranty: "1 ano garantia Apple",
    featured: false,
    active: true,
    createdAt: new Date("2026-09-01T12:00:00Z"),
    variants: [
      {
        id: 90061,
        productId: 9006,
        version: "USB-C",
        storage: "Padrão",
        color: "Branco",
        colorHex: "#ffffff",
        imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/MTJV3?wid=1000&hei=1000&fmt=png-alpha",
        batteryHealth: null,
        warranty: "1 ano garantia Apple",
        condition: "lacrado",
        notes: "Novo lacrado de fábrica",
        priceCash: 179900,
        quantity: 5,
        available: true,
      },
    ],
  },
];
