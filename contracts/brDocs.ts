/** Validações de documentos brasileiros e IMEI (compartilhadas entre painel e servidor). */

export function onlyDigits(value: string | null | undefined): string {
  return String(value ?? "").replace(/\D/g, "");
}

/** Normaliza um telefone brasileiro para DDI + DDD + número; aceita DDI 55 opcional. */
export function normalizeBrazilPhone(value: string | null | undefined): string | null {
  const raw = String(value ?? "").trim();
  let digits = onlyDigits(raw);
  const explicitCountryCode = /^(?:\+55|0055)/.test(raw);
  const countryCodeWithoutPlus = digits.startsWith("55") && (digits.length === 12 || digits.length === 13);

  if (explicitCountryCode || countryCodeWithoutPlus) {
    digits = digits.replace(/^(?:0055|55)/, "");
  } else if (digits.startsWith("0")) {
    digits = digits.replace(/^0+/, "");
  }

  const nationalNumber = normalizeBrazilNationalPhone(digits);
  return nationalNumber ? `55${nationalNumber}` : null;
}

const BRAZILIAN_DDDS = new Set([
  "11", "12", "13", "14", "15", "16", "17", "18", "19", "21", "22", "24", "27", "28",
  "31", "32", "33", "34", "35", "37", "38", "41", "42", "43", "44", "45", "46", "47",
  "48", "49", "51", "53", "54", "55", "61", "62", "63", "64", "65", "66", "67", "68",
  "69", "71", "73", "74", "75", "77", "79", "81", "82", "83", "84", "85", "86", "87",
  "88", "89", "91", "93", "94", "95", "96", "97", "98", "99",
]);

function normalizeBrazilNationalPhone(digits: string): string | null {
  if (!/^\d{10,11}$/.test(digits) || !BRAZILIAN_DDDS.has(digits.slice(0, 2))) return null;
  const subscriber = digits.slice(2);
  if (subscriber.length === 8 && /^[6-9]/.test(subscriber)) {
    return `${digits.slice(0, 2)}9${subscriber}`;
  }
  if (subscriber.length === 9 && subscriber.startsWith("9")) return digits;
  if (subscriber.length === 8 && /^[2-5]/.test(subscriber)) return digits;
  return null;
}

/** Retorna os dígitos nacionais durante a digitação, removendo DDI 55 quando foi colado junto. */
export function brazilPhoneInputDigits(value: string): string {
  let digits = onlyDigits(value);
  if (/^(?:\+55|0055)/.test(value.trim()) || (digits.startsWith("55") && digits.length > 11)) {
    digits = digits.replace(/^(?:0055|55)/, "");
  } else if (digits.startsWith("0") && (digits.length === 11 || digits.length === 12)) {
    digits = digits.replace(/^0+/, "");
  }
  if (digits.length === 10) {
    digits = normalizeBrazilNationalPhone(digits) ?? digits;
  }
  return digits.slice(0, 11);
}

function allSame(digits: string): boolean {
  return /^(\d)\1+$/.test(digits);
}

export function isValidCpf(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 11 || allSame(d)) return false;
  for (const len of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const check = ((sum * 10) % 11) % 10;
    if (check !== Number(d[len])) return false;
  }
  return true;
}

export function isValidCnpj(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 14 || allSame(d)) return false;
  const calc = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, w, i) => acc + Number(d[i]) * w, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

export function isValidCpfOrCnpj(value: string): boolean {
  return isValidCpf(value) || isValidCnpj(value);
}

/** IMEI: 15 dígitos com dígito verificador (Luhn). */
export function isValidImei(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 15) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let n = Number(d[14 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

export function isValidCep(value: string): boolean {
  return onlyDigits(value).length === 8;
}
