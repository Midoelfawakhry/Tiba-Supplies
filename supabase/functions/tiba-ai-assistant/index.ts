import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type HistoryMessage = { role: "user" | "assistant"; content: string };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: "SERVER_CONFIGURATION_MISSING" }, 500);
    }
    if (!geminiApiKey) return json({ error: "AI_NOT_CONFIGURED" }, 503);

    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "AUTH_REQUIRED" }, 401);
    const token = authorization.slice("Bearer ".length);
    const callerClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authorization } },
    });
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: authData, error: authError } = await callerClient.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "AUTH_REQUIRED" }, 401);

    const { data: profile, error: profileError } = await admin.from("app_users")
      .select("user_id,is_active,office_id").eq("auth_user_id", authData.user.id).eq("is_active", true).maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return json({ error: "ACTIVE_APP_PROFILE_REQUIRED" }, 403);

    const { data: roleLinks, error: rolesError } = await admin.from("user_roles")
      .select("roles!inner(name)").eq("user_id", profile.user_id);
    if (rolesError) throw rolesError;
    const roles = (roleLinks ?? []).map((item: any) => item.roles?.name).filter(Boolean);
    const body = await req.json();
    const audience = body?.audience;
    if (audience === "HEAD_OFFICE" && !roles.some((role: string) => ["ADMIN", "HEAD_OFFICE"].includes(role))) {
      return json({ error: "INSUFFICIENT_ROLE" }, 403);
    }
    if (audience === "BRANCH" && !roles.includes("BRANCH")) {
      return json({ error: "INSUFFICIENT_ROLE" }, 403);
    }
    if (audience === "BRANCH") {
      const { data: branchOffice, error: branchOfficeError } = await admin.from("offices")
        .select("office_id").eq("office_id", profile.office_id)
        .eq("office_type", "BRANCH").eq("is_active", true).maybeSingle();
      if (branchOfficeError) throw branchOfficeError;
      if (!branchOffice) return json({ error: "BRANCH_OFFICE_REQUIRED" }, 403);
    }
    if (!["HEAD_OFFICE", "BRANCH"].includes(audience)) return json({ error: "INVALID_AUDIENCE" }, 400);

    const question = typeof body?.question === "string" ? body.question.trim() : "";
    if (!question || question.length > 1200) return json({ error: "QUESTION_INVALID" }, 400);

    const contextText = JSON.stringify(body?.context ?? {});
    if (contextText.length > 12000) return json({ error: "CONTEXT_TOO_LARGE" }, 413);
    const history: HistoryMessage[] = Array.isArray(body?.history)
      ? body.history.slice(-8).filter((item: any) =>
          item && ["user", "assistant"].includes(item.role) &&
          typeof item.content === "string" && item.content.length <= 1200
        ).map((item: any) => ({ role: item.role, content: item.content }))
      : [];

    const egyptianArabicStyle = [
      "اللغة واللهجة إلزاميتان في كل الرد: استخدم العامية المصرية الطبيعية التي يتكلم بها موظفو المكاتب في مصر. ممنوع أن يكون الرد بالفصحى أو باللهجة الخليجية، حتى لو كان السؤال أو سياق البيانات مكتوبًا بالفصحى.",
      "اكتب كأنك بتتكلم مع زميل في الشغل: جمل قصيرة وواضحة، مثل: عندنا، مفيش، لسه، محتاجين، خلينا، إيه، تمام، بص. استخدمها طبيعيًا من غير مبالغة.",
      "تجنب التراكيب الرسمية مثل: بناءً على البيانات المتاحة، وبالتالي، غير متوفرة، يرجى، ينبغي، يتعين، نود الإشارة، هل تحتاج إلى مزيد من التفاصيل. استخدم بدلها: حسب البيانات اللي عندي، عشان كده، مش موجودة عندي، لو محتاج تفاصيل تانية قولي.",
      "مثال للأسلوب المطلوب: بدل «الاتصال يعمل بنجاح والبيانات متاحة. لا توجد أوامر تحميل مسجلة حاليًا» قل «الاتصال شغال والبيانات وصلت. بس مفيش أوامر تحميل مسجلة دلوقتي».",
      "مثال آخر: بدل «المعلومة بخصوص المركبات الاثنتي عشرة غير متوفرة في بيانات التشغيل الحالية» قل «حكاية الـ١٢ عربية مش ظاهرة في بيانات التشغيل اللي عندي، فمش هقدر أحدد مين وصل ومين لسه».",
      "حافظ بدقة على الأرقام والأسماء والأكواد وحالات التحميل كما هي في السياق. لا تخترع بيانات، ولا تعتبر أي رقم ذكره المستخدم حقيقة تشغيلية إلا لو السياق يؤكده.",
      "لو احتجت تعرض نقاطًا أو أرقامًا، اكتب الشرح المحيط بها بالمصري، وخلي أسماء الحقول التقنية فقط كما هي عند الحاجة. لا تبدأ بمقدمة رسمية ولا تختم بجملة خدمة عملاء رسمية.",
    ].join("\\n");

    const systemInstruction = audience === "BRANCH"
      ? "أنت مساعد نظام Tiba-Supplies لموظف فرع رأس سدر. " + egyptianArabicStyle + " دور الفرع متابعة وقراءة فقط؛ لا تقترح تنفيذ تعديلات أو إسناد أو إلغاء من حساب الفرع. اعتمد فقط على سياق البيانات المرفق، ووضح بالمصري لما معلومة تكون مش موجودة. لا تخترع أرقامًا أو أسماء أو حالات، ولا تطلب كلمات مرور أو بيانات اعتماد. أنت مساعد للشرح والتلخيص فقط ولا تنفذ أي إجراء."
      : "أنت مساعد نظام Tiba-Supplies للمكتب الرئيسي. " + egyptianArabicStyle + " اعتمد فقط على سياق البيانات المرفق، ووضح بالمصري لما معلومة تكون مش موجودة. لا تخترع أرقامًا أو أسماء أو حالات. لا تدّع أنك نفذت إجراءً؛ أنت مساعد للشرح والتلخيص فقط ولا تنفذ أوامر تشغيلية.";

    const contents = [
      ...history.map((item) => ({
        role: item.role === "assistant" ? "model" : "user",
        parts: [{ text: item.content }],
      })),
      {
        role: "user",
        parts: [{
          text: "سياق التشغيل المتاح (JSON للقراءة فقط):\n" + contextText +
            "\n\nسؤال المستخدم الحالي:\n" + question,
        }],
      },
    ];

    let result: any = null;
    let lastProviderError = "";
    const models = ["gemini-2.5-flash", "gemini-2.0-flash"];

    for (const model of models) {
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + encodeURIComponent(geminiApiKey),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents,
            generationConfig: { maxOutputTokens: 900, temperature: 0.3 },
          }),
        },
      );

      if (response.ok) {
        result = await response.json();
        break;
      }

      const providerError = await response.text();
      lastProviderError = providerError;
      console.error("Gemini request failed", {
        model,
        status: response.status,
        details: providerError.slice(0, 500),
      });

      // Try the compatible fallback when a model is unavailable or temporarily overloaded.
      if ([404, 429, 500, 503].includes(response.status) && model !== models[models.length - 1]) {
        continue;
      }
      if (response.status === 429) return json({ error: "AI_RATE_LIMITED" }, 429);
      if (response.status === 404) return json({ error: "AI_MODEL_UNAVAILABLE" }, 502);
      if (response.status === 503) return json({ error: "AI_TEMPORARILY_UNAVAILABLE" }, 503);
      return json({ error: "AI_PROVIDER_ERROR" }, 502);
    }

    if (!result) {
      console.error("All Gemini models unavailable", { details: lastProviderError.slice(0, 500) });
      return json({ error: "AI_TEMPORARILY_UNAVAILABLE" }, 503);
    }
    const answer = result?.candidates?.[0]?.content?.parts
      ?.map((part: any) => typeof part.text === "string" ? part.text : "")
      .join("")
      .trim();
    if (!answer) return json({ error: "AI_EMPTY_RESPONSE" }, 502);
    return json({ answer });
  } catch (error) {
    console.error("tiba-ai-assistant failed", error);
    return json({ error: "INTERNAL_ERROR" }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
