import QRCode from 'qrcode';

export function buildBinderUrl(location) {
  return `${window.location.origin}${import.meta.env.BASE_URL}?binder=${encodeURIComponent(location)}`;
}

export async function generateQrDataUrl(text) {
  return QRCode.toDataURL(text, { width: 320, margin: 2 });
}
