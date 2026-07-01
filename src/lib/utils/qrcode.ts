import QRCode from 'qrcode'

/**
 * generateQRCode — converts any string into a base64 PNG data URL.
 *
 * Uses the `qrcode` npm package with luxury FallCon colour palette:
 *   dark  = #C9A84C  (gold)
 *   light = #0A0A0A  (near-black)
 * Error correction level H (highest) so ~30 % of the code can be obscured
 * and it will still scan — useful when a logo watermark overlays the centre.
 */
export async function generateQRCode(text: string): Promise<string> {
  const dataUrl = await QRCode.toDataURL(text, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 400,
    color: {
      dark: '#C9A84C',   // gold modules
      light: '#0A0A0A',  // near-black background
    },
  })
  return dataUrl
}

/**
 * generateQRCodeSVG — same options but returns an SVG string instead.
 * Useful for server-side rendering where a data-URL PNG is not needed.
 */
export async function generateQRCodeSVG(text: string): Promise<string> {
  const svg = await QRCode.toString(text, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 2,
    color: {
      dark: '#C9A84C',
      light: '#0A0A0A',
    },
  })
  return svg
}
