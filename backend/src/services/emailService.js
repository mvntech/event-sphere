const nodemailer = require('nodemailer');
const env = require('../config/env');
const logger = require('../utils/logger');
const tpl = require('./emailTemplate');

/** join body fragments, dropping the ones a given message does not use. */
/** join plain-text lines, dropping only the ones a given message omits.
 *  an empty string is a deliberate blank line, so it must survive the filter. */
const lines = (parts) => parts.filter((p) => p !== null && p !== undefined).join(String.fromCharCode(10));

let transporterPromise = null;

/**
 * real SMTP when configured; otherwise a throwaway ethereal inbox so local
 * development still produces a viewable message instead of a silent no-op.
 */
async function getTransporter() {
  if (transporterPromise) return transporterPromise;

  transporterPromise = (async () => {
    if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
      return {
        transport: nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT || 587,
          secure: env.SMTP_SECURE,
          auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
        }),
        ethereal: false,
      };
    }

    logger.warn('SMTP is not configured — falling back to an Ethereal test inbox. Set SMTP_* in backend/.env to send real email.');
    const account = await nodemailer.createTestAccount();
    return {
      transport: nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: { user: account.user, pass: account.pass },
      }),
      ethereal: true,
    };
  })();

  return transporterPromise;
}

const escapeHtml = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** shared shell for every EventSphere email — per-event templates fill the body. */
function baseTemplate({ heading, intro, bodyHtml = '', ctaLabel, ctaUrl, footnote }) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f5f6f4;font-family:Inter,-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1c2128;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr><td style="background:#2b3444;padding:20px 32px;">
            <span style="font-size:18px;font-weight:700;color:#ffffff;">Event<span style="color:#cdf94a;">Sphere</span></span>
          </td></tr>
          <tr><td style="padding:32px;">
            <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;">${escapeHtml(heading)}</h1>
            <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4a5261;">${escapeHtml(intro)}</p>
            ${bodyHtml}
            ${
              ctaUrl
                ? `<p style="margin:24px 0;"><a href="${ctaUrl}" style="display:inline-block;background:#cdf94a;color:#1c2128;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:12px;">${escapeHtml(ctaLabel || 'Continue')}</a></p>
                   <p style="margin:0 0 8px;font-size:12px;color:#7a8394;">If the button doesn't work, paste this link into your browser:</p>
                   <p style="margin:0;font-size:12px;word-break:break-all;color:#4a5261;">${ctaUrl}</p>`
                : ''
            }
            ${footnote ? `<p style="margin:24px 0 0;font-size:13px;color:#7a8394;">${escapeHtml(footnote)}</p>` : ''}
          </td></tr>
          <tr><td style="padding:16px 32px;background:#f5f6f4;font-size:12px;color:#7a8394;">
            You're receiving this because an EventSphere account uses this address.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

async function sendMail({ to, subject, html, text }) {
  const { transport, ethereal } = await getTransporter();
  const info = await transport.sendMail({ from: env.EMAIL_FROM, to, subject, html, text });

  const preview = ethereal ? nodemailer.getTestMessageUrl(info) : null;
  logger.info('Email sent', { to, subject, messageId: info.messageId, ...(preview ? { preview } : {}) });
  if (preview) logger.info(`Preview this email at: ${preview}`);

  return { messageId: info.messageId, previewUrl: preview };
}

/** trigger: user requested a password reset. */
async function sendPasswordResetEmail({ to, name, token }) {
  const url = `${env.CLIENT_URL}/reset-password?token=${encodeURIComponent(token)}`;
  const who = tpl.escapeHtml(name || 'there');

  return sendMail({
    to,
    subject: 'Reset your EventSphere password',
    html: tpl.render({
      clientUrl: env.CLIENT_URL,
      // shown beside the subject in most inboxes. without one, clients pull the
      // first words of the body, which here would just be the greeting.
      preheader: 'The link is valid for 30 minutes and can be used once.',
      heading: 'Reset your password',
      bodyHtml:
        tpl.paragraph(`Hi ${who},`) +
        tpl.paragraph(
          'Someone asked to reset the password on the EventSphere account using this address. ' +
            'Choose a new one with the button below.'
        ) +
        tpl.paragraph(
          'The link is valid for <strong>30 minutes</strong> and can only be used once.',
          tpl.COLORS.muted
        ),
      ctaLabel: 'Reset my password',
      ctaUrl: url,
      footnote:
        'If you did not ask for this, you can ignore this email — your password stays as it is, ' +
        'and nobody can change it without this link.',
    }),
    text: [
      `Hi ${name || 'there'},`,
      '',
      'Someone asked to reset the password on the EventSphere account using this address.',
      'Choose a new one here (valid 30 minutes, single use):',
      url,
      '',
      'If you did not ask for this, ignore this email — your password stays as it is.',
      '',
      `Manage email preferences: ${env.CLIENT_URL}/settings/privacy`,
    ].join('\n'),
  });
}

