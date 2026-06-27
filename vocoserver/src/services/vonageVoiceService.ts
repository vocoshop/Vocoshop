import dotenv from "dotenv";
dotenv.config();

const VONAGE_API_KEY = process.env.VONAGE_API_KEY || "";
const VONAGE_API_SECRET = process.env.VONAGE_API_SECRET || "";
const VONAGE_VOICE_PHONE = process.env.VONAGE_VOICE_PHONE || "";

const VOICE_API_BASE = "https://api.nexmo.com/v1/calls";

function basicAuth(): string {
  return "Basic " + Buffer.from(`${VONAGE_API_KEY}:${VONAGE_API_SECRET}`).toString("base64");
}

export async function initiateProxyCall(
  callerPhone: string,
  agentPhone: string,
  answerUrl: string,
  eventUrl: string
): Promise<{ success: boolean; uuid?: string; error?: string }> {
  if (!VONAGE_API_KEY || !VONAGE_API_SECRET) {
    return { success: false, error: "Vonage non configuré" };
  }
  if (!VONAGE_VOICE_PHONE) {
    return { success: false, error: "VONAGE_VOICE_PHONE manquant" };
  }

  const payload = {
    to: [{ type: "phone", number: callerPhone.replace(/[^+\d]/g, "") }],
    from: { type: "phone", number: VONAGE_VOICE_PHONE.replace(/[^+\d]/g, "") },
    answer_url: [answerUrl],
    answer_method: "POST",
    event_url: [eventUrl],
    event_method: "POST",
    machine_detection: "hangup",
  };

  try {
    const res = await fetch(VOICE_API_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: basicAuth(),
      },
      body: JSON.stringify(payload),
    });

    const data: any = await res.json();

    if (res.ok && data.uuid) {
      console.log("✅ Vonage Voice call initiated:", data.uuid);
      return { success: true, uuid: data.uuid };
    }

    console.error("❌ Vonage Voice API error:", data);
    return { success: false, error: data.detail || data.title || "Erreur Vonage" };
  } catch (err) {
    console.error("❌ Vonage Voice exception:", err);
    return { success: false, error: "Exception Vonage" };
  }
}

export function buildAnswerNcco(agentPhone: string): any[] {
  const cleanPhone = agentPhone.replace(/[^+\d]/g, "");

  return [
    {
      action: "talk",
      text: "Vous allez être mis en relation avec votre agent voco. Patientez quelques instants.",
      voiceName: "Celine",
      language: "fr-FR",
    },
    {
      action: "connect",
      from: VONAGE_VOICE_PHONE,
      endpoint: [
        {
          type: "phone",
          number: cleanPhone,
        },
      ],
      machineDetection: "hangup",
    },
  ];
}

export function handleCallEvent(event: any): { status: string; duration: number } {
  const statusMap: Record<string, string> = {
    started: "ringing",
    ringing: "ringing",
    answered: "connected",
    completed: "completed",
    failed: "failed",
    rejected: "failed",
    timeout: "failed",
    cancelled: "failed",
    machine: "completed",
  };

  return {
    status: statusMap[event.status] || "failed",
    duration: event.duration ? Math.round(event.duration) : 0,
  };
}
