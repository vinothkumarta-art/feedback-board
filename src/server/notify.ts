import { GatewayRefusalError, sendEmail } from "@every-app/sdk/server";

interface StatusNotice {
  title: string;
  statusLabel: string;
  recipients: { email: string; token: string }[];
}

/**
 * Emails each subscriber the new status, with their own unsubscribe link.
 * Optional: when the Gateway has no email set up, nothing is sent.
 */
export async function sendStatusEmails(env: object, origin: string, notice: StatusNotice) {
  for (const recipient of notice.recipients) {
    const unsubscribe = `${origin}/p/unsubscribe/${recipient.token}`;
    try {
      await sendEmail({
        env,
        message: {
          to: recipient.email,
          subject: `${notice.title}: now ${notice.statusLabel}`,
          text: `"${notice.title}" is now ${notice.statusLabel}.\n\nStop emails about this request: ${unsubscribe}\n`,
        },
      });
    } catch (error) {
      // A refusal (mail not set up, budget spent) skips this recipient.
      if (!(error instanceof GatewayRefusalError)) console.error("status email failed", error);
    }
  }
}