/** trigger: password was successfully changed — a security heads-up, not a reset. */
async function sendPasswordChangedEmail({ to, name }) {
  const who = tpl.escapeHtml(name || 'there');

  return sendMail({
    to,
    subject: 'Your EventSphere password was changed',
    html: tpl.render({
      clientUrl: env.CLIENT_URL,
      preheader: 'All other sessions were signed out.',
      heading: 'Your password was changed',
      bodyHtml:
        tpl.paragraph(`Hi ${who},`) +
        tpl.paragraph(
          'The password on your EventSphere account has just been changed, and every other ' +
            'signed-in session was ended.'
        ),
      ctaLabel: 'Sign in',
      ctaUrl: `${env.CLIENT_URL}/login`,
      footnote:
        'If this was not you, reset your password now — whoever changed it has been signed out, ' +
        'so a reset takes the account back.',
    }),
    text: lines([
      `Hi ${name || 'there'},`,
      '',
      'The password on your EventSphere account has just been changed, and every other signed-in session was ended.',
      '',
      `Sign in: ${env.CLIENT_URL}/login`,
      '',
      'If this was not you, reset your password now.',
    ]),
  });
}

/** trigger: an organizer approved or rejected an exhibitor application. */
async function sendExhibitorDecisionEmail({ to, name, companyName, expoTitle, approved, note }) {
  const who = tpl.escapeHtml(name || 'there');
  const forExpo = expoTitle ? ` for ${expoTitle}` : '';

  const details = tpl.panel(
    [
      { label: 'Company', value: companyName },
      expoTitle ? { label: 'Expo', value: expoTitle } : null,
      { label: 'Decision', value: approved ? 'Approved' : 'Not approved' },
    ].filter(Boolean)
  );

  // sentence case, not a tracked-out cap label. the old template used
  // "NOTE FROM THE ORGANIZERS" — which had survived here because the email layer was never part of that sweep.
  const noteHtml = note
    ? tpl.paragraph('Note from the organizers', tpl.COLORS.muted) +
      `<p style="margin:0 0 20px;padding-left:14px;border-left:2px solid ${tpl.COLORS.line};font-family:${tpl.FONT};font-size:15px;line-height:24px;color:${tpl.COLORS.body};">${tpl.escapeHtml(note)}</p>`
    : '';

  return sendMail({
    to,
    subject: approved
      ? `${companyName} is confirmed${forExpo}`
      : `An update on your ${companyName} application${forExpo}`,
    html: tpl.render({
      clientUrl: env.CLIENT_URL,
      preheader: approved
        ? 'You can reserve a stand once the floor plan is published.'
        : 'The organizers were not able to approve this application.',
      heading: approved ? 'Your application was approved' : 'An update on your application',
      bodyHtml:
        tpl.paragraph(`Hi ${who},`) +
        tpl.paragraph(
          approved
            ? `${tpl.escapeHtml(companyName)} is confirmed${tpl.escapeHtml(forExpo)}. You can finish your stand details now, and reserve a spot on the floor plan once the organizers publish it.`
            : `Thank you for applying with ${tpl.escapeHtml(companyName)}${tpl.escapeHtml(forExpo)}. The organizers were not able to approve this application.`
        ) +
        details +
        noteHtml,
      // --live rather than --primary: this is a confirmation of something that
      // has happened, not a call to action. a refusal keeps the neutral primary.
      ctaColor: approved ? tpl.COLORS.live : tpl.COLORS.primary,
      ctaLabel: approved ? 'Finish your stand details' : 'Review your application',
      ctaUrl: `${env.CLIENT_URL}/exhibitor/profile`,
      footnote: approved
        ? 'Booth reservation opens once the organizers publish the expo.'
        : 'You are welcome to update your details and apply to other expos.',
    }),
    text: lines([
      `Hi ${name || 'there'},`,
      '',
      approved
        ? `${companyName} is confirmed${forExpo}.`
        : `Your application for ${companyName}${forExpo} was not approved.`,
      note ? `` : null,
      note ? `Note from the organizers: ${note}` : null,
      '',
      `${env.CLIENT_URL}/exhibitor/profile`,
    ]),
  });
}

