import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendNegotiationCompleteEmail(
  recipientEmail: string,
  negotiationGroupId: number,
  negotiationGroupName: string
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[Email] RESEND_API_KEY not set, skipping email send");
    return;
  }

  const negotiationUrl = `http://localhost:5173/negotiation/${negotiationGroupId}`;

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
      to: recipientEmail,
      subject: `Negotiation Complete: ${negotiationGroupName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Negotiation Complete</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
              <h1 style="color: #2c3e50; margin-top: 0;">Negotiation Complete</h1>
              <p style="font-size: 16px; margin-bottom: 10px;">
                Your negotiation <strong>${negotiationGroupName}</strong> has been completed.
              </p>
              <p style="font-size: 14px; color: #666;">
                All vendors have submitted their final offers. You can now review and compare the offers.
              </p>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${negotiationUrl}" 
                 style="display: inline-block; background-color: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                View Negotiation Details
              </a>
            </div>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #999;">
              <p>If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="word-break: break-all;">${negotiationUrl}</p>
            </div>
          </body>
        </html>
      `,
      text: `
Negotiation Complete

Your negotiation "${negotiationGroupName}" has been completed.

All vendors have submitted their final offers. You can now review and compare the offers.

View the negotiation details here:
${negotiationUrl}

If you have any questions, please contact support.
      `,
    });

    if (error) {
      console.error("[Email] Failed to send email:", error);
      throw error;
    }

    console.log(`[Email] Successfully sent completion email to ${recipientEmail} for negotiation group ${negotiationGroupId}`);
  } catch (error) {
    console.error("[Email] Error sending email:", error);
    throw error;
  }
}
