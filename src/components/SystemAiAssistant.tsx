import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Send, Sparkles, LoaderCircle, AlertCircle, RotateCcw, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { QueueStrategy, TextToSpeech } from '@capacitor-community/text-to-speech';

type AssistantMessage = { role: 'user' | 'assistant'; content: string };

type SpeechRecognitionResultLike = { 0: { transcript: string }; isFinal: boolean };
type SpeechRecognitionEventLike = { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> };
type SpeechRecognitionErrorLike = { error: string };
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};


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
  const [listening, setListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceEnabledRef = useRef(true);

  useEffect(() => {
    const speechWindow = window as SpeechWindow;
    setVoiceSupported(Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition));
    return () => {
      recognitionRef.current?.abort();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);

  async function speak(text: string) {
    if (!voiceEnabledRef.current) {
      setVoiceStatus('الصوت مقفول؛ الإجابة مكتوبة.');
      return;
    }
    setVoiceStatus('جاري تجهيز الصوت العربي…');

    // Prefer an explicitly installed Arabic browser voice; the default system
    // voice may be English and can read Arabic answers incorrectly.
    if ('speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined') {
      try {
        window.speechSynthesis.cancel();
        let voices = window.speechSynthesis.getVoices();
        if (!voices.length) {
          voices = await new Promise<SpeechSynthesisVoice[]>(resolve => {
            let finished = false;
            const finish = (items: SpeechSynthesisVoice[]) => {
              if (finished) return;
              finished = true;
              window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
              window.clearTimeout(timeout);
              resolve(items);
            };
            const onVoicesChanged = () => finish(window.speechSynthesis.getVoices());
            const timeout = window.setTimeout(() => finish(window.speechSynthesis.getVoices()), 900);
            window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
          });
        }
        const arabicVoices = voices.filter(voice => /^ar([-_]|$)/i.test(voice.lang));
        const selectedVoice =
          arabicVoices.find(voice => /^ar[-_]EG$/i.test(voice.lang)) ??
          arabicVoices.find(voice => /arabic|العربية|egypt/i.test(voice.name)) ??
          arabicVoices[0];
        if (selectedVoice) {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.voice = selectedVoice;
          utterance.lang = selectedVoice.lang || 'ar-EG';
          utterance.rate = 0.92;
          utterance.pitch = 1;
          utterance.onstart = () => setVoiceStatus('المساعد بينطق بالعربية باستخدام صوت الجهاز…');
          utterance.onend = () => setVoiceStatus('انتهى نطق الإجابة.');
          utterance.onerror = () => setVoiceStatus('تعذّر تشغيل الصوت العربي. الإجابة موجودة كتابة.');
          window.speechSynthesis.speak(utterance);
          return;
        }
      } catch {
        // Try the native Android TTS engine below.
      }
    }

    try {
      await TextToSpeech.stop();
      await TextToSpeech.speak({
        text,
        lang: 'ar-EG',
        rate: 0.92,
        pitch: 1,
        volume: 1,
        queueStrategy: QueueStrategy.Flush,
      });
      setVoiceStatus('تم إرسال الإجابة لمحرك النطق العربي في الجهاز.');
      return;
    } catch {
      // Keep the answer available as text if no Arabic TTS engine is installed.
    }

    setVoiceStatus('الإجابة ظهرت كتابة، لكن لا يوجد محرك نطق عربي متاح. يلزم تثبيت صوت عربي في إعدادات تحويل النص إلى كلام في أندرويد.');
  }

  function stopVoice() {
    recognitionRef.current?.stop();
    setListening(false);
    void TextToSpeech.stop().catch(() => undefined);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setVoiceStatus('تم إيقاف الصوت.');
  }

  function startVoiceInput() {
    setError('');
    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setError('التعرّف على الكلام غير متاح في إصدار التطبيق أو متصفحك. جرّب تحديث التطبيق أو استخدم الكتابة مؤقتًا.');
      return;
    }
    if (busy) return;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    recognitionRef.current?.abort();
    const recognition = new Recognition();
    recognition.lang = 'ar-EG';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = event => {
      const transcript = Array.from(event.results)
        .slice(event.resultIndex)
        .filter(result => result.isFinal)
        .map(result => result[0].transcript)
        .join(' ')
        .trim();
      setListening(false);
      recognitionRef.current = null;
      if (transcript) void ask(transcript);
      else setError('ما التقطتش كلام واضح. جرّب تاني أو اكتب سؤالك.');
    };
    recognition.onerror = event => {
      setListening(false);
      recognitionRef.current = null;
      const message = event.error === 'not-allowed'
        ? 'اسمح للتطبيق باستخدام الميكروفون من إعدادات الهاتف.'
        : event.error === 'no-speech'
          ? 'ما سمعتش كلام. اضغط الميكروفون واتكلم بوضوح.'
          : 'حصلت مشكلة في التقاط الصوت. جرّب مرة تانية أو استخدم الكتابة.';
      setError(message);
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setError('مش قادر أشغّل الميكروفون دلوقتي. اقفل المحاولة وجرّب تاني.');
    }
  }
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
    setVoiceStatus('');
    let timeoutId: number | undefined;
    try {
      const invokeRequest = supabase.functions.invoke('tiba-ai-assistant', {
        body: {
          question: clean,
          audience,
          context: safeContext,
          history: next.slice(0, -1).slice(-8).map(message => ({ role: message.role, content: message.content })),
        },
      });
      const { data, error: invokeError } = await Promise.race([
        invokeRequest,
        new Promise<never>((_, reject) => {
          timeoutId = window.setTimeout(() => reject(new Error('AI_REQUEST_TIMEOUT')), 25000);
        }),
      ]);
      if (invokeError) throw invokeError;
      if (typeof data?.answer !== 'string' || !data.answer.trim()) {
        throw new Error(data?.error === 'AI_NOT_CONFIGURED'
          ? 'مساعد الذكاء الاصطناعي لم يتم ربط مفتاحه الآمن على الخادم بعد.'
          : 'المساعد لم يرجع إجابة. جرّب مرة تانية.');
      }
      setMessages(current => [...current, { role: 'assistant', content: data.answer }]);
      void speak(data.answer);
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
        } else if (payload?.error === 'AI_TEMPORARILY_UNAVAILABLE') {
          message = 'خدمة الذكاء الاصطناعي مشغولة حاليًا. جرّب بعد دقيقة؛ التطبيق هيوقف الانتظار بدل ما يفضل يحمّل.';
        } else if (payload?.error === 'AI_MODEL_UNAVAILABLE') {
          message = 'نموذج الذكاء الاصطناعي غير متاح للمفتاح الحالي. محتاجين مراجعة إعداد النموذج على الخادم.';
        } else if (payload?.error === 'AI_PROVIDER_ERROR') {
          message = 'خدمة الذكاء الاصطناعي رفضت الطلب. جرّب مرة واحدة لاحقًا، ولو استمر الخطأ هنراجع سجلات الخادم.';
        }
      } catch {
        // Keep the safe generic message if the function error body is unavailable.
      }
      if (e?.message === 'AI_REQUEST_TIMEOUT') {
        message = 'المساعد اتأخر أكتر من 25 ثانية، فوقفنا الانتظار بدل ما يفضل يحمّل. جرّب تاني بعد لحظة.';
      }
      setError(message);
      setMessages(current => current.filter((message, index) => !(index === current.length - 1 && message.role === 'user' && message.content === clean)));
    } finally {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
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
      <button type="button" onClick={() => { stopVoice(); setMessages([]); setError(''); }} disabled={busy || messages.length === 0} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-40"><RotateCcw size={14}/> محادثة جديدة</button>
    </header>

    <div className="space-y-4 p-4 sm:p-5">
      <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4 text-sm leading-6 text-sky-950">
        اسأل المساعد عن البيانات الظاهرة في واجهتك. تقدر تتكلم بالمصري وهو يرد بصوت مسموع. المساعد للشرح والتلخيص فقط؛ لا ينشئ أوامر تحميل ولا يغيّر أي سجل أو صلاحية.
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-100 bg-violet-50/60 p-3">
        <div>
          <div className="font-black text-violet-950">المحادثة الصوتية</div>
          <p className="mt-1 text-xs leading-5 text-slate-600">{listening ? 'سامعك دلوقتي… اتكلم بوضوح.' : voiceEnabled ? 'الردود هتتقال بصوت مصري/عربي حسب الأصوات المتاحة على جهازك.' : 'الردود هتظهر كتابة من غير صوت.'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => { const next = !voiceEnabled; setVoiceEnabled(next); if (!next && 'speechSynthesis' in window) window.speechSynthesis.cancel(); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm font-bold text-violet-900" aria-pressed={voiceEnabled}>
            {voiceEnabled ? <Volume2 size={18}/> : <VolumeX size={18}/>}
            {voiceEnabled ? 'الصوت شغال' : 'تشغيل الصوت'}
          </button>
          <button type="button" onClick={listening ? stopVoice : startVoiceInput} disabled={busy} className={listening ? 'inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-black text-white' : 'inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-700 px-4 py-2 text-sm font-black text-white disabled:opacity-50'} aria-label={listening ? 'إيقاف الاستماع' : 'التحدث إلى مساعد طيبة'}>
            {listening ? <MicOff size={18}/> : <Mic size={18}/>}
            {listening ? 'إيقاف' : 'اتكلم'}
          </button>
        </div>
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

      {voiceStatus && <p aria-live="polite" className="rounded-xl bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-900">{voiceStatus}</p>}
      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900"><AlertCircle size={18} className="mt-1 shrink-0"/><span>{error}</span></div>}

      <form onSubmit={event => { event.preventDefault(); void ask(); }} className="flex flex-col gap-2 sm:flex-row">
        <textarea aria-label="اكتب سؤالك لمساعد طيبة" rows={2} maxLength={1200} value={question} onChange={event => setQuestion(event.target.value)} placeholder="اكتب سؤالك عن التشغيل أو البيانات..." className="min-h-14 flex-1 resize-y rounded-2xl border border-slate-300 bg-white p-3 text-sm text-slate-900" />
        <button type="submit" disabled={busy || !question.trim()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-violet-700 px-5 py-3 text-sm font-black text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50">{busy ? <LoaderCircle size={18} className="animate-spin"/> : <Send size={18}/>} إرسال السؤال</button>
      </form>
      {!voiceSupported && <p className="text-xs leading-5 text-amber-700">قد لا يدعم إصدار التطبيق الحالي تحويل الكلام إلى نص. لو زر الصوت لم يعمل، هنحتاج اختبار توافق الميكروفون على أندرويد؛ الردود الصوتية تعتمد أيضًا على محرك النطق المتاح على الجهاز.</p>}
      <p className="text-[11px] leading-5 text-slate-400">الإجابة تعتمد على ملخص البيانات المرسل للمساعد، وقد تحتاج مراجعة بشرية قبل اتخاذ قرار تشغيلي. لا تُرسل بيانات شخصية أو كلمات مرور في الأسئلة.</p>
    </div>
  </section>;
};
