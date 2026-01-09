import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-signature, x-webhook-timestamp",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get("x-webhook-signature");
    const timestamp = req.headers.get("x-webhook-timestamp");
    const body = await req.text();

    console.log("📬 Notificador recibió webhook");

    if (!signature || !timestamp) {
      return new Response(
        JSON.stringify({ error: "Missing signature or timestamp" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validar timestamp (anti-replay)
    const timestampValidation = validateTimestamp(timestamp);
    if (!timestampValidation.valid) {
      console.log("⏰ Timestamp inválido:", timestampValidation.reason);
      return new Response(
        JSON.stringify({ error: timestampValidation.reason }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validar firma HMAC
    const secret = Deno.env.get("WEBHOOK_SECRET")!;
    const isValid = await validateSignature(body, signature, secret);

    if (!isValid) {
      console.log("🔒 Firma inválida en notificador");
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("✅ Firma validada correctamente");

    const payload = JSON.parse(body);

    // Conectar a Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar idempotencia
    const { data: existing } = await supabase
      .from("notification_logs")
      .select("id, status")
      .eq("idempotency_key", payload.idempotency_key)
      .maybeSingle();

    if (existing) {
      console.log("🔄 Notificación duplicada, ignorando");
      return new Response(
        JSON.stringify({
          duplicate: true,
          message: "Already notified",
          status: existing.status,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Enviar notificación a Telegram
    const telegramToken = Deno.env.get("TELEGRAM_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_CHAT_ID");

    if (!telegramToken || !chatId) {
      throw new Error("Telegram credentials not configured");
    }

    const message = formatMessage(payload);

    console.log("📤 Enviando mensaje a Telegram...");

    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${telegramToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML",
        }),
      }
    );

    const telegramResult = await telegramResponse.json();

    if (!telegramResponse.ok) {
      console.error("❌ Error de Telegram:", telegramResult);
      
      // Registrar fallo de notificación
      await supabase.from("notification_logs").insert({
        idempotency_key: payload.idempotency_key,
        event_type: payload.event,
        channel: "telegram",
        status: "failed",
        error_message: JSON.stringify(telegramResult),
        attempted_at: new Date().toISOString(),
      });

      throw new Error(`Telegram API error: ${JSON.stringify(telegramResult)}`);
    }

    console.log("✅ Mensaje enviado a Telegram");

    // Registrar notificación exitosa
    await supabase.from("notification_logs").insert({
      idempotency_key: payload.idempotency_key,
      event_type: payload.event,
      channel: "telegram",
      status: "sent",
      telegram_message_id: telegramResult.result?.message_id,
      sent_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        notified: true,
        event_type: payload.event,
        telegram_message_id: telegramResult.result?.message_id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("💥 Error en notificador:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function formatMessage(payload: any): string {
  const eventType = payload.event;
  const data = payload.data;
  const timestamp = new Date(payload.timestamp).toLocaleString("es-EC", {
    timeZone: "America/Guayaquil",
    dateStyle: "short",
    timeStyle: "short",
  });

  if (eventType === "repair_order.created") {
    return (
      `🆕 <b>NUEVA ORDEN DE REPARACIÓN</b>\n\n` +
      `📋 <b>Orden:</b> #${data.order_id}\n` +
      `📱 <b>Equipo ID:</b> ${data.equipment_id}\n` +
      `👨‍🔧 <b>Técnico ID:</b> ${data.technician_id}\n` +
      `⚠️ <b>Problema:</b>\n${data.issue_description}\n\n` +
      `💰 <b>Costo Estimado:</b> $${data.estimated_cost ?? 'Por definir'}\n` +
      `📅 <b>Fecha:</b> ${timestamp}\n\n` +
      `<i>Estado: ${data.status}</i>`
    );
  }

  if (eventType === "repair_order.completed") {
    return (
      `✅ <b>ORDEN COMPLETADA</b>\n\n` +
      `📋 <b>Orden:</b> #${data.order_id}\n` +
      `📱 <b>Equipo ID:</b> ${data.equipment_id}\n` +
      `👨‍🔧 <b>Técnico ID:</b> ${data.technician_id}\n` +
      `📅 <b>Completado:</b> ${timestamp}\n\n` +
      `<i>Estado: ${data.status}</i>\n\n` +
      `🎉 <b>¡Reparación exitosa!</b>`
    );
  }

  // Fallback para cualquier otro evento
  return (
    `📬 *Evento:* ${eventType}\n\n` +
    `\`\`\`\n${JSON.stringify(data, null, 2)}\n\`\`\``
  );
}

async function validateSignature(
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {
  console.log("🔍 DEBUG validateSignature (notifier):", {
    secret,
    signature,
    bodyLength: body.length,
    bodyPreview: body.substring(0, 100),
  });

  // 1. Extraer hash de la firma
  const receivedHash = signature.replace("sha256=", "");

  // 2. Calcular hash esperado
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(body);

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", key, messageData);

  // 3. Convertir a hex
  const expectedHash = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  console.log("🔍 Signatures comparison (notifier):", {
    expected: `sha256=${expectedHash}`,
    received: signature,
    expectedHash,
    receivedHash,
    match: receivedHash === expectedHash,
  });

  // 4. Comparar de forma segura (timing-safe)
  return timingSafeEqual(receivedHash, expectedHash);
}

function validateTimestamp(
  timestamp: string,
  maxAgeMinutes: number = 5
): { valid: boolean; reason?: string } {
  const now = Math.floor(Date.now() / 1000);
  const requestTime = parseInt(timestamp);

  if (isNaN(requestTime)) {
    return { valid: false, reason: "Invalid timestamp format" };
  }

  const age = now - requestTime;

  // Verificar que no sea muy antiguo (anti-replay attack)
  if (age > maxAgeMinutes * 60) {
    return {
      valid: false,
      reason: `Timestamp too old (${age} seconds, max ${maxAgeMinutes * 60})`,
    };
  }

  // Verificar que no sea del futuro (clock skew)
  if (age < -60) {
    return {
      valid: false,
      reason: `Timestamp in the future (${Math.abs(age)} seconds ahead)`,
    };
  }

  return { valid: true };
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}