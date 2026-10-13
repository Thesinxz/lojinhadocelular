/**
 * Utilitários de Negócio — Central NFC Lojinha do Celular
 * Compatível com navegador (window.LojinhaUtils) e Node.js (CommonJS).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LojinhaUtils = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function escapeWifiField(value) {
    return String(value || '')
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/:/g, '\\:')
      .replace(/"/g, '\\"');
  }

  /**
   * Gera a string universal WIFI: para QR Code nativo de iOS e Android.
   */
  function buildWifiQrPayload({ ssid, password, encryption = 'WPA', hidden = false }) {
    const enc = encryption || 'WPA';
    const escapedSsid = escapeWifiField(ssid);
    const escapedPass = escapeWifiField(password);
    const hiddenPart = hidden ? 'H:true;' : '';
    return `WIFI:S:${escapedSsid};T:${enc};P:${escapedPass};${hiddenPart};`;
  }

  function escapeXml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Gera um perfil oficial Apple (.mobileconfig) para conexão automática ao Wi-Fi no iPhone/iPad.
   */
  function buildAppleWifiMobileConfig(config) {
    const ssid = escapeXml(config.wifi.ssid);
    const password = escapeXml(config.wifi.password);
    const storeName = escapeXml(`${config.storeName} (${config.unitName})`);
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>AutoJoin</key>
      <true/>
      <key>EncryptionType</key>
      <string>WPA</string>
      <key>HIDDEN_NETWORK</key>
      <false/>
      <key>IsHotspot</key>
      <false/>
      <key>Password</key>
      <string>${password}</string>
      <key>PayloadDescription</key>
      <string>Configuração automática do Wi-Fi ${storeName}</string>
      <key>PayloadDisplayName</key>
      <string>Wi-Fi ${ssid}</string>
      <key>PayloadIdentifier</key>
      <string>com.lojinhadocelular.wifi.network</string>
      <key>PayloadType</key>
      <string>com.apple.wifi.managed</string>
      <key>PayloadUUID</key>
      <string>7A8B9C0D-1111-2222-3333-444455556666</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>SSID_STR</key>
      <string>${ssid}</string>
    </dict>
  </array>
  <key>PayloadDescription</key>
  <string>Conecta automaticamente ao Wi-Fi de clientes da ${storeName}</string>
  <key>PayloadDisplayName</key>
  <string>Wi-Fi ${storeName}</string>
  <key>PayloadIdentifier</key>
  <string>com.lojinhadocelular.wifi.profile</string>
  <key>PayloadOrganization</key>
  <string>${storeName}</string>
  <key>PayloadRemovalDisallowed</key>
  <false/>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>1A2B3C4D-5555-6666-7777-888899990000</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>`;
  }

  /**
   * Gera conteúdo vCard 3.0 (.vcf) para salvar o contato da loja na agenda offline.
   */
  function buildVCard(config) {
    const fullName = `${config.storeName} - ${config.unitName}`;
    const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `N:;${fullName};;;`,
      `FN:${fullName}`,
      `ORG:${config.storeName}`,
      `TITLE:${config.tagline}`,
      `TEL;TYPE=CELL,VOICE:${config.phoneE164}`,
      `ADR;TYPE=WORK:;;${config.address.street};${config.address.city};${config.address.state};${config.address.postalCode};Brasil`,
      `URL:${config.links.catalog.replace(/\/$/, '')}`,
      `NOTE:CNPJ: ${config.cnpj} | Instagram: ${config.links.instagramHandle}`,
      'END:VCARD',
    ];
    return lines.join('\r\n');
  }

  function timeToMinutes(hhmm) {
    const [h, m] = String(hhmm).split(':').map(Number);
    return h * 60 + m;
  }

  /**
   * Calcula em tempo real se a loja está aberta ou fechada no fuso de MS.
   */
  function getStoreStatus(date, scheduleConfig, timeZone = 'America/Campo_Grande') {
    const now = date instanceof Date ? date : new Date(date);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const map = {};
    for (const part of parts) {
      map[part.type] = part.value;
    }

    const weekdayMap = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };

    const dayIndex = weekdayMap[map.weekday] ?? now.getDay();
    const hour = Number(map.hour === '24' ? 0 : map.hour);
    const minute = Number(map.minute);
    const currentMinutes = hour * 60 + minute;

    const todayRule = scheduleConfig ? scheduleConfig[dayIndex] : null;

    if (todayRule && todayRule.open && todayRule.close) {
      const openMin = timeToMinutes(todayRule.open);
      const closeMin = timeToMinutes(todayRule.close);

      if (currentMinutes >= openMin && currentMinutes < closeMin) {
        return {
          isOpen: true,
          label: 'Aberto agora',
          detail: `Atendimento hoje até às ${todayRule.close}`,
        };
      }

      if (currentMinutes < openMin) {
        return {
          isOpen: false,
          label: 'Fechado agora',
          detail: `Abre hoje às ${todayRule.open}`,
        };
      }
    }

    // Procura o próximo dia de abertura
    for (let offset = 1; offset <= 7; offset++) {
      const nextDay = (dayIndex + offset) % 7;
      const nextRule = scheduleConfig ? scheduleConfig[nextDay] : null;
      if (nextRule && nextRule.open) {
        const dayReference = offset === 1 ? 'amanhã' : nextRule.label;
        return {
          isOpen: false,
          label: 'Fechado no momento',
          detail: `Abre ${dayReference} às ${nextRule.open}`,
        };
      }
    }

    return {
      isOpen: false,
      label: 'Fechado no momento',
      detail: 'Consulte nossos horários',
    };
  }

  /**
   * Cria link do WhatsApp codificado.
   */
  function buildWhatsAppUrl(phone, message) {
    const cleanPhone = String(phone || '').replace(/\D+/g, '');
    const encoded = encodeURIComponent(message || '');
    return `https://wa.me/${cleanPhone}${encoded ? `?text=${encoded}` : ''}`;
  }

  return {
    escapeWifiField,
    buildWifiQrPayload,
    buildAppleWifiMobileConfig,
    buildVCard,
    getStoreStatus,
    buildWhatsAppUrl,
  };
});
