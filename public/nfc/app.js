(function () {
  const config = window.LOJINHA_CONFIG;
  const utils = window.LojinhaUtils;
  const qr = window.LojinhaQR;

  if (!config || !utils) return;

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setHref(id, url) {
    const el = document.getElementById(id);
    if (el && url) el.setAttribute('href', url);
  }

  let toastTimer = null;
  function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 3200);
  }

  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {}

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (_) {
      ok = false;
    }
    document.body.removeChild(textarea);
    return ok;
  }

  function triggerHaptic() {
    try {
      if (navigator.vibrate) navigator.vibrate(35);
    } catch (_) {}
  }

  function updateStatusBadge() {
    const status = utils.getStoreStatus(new Date(), config.schedule, config.timeZone);
    const dot = document.getElementById('status-dot');
    if (dot) {
      dot.classList.toggle('closed', !status.isOpen);
    }
    setText('status-label', status.label);
    setText('status-detail', status.detail);
  }

  function initStoreContent() {
    setText('brand-name', config.storeName);
    setText('unit-pill-text', `${config.unitName} • MS`);

    // Wi-Fi
    setText('wifi-ssid', config.wifi.ssid);
    setText('wifi-password', config.wifi.password);
    setText('modal-wifi-ssid', config.wifi.ssid);
    setText('modal-wifi-password', config.wifi.password);

    // Links
    setHref('link-google-review', config.links.googleReview);
    setHref('link-catalog', config.links.catalog);
    setHref('link-tradein', config.links.tradeIn);
    setHref('link-repair', config.links.repair);
    setHref('link-instagram', config.links.instagram);
    setText('instagram-handle', `${config.links.instagramHandle} • Ofertas e novidades diárias`);

    const waUrl = utils.buildWhatsAppUrl(config.whatsappNumber, config.whatsappDefaultMessage);
    setHref('link-whatsapp', waUrl);
    setText('whatsapp-subtitle', `${config.phoneFormatted} • Atendimento ${config.unitName}`);

    // Pix
    setText('pix-key', config.pix.key);
    setText('pix-beneficiary', `${config.pix.beneficiary} (${config.pix.keyType})`);

    // Address & Schedule
    setText('address-full', config.address.full);
    setHref('link-maps', config.links.mapsUrl);
    setText('footer-cnpj', `CNPJ: ${config.cnpj} • ${config.storeName} (${config.unitName})`);

    const hoursContainer = document.getElementById('hours-list');
    if (hoursContainer && Array.isArray(config.scheduleSummary)) {
      hoursContainer.innerHTML = config.scheduleSummary
        .map(
          (item) =>
            `<div class="hours-row"><span>${item.days}</span><strong>${item.hours}</strong></div>`
        )
        .join('');
    }

    updateStatusBadge();
    setInterval(updateStatusBadge, 60000);
  }

  function initWifiActions() {
    const btnCopyWifi = document.getElementById('btn-copy-wifi');
    const helperBanner = document.getElementById('wifi-helper-banner');

    if (btnCopyWifi) {
      btnCopyWifi.addEventListener('click', async () => {
        await copyToClipboard(config.wifi.password);
        triggerHaptic();

        const originalHtml = btnCopyWifi.getAttribute('data-original-html') || btnCopyWifi.innerHTML;
        if (!btnCopyWifi.getAttribute('data-original-html')) {
          btnCopyWifi.setAttribute('data-original-html', originalHtml);
        }

        btnCopyWifi.classList.add('copied');
        btnCopyWifi.innerHTML = '<span>✓ Senha Copiada!</span>';

        if (helperBanner) {
          helperBanner.classList.add('visible');
        }
        showToast(`Senha "${config.wifi.password}" copiada!`);

        setTimeout(() => {
          btnCopyWifi.classList.remove('copied');
          btnCopyWifi.innerHTML = originalHtml;
        }, 3500);

        // No Android, abre automaticamente a tela de Wi-Fi do sistema (sem precisar baixar nada)
        if (/Android/i.test(navigator.userAgent || '')) {
          setTimeout(() => {
            window.location.href = 'intent:#Intent;action=android.settings.WIFI_SETTINGS;end';
          }, 400);
        }
      });
    }

    // QR Code Modal
    const btnShowQr = document.getElementById('btn-show-wifi-qr');
    const modalWifiQr = document.getElementById('modal-wifi-qr');
    const btnCloseWifiQr = document.getElementById('btn-close-wifi-qr');
    const qrContainer = document.getElementById('wifi-qr-svg-container');

    if (btnShowQr && modalWifiQr) {
      btnShowQr.addEventListener('click', () => {
        if (qr && qrContainer) {
          const payload = utils.buildWifiQrPayload(config.wifi);
          const dataUrl = qr.generateQrPngDataUrl
            ? qr.generateQrPngDataUrl(payload, { margin: 4, scale: 8 })
            : '';
          if (dataUrl) {
            qrContainer.innerHTML = `<img src="${dataUrl}" alt="QR Code Wi-Fi ${config.wifi.ssid}" width="210" height="210" />`;
          } else {
            qrContainer.innerHTML = qr.generateQrSvg(payload, { size: 210, margin: 4 });
          }
        }
        modalWifiQr.classList.add('open');
      });
    }

    if (btnCloseWifiQr && modalWifiQr) {
      btnCloseWifiQr.addEventListener('click', () => {
        modalWifiQr.classList.remove('open');
      });
      modalWifiQr.addEventListener('click', (e) => {
        if (e.target === modalWifiQr) modalWifiQr.classList.remove('open');
      });
    }
  }

  function initPixAndContactActions() {
    const btnCopyPix = document.getElementById('btn-copy-pix');
    if (btnCopyPix) {
      btnCopyPix.addEventListener('click', async () => {
        await copyToClipboard(config.pix.key);
        triggerHaptic();
        const originalText = btnCopyPix.textContent;
        btnCopyPix.textContent = '✓ Chave Pix Copiada!';
        showToast(`Chave Pix (${config.pix.key}) copiada!`);
        setTimeout(() => {
          btnCopyPix.textContent = originalText;
        }, 3000);
      });
    }

    const btnSaveVcard = document.getElementById('btn-save-vcard');
    if (btnSaveVcard) {
      btnSaveVcard.addEventListener('click', () => {
        triggerHaptic();
        const vcfContent = utils.buildVCard(config);
        const blob = new Blob([vcfContent], { type: 'text/vcard;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'lojinha-do-celular-jardim.vcf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast('Abrindo contato da loja...');
      });
    }

    const btnShare = document.getElementById('btn-share-store');
    if (btnShare) {
      btnShare.addEventListener('click', async () => {
        const shareData = {
          title: `${config.storeName} — ${config.unitName}`,
          text: `${config.storeName} (${config.unitName}): Catálogo, WhatsApp, Troca Fácil e localização!`,
          url: window.location.href.split('?')[0],
        };
        try {
          if (navigator.share) {
            await navigator.share(shareData);
            return;
          }
        } catch (_) {}
        await copyToClipboard(shareData.url);
        showToast('Link da página copiado!');
      });
    }
  }

  function initNfcGuideModal() {
    const btnOpenGuide = document.getElementById('btn-open-nfc-guide');
    const modalGuide = document.getElementById('modal-nfc-guide');
    const btnCloseGuide = document.getElementById('btn-close-nfc-guide');
    const pageUrlDisplay = document.getElementById('nfc-page-url');
    const btnCopyPageUrl = document.getElementById('btn-copy-page-url');
    const pageQrContainer = document.getElementById('page-qr-svg-container');

    function openGuide() {
      if (!modalGuide) return;
      const cleanUrl = window.location.href.split('?')[0];
      if (pageUrlDisplay) pageUrlDisplay.textContent = cleanUrl;
      if (qr && pageQrContainer) {
        try {
          const dataUrl = qr.generateQrPngDataUrl
            ? qr.generateQrPngDataUrl(cleanUrl, { margin: 4, scale: 8 })
            : '';
          pageQrContainer.innerHTML = dataUrl
            ? `<img src="${dataUrl}" alt="QR Code da Página" width="190" height="190" />`
            : qr.generateQrSvg(cleanUrl, { size: 190, margin: 4 });
        } catch (_) {
          pageQrContainer.innerHTML = qr.generateQrSvg(config.links.catalog, { size: 190, margin: 4 });
        }
      }
      modalGuide.classList.add('open');
    }

    if (btnOpenGuide) {
      btnOpenGuide.addEventListener('click', openGuide);
    }

    if (btnCloseGuide && modalGuide) {
      btnCloseGuide.addEventListener('click', () => {
        modalGuide.classList.remove('open');
      });
      modalGuide.addEventListener('click', (e) => {
        if (e.target === modalGuide) modalGuide.classList.remove('open');
      });
    }

    if (btnCopyPageUrl) {
      btnCopyPageUrl.addEventListener('click', async () => {
        const cleanUrl = window.location.href.split('?')[0];
        await copyToClipboard(cleanUrl);
        showToast('Link para gravar no NFC copiado!');
      });
    }

    if (window.location.search.includes('setup=1')) {
      openGuide();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initStoreContent();
    initWifiActions();
    initPixAndContactActions();
    initNfcGuideModal();
  });
})();
