import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-signature, x-webhook-timestamp",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get("x-webhook-signature");
    const timestamp = req.headers.get("x-webhook-timestamp");
    const body = await req.text();

    console.log("📥 Webhook recibido:", {
      signature: signature ? "presente" : "ausente",
      timestamp: timestamp ? "presente" : "ausente",
      bodyLength: body.length,
    });

    if (!signature || !timestamp) {
      return new Response(
        JSON.stringify({ error: "Missing signature or timestamp" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validar timestamp usando la función dedicada
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
      console.log("🔒 Firma inválida");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("✅ Firma validada correctamente");

    const payload = JSON.parse(body);

    // Conectar a Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar idempotencia (deduplicación)
    const { data: existing } = await supabase
      .from("webhook_events")
      .select("id, event_id")
      .eq("idempotency_key", payload.idempotency_key)
      .single();

    if (existing) {
      console.log("🔄 Webhook duplicado detectado:", payload.idempotency_key);
      return new Response(
        JSON.stringify({
          duplicate: true,
          event_id: existing.event_id,
          message: "Event already processed (idempotency check)",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Guardar evento en la base de datos
    const { data: event, error } = await supabase
      .from("webhook_events")
      .insert({
        event_id: payload.id,
        event_type: payload.event,
        idempotency_key: payload.idempotency_key,
        payload: payload,
        metadata: payload.metadata,
        received_at: new Date().toISOString(),
        processed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("❌ Error guardando evento:", error);
      throw error;
    }

    console.log("💾 Evento guardado:", event.id);

    // Marcar como procesado (control de idempotencia)
    await supabase.from("processed_webhooks").insert({
      idempotency_key: payload.idempotency_key,
      event_id: event.id,
    });

    console.log("✅ Webhook procesado exitosamente");

    return new Response(
      JSON.stringify({
        success: true,
        event_id: event.id,
        event_type: payload.event,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("💥 Error procesando webhook:", error);
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

async function validateSignature(
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {

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
      reason: `Timestamp too old (${age} seconds, max ${maxAgeMinutes * 60})` 
    };
  }

  // Verificar que no sea del futuro (clock skew)
  if (age < -60) {
    return { 
      valid: false, 
      reason: `Timestamp in the future (${Math.abs(age)} seconds ahead)` 
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