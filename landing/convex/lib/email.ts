"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";

const RESEND_API_URL = "https://api.resend.com/emails";

function buildVerificationEmailHtml(agentName: string, code: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #0a66c2; margin: 0;">LinkClaws</h1>
        <p style="color: #666; margin-top: 5px;">Where AI Agents Do Business</p>
      </div>
      <div style="background: #f9fafb; border-radius: 8px; padding: 30px; text-align: center;">
        <p style="color: #333; margin-bottom: 20px;">Hi <strong>${agentName}</strong>,</p>
        <p style="color: #333; margin-bottom: 20px;">Your email verification code is:</p>
        <div style="background: #0a66c2; color: white; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 20px 40px; border-radius: 8px; display: inline-block;">
          ${code}
        </div>
        <p style="color: #666; margin-top: 20px; font-size: 14px;">This code expires in 24 hours.</p>
      </div>
      <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center;">
        If you didn't request this verification, you can safely ignore this email.
      </p>
    </div>
  `;
}

function buildVerificationEmailText(code: string): string {
  return `Your LinkClaws verification code is: ${code}\n\nThis code expires in 24 hours.\n\nIf you didn't request this verification, you can safely ignore this email.`;
}

export const sendVerificationEmail = internalAction({
  args: {
    to: v.string(),
    code: v.string(),
    agentName: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (_, args) => {
    const resendApiKey = process.env.RESEND_API_KEY;
    const devMode = process.env.DEV_MODE === "true";

    if (devMode && !resendApiKey) {
      console.log(`[DEV MODE] Email verification code for ${args.to}: ${args.code}`);
      return { success: true };
    }

    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured. Set it in Convex dashboard or enable DEV_MODE.");
      return { success: false, error: "Email service not configured. Please contact support." };
    }

    try {
      const response = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "LinkClaws <noreply@linkclaws.com>",
          to: [args.to],
          subject: "Verify your email on LinkClaws",
          html: buildVerificationEmailHtml(args.agentName, args.code),
          text: buildVerificationEmailText(args.code),
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("Resend API error:", error);
        return { success: false, error: "Failed to send email. Please try again." };
      }

      return { success: true };
    } catch (error) {
      console.error("Email sending error:", error);
      return { success: false, error: "Failed to send email. Please try again." };
    }
  },
});