/** trigger: an existing organizer approved or rejected a new organizer. */
async function sendOrganizerDecisionEmail({ to, name, approved, note }) {
  const who = tpl.escapeHtml(name || 'there');

  const noteHtml = note
    ? tpl.paragraph('Note from the reviewer', tpl.COLORS.muted) +
      `<p style="margin:0 0 20px;padding-left:14px;border-left:2px solid ${tpl.COLORS.line};font-family:${tpl.FONT};font-size:15px;line-height:24px;color:${tpl.COLORS.body};">${tpl.escapeHtml(note)}</p>`
    : '';

  return sendMail({
    to,
    subject: approved ? 'Your organizer account is active' : 'An update on your organizer account',
    html: tpl.render({
      clientUrl: env.CLIENT_URL,
      preheader: approved
        ? 'You can sign in and start setting up expos.'
        : 'The request was not approved on this occasion.',
      heading: approved ? 'Your organizer account is active' : 'An update on your organizer account',
      bodyHtml:
        tpl.paragraph(`Hi ${who},`) +
        tpl.paragraph(
          approved
            ? 'An existing organizer has approved your account. You can sign in now and start setting up expos, floor plans and schedules.'
            : 'Thank you for requesting an organizer account. It has not been approved on this occasion.'
        ) +
        noteHtml,
      ctaColor: approved ? tpl.COLORS.live : tpl.COLORS.primary,
      ctaLabel: approved ? 'Sign in' : 'Back to EventSphere',
      ctaUrl: approved ? `${env.CLIENT_URL}/login` : env.CLIENT_URL,
      footnote: approved
        ? 'An organizer account can approve exhibitors and other organizers, so keep your credentials to yourself.'
        : `If you think this is a mistake, tell us at ${env.CLIENT_URL}/contact and the event team will take another look.`,
    }),
    text: lines([
      `Hi ${name || 'there'},`,
      '',
      approved
        ? 'An existing organizer has approved your account. You can sign in now.'
        : 'Your organizer account request was not approved on this occasion.',
      note ? `` : null,
      note ? `Note from the reviewer: ${note}` : null,
      '',
      approved ? `${env.CLIENT_URL}/login` : env.CLIENT_URL,
    ]),
  });
}

/**
 * trigger: an exhibitor reserved a booth, or an organizer assigned them one.
 *
 * sent on both paths because they mean the same thing to the recipient: the
 * stand is theirs. Which of the two happened is not information they need.
 */
