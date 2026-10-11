import React, { useMemo, useState } from 'react';
import { Bot, Send, Sparkles, LoaderCircle, AlertCircle, RotateCcw } from 'lucide-react';
import { supabase } from '../lib/supabase';

type AssistantMessage = { role: 'user' | 'assistant'; content: string };

interface SystemAiAssistantProps {
  audience: 'HEAD_OFFICE' | 'BRANCH';
  context: Record<string, unknown>;
}

const prompts = {
  HEAD_OFFICE: [
    'لخّصي موقف التشغيل الحالي.',
    'إيه أهم الحاجات اللي محتاجة متابعة؟',
    'اشرحلي أرقام أوامر التحميل والتخصيصات.',
  ],
  BRANCH: [
    'لخّصي موقف مكتب رأس سدر الحالي.',
    'إيه التحميلات المتاحة للمتابعة؟',
    'لخّصي موقف التخصيصات والتحميل الفعلي.',
  ],
};

export const SystemAiAssistant: React.FC<SystemAiAssistantProps> = ({ audience, context }) => {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const suggestedPrompts = prompts[audience];

  const safeContext = useMemo(() => JSON.parse(JSON.stringify(context)), [context]);

  async function ask(value = question) {
    const clean = value.trim();
    if (!clean || busy) return;
    if (clean.length > 1200) {
      setError('السؤال طويل. اختصره إلى 1200 حرف أو أقل.');
      return;
    }
    const next = [...messages, { role: 'user' as const, content: clean }];
    setMessages(next);
    setQuestion('');
    setBusy(true);
    setError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('tiba-ai-assistant', {
        body: {
          question: clean,
          audience,
          context: safeContext,
          history: next.slice(0, -1).slice(-8).map(message => ({ role: message.role, content: message.content })),
        },
      });
      if (invokeError) throw invokeError;
      if (typeof data?.answer !== 'string' || !data.answer.trim()) {
        throw new Error(data?.error === 'AI_NOT_CONFIGURED'
          ? 'مساعد الذكاء الاصطناعي لم يتم ربط مفتاحه الآمن على الخادم بعد.'
          : 'المساعد لم يرجع إجابة. جرّب مرة تانية.');
      }
      setMessages(current => [...current, { role: 'assistant', content: data.answer }]);
    } catch (e: any) {
      let message = e?.message || 'تعذر الاتصال بمساعد النظام. تأكد من اتصال الإنترنت وإعداد المساعد.';
      try {
        const response = e?.context?.clone?.();
        const payload = response ? await response.json() : null;
        if (payload?.error === 'AI_NOT_CONFIGURED') {
          message = 'مساعد الذكاء الاصطناعي محتاج إعداد مفتاح Gemini الآمن في Supabase قبل الاستخدام.';
        } else if (payload?.error === 'INSUFFICIENT_ROLE' || payload?.error === 'BRANCH_OFFICE_REQUIRED') {
          message = 'حسابك أو مكتبك غير مصرح له باستخدام المساعد من الواجهة دي.';
        } else if (payload?.error === 'AI_RATE_LIMITED') {
          message = 'طلبات المساعد كتير في الوقت الحالي. استنى شوية وجرّب تاني.';
        }
      } catch {
        // Keep the safe generic message if the function error body is unavailable.
      }
      setError(message);
      setMessages(current => current.filter((message, index) => !(index === current.length - 1 && message.role === 'user' && message.content === clean)));
    } finally {
      setBusy(false);
    }
  }

  return <section dir="rtl" className="overflow-hidden rounded-3xl border border-violet-200 bg-white shadow-sm">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-violet-100 bg-gradient-to-l from-violet-50 via-white to-sky-50 p-5">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-700 text-white shadow-sm"><Bot size={26}/></div>
        <div>
          <div className="flex items-center gap-2"><h2 className="text-lg font-black text-slate-900">مساعد نظام طيبة AI</h2><Sparkles size={16} className="text-violet-600"/></div>
          <p className="mt-1 text-xs text-slate-500">{audience === 'HEAD_OFFICE' ? 'مساعد المكتب الرئيسي · تحليل بيانات التشغيل المتاحة' : 'مساعد مكتب رأس سدر · متابعة وقراءة فقط'}</p>
        </div>
      </div>
      <button type="button" onClick={() => { setMessages([]); setError(''); }} disabled={busy || messages.length === 0} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-40"><RotateCcw size={14}/> محادثة جديدة</button>
    </header>

    <div className="space-y-4 p-4 sm:p-5">
      <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4 text-sm leading-6 text-sky-950">
        اسأل المساعد عن البيانات الظاهرة في واجهتك. المساعد للشرح والتلخيص فقط؛ لا ينشئ أوامر تحميل ولا يغيّر أي سجل أو صلاحية.
      </div>

      {messages.length === 0 && <div className="space-y-3">
        <p className="text-sm font-black text-slate-700">ابدأ بسؤال سريع</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {suggestedPrompts.map(prompt => <button type="button" key={prompt} onClick={() => void ask(prompt)} disabled={busy} className="rounded-2xl border border-violet-100 bg-white p-3 text-right text-sm font-bold leading-6 text-violet-900 hover:border-violet-300 hover:bg-violet-50 disabled:opacity-50">{prompt}</button>)}
        </div>
      </div>}

      {messages.length > 0 && <div aria-live="polite" className="max-h-[420px] space-y-3 overflow-y-auto rounded-2xl bg-slate-50 p-3">
        {messages.map((message, index) => <div key={index} className={message.role === 'user' ? 'mr-auto max-w-[92%] rounded-2xl rounded-bl-sm bg-slate-800 px-4 py-3 text-sm leading-6 text-white' : 'ml-auto max-w-[96%] rounded-2xl rounded-br-sm border border-violet-100 bg-white px-4 py-3 text-sm leading-7 text-slate-800 shadow-sm'}>
          <div className="mb-1 text-[10px] font-black opacity-70">{message.role === 'user' ? 'أنت' : 'مساعد طيبة AI'}</div>
          <div className="whitespace-pre-wrap">{message.content}</div>
        </div>)}
        {busy && <div className="flex items-center gap-2 text-xs font-bold text-violet-700"><LoaderCircle size={16} className="animate-spin"/> المساعد بيراجع البيانات المتاحة...</div>}
      </div>}

      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900"><AlertCircle size={18} className="mt-1 shrink-0"/><span>{error}</span></div>}

      <form onSubmit={event => { event.preventDefault(); void ask(); }} className="flex flex-col gap-2 sm:flex-row">
        <textarea aria-label="اكتب سؤالك لمساعد طيبة" rows={2} maxLength={1200} value={question} onChange={event => setQuestion(event.target.value)} placeholder="اكتب سؤالك عن التشغيل أو البيانات..." className="min-h-14 flex-1 resize-y rounded-2xl border border-slate-300 bg-white p-3 text-sm text-slate-900" />
        <button type="submit" disabled={busy || !question.trim()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-violet-700 px-5 py-3 text-sm font-black text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50">{busy ? <LoaderCircle size={18} className="animate-spin"/> : <Send size={18}/>} إرسال السؤال</button>
      </form>
      <p className="text-[11px] leading-5 text-slate-400">الإجابة تعتمد على ملخص البيانات المرسل للمساعد، وقد تحتاج مراجعة بشرية قبل اتخاذ قرار تشغيلي. لا تُرسل بيانات شخصية أو كلمات مرور في الأسئلة.</p>
    </div>
  </section>;
};
