/** light-mode resolutions of the locked palette. */
const C = {
  /** --primary — buttons and links. */
  primary: '#19398d',
  /** --live — reserved for genuinely time-critical or confirmed states. */
  live: '#007b67',
  /** --secondary, near-black — the wordmark. */
  ink: '#0a0a0a',
  /** --foreground — body copy. */
  body: '#1a1a1a',
  /** --muted-foreground — secondary copy. Measures 9.59:1 on white. */
  muted: '#454545',
  /** --background, lavender-tinted — the wash behind the card. */
  ground: '#f3f5fb',
  /** --card. */
  card: '#ffffff',
  /** --border. */
  line: '#e3e3e3',
  /** --destructive. */
  danger: '#9b0033',
};

/**
 * system stack. Arial and Helvetica are the reliable floor; the rest upgrade
 * where the client allows it.
 */
const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Helvetica, Arial, sans-serif";

const escapeHtml = (value = '') =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

/**
 * a button that survives outlook.
 *
 * an <a> with padding collapses there, so the padding lives on a table cell
 * and the anchor fills it.
 */
function button(label, url, background = C.primary) {
  return `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0;">
                <tr>
                  <td align="center" bgcolor="${background}" style="border-radius:6px;">
                    <a href="${url}"
                       style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:600;line-height:20px;color:#ffffff;text-decoration:none;border-radius:6px;">
                      ${escapeHtml(label)}
                    </a>
                  </td>
                </tr>
              </table>`;
}

/** one paragraph of body copy. */
const paragraph = (text, color = C.body) =>
  `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:24px;color:${color};">${text}</p>`;

/**
 * a quiet labelled panel — booth number, expo name, a reviewer's note.
 * bordered rather than filled, so it reads as detail and not as a warning.
 */
const panel = (rows) => `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="margin:0 0 20px;border:1px solid ${C.line};border-radius:6px;">
                ${rows
                  .map(
                    ({ label, value }, i) => `
                <tr>
                  <td style="padding:12px 16px;${i > 0 ? `border-top:1px solid ${C.line};` : ''}font-family:${FONT};font-size:13px;line-height:18px;color:${C.muted};" width="40%">${escapeHtml(label)}</td>
                  <td style="padding:12px 16px;${i > 0 ? `border-top:1px solid ${C.line};` : ''}font-family:${FONT};font-size:15px;line-height:20px;color:${C.body};font-weight:600;">${escapeHtml(value)}</td>
                </tr>`
                  )
                  .join('')}
              </table>`;

/**
 * assemble one email.
 *
 * @param {object}  o
 * @param {string}  o.heading    the one thing this message says.
 * @param {string}  o.bodyHtml   pre-escaped body, built with the helpers above.
 * @param {string} [o.ctaLabel]
 * @param {string} [o.ctaUrl]
 * @param {string} [o.ctaColor]  defaults to --primary; --live for confirmations.
 * @param {string} [o.footnote]  small print under the body.
 * @param {string}  o.clientUrl  base URL, for the preferences link.
 * @param {string} [o.preheader] inbox preview text. Hidden in the body.
 * @param {string} [o.footerHtml] replaces the default footer. the deletion
 *   notice uses this: offering "manage your preferences" to an account that no
 *   longer exists is a dead link on the one message that must not look careless.
 */
function render({ heading, bodyHtml, ctaLabel, ctaUrl, ctaColor, footnote, clientUrl, preheader, footerHtml }) {
  const prefsUrl = `${clientUrl}/settings/privacy`;
  const footer =
    footerHtml ||
    `Sent by EventSphere because an account uses this address.
                <a href="${prefsUrl}" style="color:${C.muted};text-decoration:underline;">Manage email preferences</a>.`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <title>${escapeHtml(heading)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${C.ground};">
    ${
      preheader
        ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>`
        : ''
    }
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background-color:${C.ground};padding:40px 16px;">
      <tr>
        <td align="center">

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="max-width:520px;background-color:${C.card};border:1px solid ${C.line};border-radius:8px;">

            <!-- Wordmark. One mark, no coloured banner: a full-bleed brand bar
                 is what makes transactional mail read as marketing. -->
            <tr>
              <td style="padding:28px 32px 0;">
                <span style="font-family:${FONT};font-size:17px;font-weight:700;letter-spacing:-0.2px;color:${C.ink};">Event<span style="color:${C.primary};">Sphere</span></span>
              </td>
            </tr>

            <tr>
              <td style="padding:20px 32px 32px;">
                <h1 style="margin:0 0 14px;font-family:${FONT};font-size:21px;line-height:28px;font-weight:600;color:${C.body};">${escapeHtml(heading)}</h1>
                ${bodyHtml}
                ${ctaUrl ? button(ctaLabel || 'Continue', ctaUrl, ctaColor || C.primary) : ''}
                ${
                  ctaUrl
                    ? `<p style="margin:0 0 4px;font-family:${FONT};font-size:11px;line-height:17px;color:${C.muted};">If the button does not work, paste this into your browser:</p>
                       <p style="margin:0;font-family:${FONT};font-size:11px;line-height:17px;color:${C.muted};word-break:break-all;">${ctaUrl}</p>`
                    : ''
                }
                ${
                  footnote
                    ? `<p style="margin:24px 0 0;padding-top:20px;border-top:1px solid ${C.line};font-family:${FONT};font-size:13px;line-height:20px;color:${C.muted};">${escapeHtml(footnote)}</p>`
                    : ''
                }
              </td>
            </tr>
          </table>

          <!-- Footer sits outside the card: it is about the mail, not the message. -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
            <tr>
              <td style="padding:20px 32px;font-family:${FONT};font-size:12px;line-height:18px;color:${C.muted};">
                ${footer}
              </td>
            </tr>
          </table>

        </td>
      </tr>
    </table>
  </body>
</html>`;
}

module.exports = { render, button, paragraph, panel, escapeHtml, COLORS: C, FONT };