async function sendBoothConfirmationEmail({ to, name, boothLabel, expoTitle, size, assignedBy }) {
  const who = tpl.escapeHtml(name || 'there');

  const details = tpl.panel(
    [
      { label: 'Stand', value: boothLabel },
      expoTitle ? { label: 'Expo', value: expoTitle } : null,
      size ? { label: 'Size', value: size } : null,
    ].filter(Boolean)
  );

  return sendMail({
    to,
    subject: `Stand ${boothLabel} is yours${expoTitle ? ` at ${expoTitle}` : ''}`,
    html: tpl.render({
      clientUrl: env.CLIENT_URL,
      preheader: `Stand ${boothLabel} is confirmed. You can change your details any time.`,
      heading: `Stand ${boothLabel} is yours`,
      bodyHtml:
        tpl.paragraph(`Hi ${who},`) +
        tpl.paragraph(
          assignedBy
            ? `The organizers have assigned you stand <strong>${tpl.escapeHtml(boothLabel)}</strong>${expoTitle ? ` at ${tpl.escapeHtml(expoTitle)}` : ''}.`
            : `Your reservation for stand <strong>${tpl.escapeHtml(boothLabel)}</strong>${expoTitle ? ` at ${tpl.escapeHtml(expoTitle)}` : ''} is confirmed.`
        ) +
        details +
        tpl.paragraph(
          'Attendees can see your company on the floor plan from now on, so it is worth checking ' +
            'that your products and stand staff are up to date.',
          tpl.COLORS.muted
        ),
      // a confirmation, so --live rather than --primary.
      ctaColor: tpl.COLORS.live,
      ctaLabel: 'View your stand',
      ctaUrl: `${env.CLIENT_URL}/exhibitor/booth`,
      footnote: assignedBy
        ? 'If this stand does not work for you, message the organizers rather than releasing it — they placed you here deliberately.'
        : 'If you need a different stand, release this one from the floor plan and pick another.',
    }),
    text: lines([
      `Hi ${name || 'there'},`,
      '',
      assignedBy
        ? `The organizers have assigned you stand ${boothLabel}${expoTitle ? ` at ${expoTitle}` : ''}.`
        : `Your reservation for stand ${boothLabel}${expoTitle ? ` at ${expoTitle}` : ''} is confirmed.`,
      '',
      `View your stand: ${env.CLIENT_URL}/exhibitor/booth`,
      '',
      assignedBy
        ? 'If this stand does not work for you, message the organizers rather than releasing it.'
        : 'If you need a different stand, release this one from the floor plan and pick another.',
    ]),
  });
}

/**
 * trigger: the account holder deleted their own account.
 *
 * the paper trail matters more here than anywhere else: if somebody else
 * deleted the account, silence is how the owner finds out too late.
 *
 * IMPORTANT — the caller must capture the address and send this BEFORE
 * anonymisation runs. anonymisation replaces the email with a non-routable
 * tombstone, so a send afterwards goes nowhere and fails silently.
 */
async function sendAccountDeletedEmail({ to, name, purgeAfter }) {
  const who = tpl.escapeHtml(name || 'there');
  const purgeDate = new Date(purgeAfter).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return sendMail({
    to,
    subject: 'Your EventSphere account has been deleted',
    html: tpl.render({
      clientUrl: env.CLIENT_URL,
      preheader: `The remaining record is erased on ${purgeDate}.`,
      heading: 'Your account has been deleted',
      bodyHtml:
        tpl.paragraph(`Hi ${who},`) +
        tpl.paragraph(
          'Your EventSphere account has been deleted at your request. Your name, email address ' +
            'and picture have already been removed, and you have been signed out everywhere.'
        ) +
        tpl.panel([
          { label: 'Deleted', value: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) },
          { label: 'Record erased', value: purgeDate },
        ]) +
        tpl.paragraph(
          'Anything other people can still see — a message thread you were part of, feedback an ' +
            'organizer is working through — remains, without your name attached to it.',
          tpl.COLORS.muted
        ),
      /*
       * Not "reply to this email": EMAIL_FROM is a no-reply address, and this is
       * the one message where a person may genuinely need to raise an alarm —
       * if somebody else deleted their account, this is how they find out.
       */
      footnote:
        'If you did not ask for this, tell us straight away at ' +
        `${env.CLIENT_URL}/contact. This is the last message we will send to this address.`,
      // No preferences link: the account it would manage no longer exists.
      footerHtml: 'Sent by EventSphere to confirm a deletion requested for this address.',
    }),
    text: lines([
      `Hi ${name || 'there'},`,
      '',
      'Your EventSphere account has been deleted at your request. Your name, email address and picture have already been removed, and you have been signed out everywhere.',
      '',
      `The remaining record is erased on ${purgeDate}.`,
      '',
      'Anything other people can still see remains, without your name attached to it.',
      '',
      `If you did not ask for this, tell us straight away at ${env.CLIENT_URL}/contact. This is the last message we will send to this address.`,
    ]),
  });
}

module.exports = {
  sendMail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendExhibitorDecisionEmail,
  sendOrganizerDecisionEmail,
  sendBoothConfirmationEmail,
  sendAccountDeletedEmail,
};
