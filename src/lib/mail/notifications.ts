import { prisma } from "@/lib/db/client";
import { getSystemMailStatus, sendSystemMail } from "@/lib/mail/system";

type NotificationMailInput = {
  notificationId: string;
  userId: string;
  subject: string;
  body: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textToHtml(value: string) {
  return escapeHtml(value)
    .split(/\r?\n/)
    .map((line) => `<p>${line || "&nbsp;"}</p>`)
    .join("");
}

export async function sendNotificationMailSafely(input: NotificationMailInput) {
  const status = getSystemMailStatus();
  if (!status.configured) return;

  try {
    const recipient = await prisma.user.findUnique({
      where: {
        id: input.userId,
      },
      select: {
        email: true,
      },
    });

    if (!recipient?.email) return;

    await sendSystemMail({
      to: recipient.email,
      subject: input.subject,
      text: input.body,
      html: textToHtml(input.body),
      purpose: "notification",
    });

    await prisma.notification.update({
      where: {
        id: input.notificationId,
      },
      data: {
        sentAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Notification mail could not be sent", error);
  }
}
