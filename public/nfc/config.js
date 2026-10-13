/**
 * Configuração Central — Lojinha do Celular (Unidade Jardim - MS)
 * Edite este arquivo para atualizar Wi-Fi, Chave Pix, Links ou Horários.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LOJINHA_CONFIG = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  return {
    storeName: 'Lojinha do Celular',
    unitName: 'Unidade Jardim',
    cityState: 'Jardim • MS',
    tagline: 'iPhones, Smartphones & Assistência Técnica com até 1 ano de garantia',
    cnpj: '61.874.839/0001-43',
    phoneFormatted: '(67) 99208-6012',
    phoneE164: '+5567992086012',
    whatsappNumber: '5567992086012',
    whatsappDefaultMessage:
      'Olá! Estou aqui na Lojinha do Celular (Unidade Jardim) e gostaria de atendimento.',

    // Configuração do Wi-Fi da Loja (Clientes)
    wifi: {
      ssid: 'KNET-LOJINHA_DO_CELULAR',
      password: '@Lojinha0689',
      encryption: 'WPA', // WPA, WEP ou nopass
      hidden: false,
    },

    // Pagamento Rápido no Balcão (Pix)
    pix: {
      key: '61.874.839/0001-43',
      keyType: 'CNPJ',
      beneficiary: 'Lojinha do Celular',
    },

    // Links Principais e Redes Sociais
    links: {
      catalog: 'https://lojinhadocelular.com/',
      tradeIn: 'https://trocafacil.lojinhadocelular.com/',
      repair: 'https://lojinhadocelular.com/#servicos',
      instagram: 'https://www.instagram.com/_lojinhadocelular',
      instagramHandle: '@_lojinhadocelular',
      googleReview: 'https://g.page/r/CRItm4ajuKxeEAI/review',
      mapsUrl:
        'https://www.google.com/maps/search/?api=1&query=Av.+Duque+de+Caxias+486+Jardim+MS',
      logoUrl: 'https://lojinhadocelular.com/images/favicon.png',
    },

    // Endereço da Unidade Jardim
    address: {
      street: 'Av. Duque de Caxias, 486',
      neighborhood: 'Centro',
      city: 'Jardim',
      state: 'MS',
      postalCode: '79240-000',
      full: 'Av. Duque de Caxias, 486 — Centro, Jardim - MS',
    },

    // Horário de Funcionamento (Fuso: America/Campo_Grande)
    // 0 = Domingo, 1 = Segunda ... 6 = Sábado
    timeZone: 'America/Campo_Grande',
    schedule: {
      0: null, // Domingo: Fechado
      1: { open: '07:00', close: '18:30', label: 'Segunda-feira' },
      2: { open: '07:00', close: '18:30', label: 'Terça-feira' },
      3: { open: '07:00', close: '18:30', label: 'Quarta-feira' },
      4: { open: '07:00', close: '18:30', label: 'Quinta-feira' },
      5: { open: '07:00', close: '18:30', label: 'Sexta-feira' },
      6: { open: '07:00', close: '13:00', label: 'Sábado' },
    },
    scheduleSummary: [
      { days: 'Segunda a Sexta', hours: '07:00 às 18:30' },
      { days: 'Sábado', hours: '07:00 às 13:00' },
      { days: 'Domingo', hours: 'Fechado' },
    ],
  };
});
