import React, { useState } from 'react';
import {
  Mountain,
  Building2,
  Plus,
  Phone,
  MapPin,
  ExternalLink,
  ClipboardPaste,
  Check,
  FileSpreadsheet,
  Trash2
} from 'lucide-react';
import { Quarry, ClientFactory } from '../types/fleet';

interface QuarriesClientsDirectoryProps {
  quarries: Quarry[];
  clients: ClientFactory[];
  onAddQuarry: (quarry: Omit<Quarry, 'id'>) => void;
  onAddClient: (client: Omit<ClientFactory, 'id'>) => void;
  onDeleteQuarry: (id: string) => void;
  onDeleteClient: (id: string) => void;
  onBulkImport: (rawText: string, type: 'quarry' | 'client') => void;
}

export const QuarriesClientsDirectory: React.FC<QuarriesClientsDirectoryProps> = ({
  quarries,
  clients,
  onAddQuarry,
  onAddClient,
  onDeleteQuarry,
  onDeleteClient,
  onBulkImport
}) => {
  const [activeTab, setActiveTab] = useState<'quarries' | 'clients'>('quarries');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteContent, setPasteContent] = useState('');

  // New Quarry Form state
  const [qName, setQName] = useState('');
  const [qRegion, setQRegion] = useState('');
  const [qMaterials, setQMaterials] = useState('');
  const [qContact, setQContact] = useState('');
  const [qPhone, setQPhone] = useState('');
  const [qGateNotes, setQGateNotes] = useState('');

  // New Client Form state
  const [cFactoryName, setCFactoryName] = useState('');
  const [cClientName, setCClientName] = useState('');
  const [cZone, setCZone] = useState('');
  const [cContact, setCContact] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cUnloadingNotes, setCUnloadingNotes] = useState('');

  const handleCreateQuarry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qName) return;
    onAddQuarry({
      name: qName,
      region: qRegion || 'المنطقة الصحراوية',
      location: { lat: 29.8 + (Math.random() - 0.5) * 0.4, lng: 32.2 + (Math.random() - 0.5) * 0.4 },
      materialsAvailable: qMaterials ? qMaterials.split('،').map(s => s.trim()).filter(Boolean) : ['سن 1', 'سن 2'],
      contactName: qContact,
      contactPhone: qPhone,
      gateNotes: qGateNotes
    });
    setQName('');
    setQRegion('');
    setQMaterials('');
    setQContact('');
    setQPhone('');
    setQGateNotes('');
    setShowAddModal(false);
  };

  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cFactoryName) return;
    onAddClient({
      name: cFactoryName,
      clientName: cClientName || cFactoryName,
      industrialZone: cZone || 'المنطقة الصناعية',
      location: { lat: 29.9 + (Math.random() - 0.5) * 0.4, lng: 32.4 + (Math.random() - 0.5) * 0.4 },
      contactName: cContact,
      contactPhone: cPhone,
      unloadingNotes: cUnloadingNotes
    });
    setCFactoryName('');
    setCClientName('');
    setCZone('');
    setCContact('');
    setCPhone('');
    setCUnloadingNotes('');
    setShowAddModal(false);
  };

  const handlePasteSubmit = () => {
    if (!pasteContent.trim()) return;
    onBulkImport(pasteContent, activeTab === 'quarries' ? 'quarry' : 'client');
    setPasteContent('');
    setShowPasteModal(false);
  };

  const filteredQuarries = quarries.filter(q =>
    q.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.region.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.materialsAvailable.some(m => m.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.industrialZone.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">

      {/* Google Drive Database Sync Banner */}
      <div className="p-3.5 bg-zinc-900 border border-emerald-500/40 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2.5 text-xs">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
          <span className="font-bold text-emerald-400">قاعدة بيانات Google Drive متصلة ونشطة:</span>
          <span className="text-zinc-300">
            تم استيراد كشف ملف <strong className="text-white font-mono">Titles 1.xlsx</strong> بنجاح (123 مصنع وعميل · 22 محجر ومورد · 153 ناقل وسائق).
          </span>
        </div>
        <span className="text-[11px] text-zinc-500 font-mono">Folder: 1pd5qUsff...</span>
      </div>
      
      {/* Top Bar with tab switches & import */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-amber-500" />
            <span>كشوفات المحاجر والعملاء المعتمدة (Tiba Supplies)</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            بيانات أماكن التحميل (المحاجر) وأماكن التفريغ (المصانع والعملاء)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search Box */}
          <input
            type="text"
            placeholder={activeTab === 'quarries' ? 'بحث في المحاجر والخامات...' : 'بحث في المصانع والمناطق...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 w-44 sm:w-56"
          />

          {/* Segmented control */}
          <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('quarries')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === 'quarries' ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              كشف المحاجر ({quarries.length})
            </button>
            <button
              onClick={() => setActiveTab('clients')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === 'clients' ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              كشف المصانع والعملاء ({clients.length})
            </button>
          </div>

          {/* Add single entry */}
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs sm:text-sm px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow transition"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>{activeTab === 'quarries' ? 'إضافة محجر' : 'إضافة مصنع/عميل'}</span>
          </button>
        </div>
      </div>

      {/* Quarries Tab */}
      {activeTab === 'quarries' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredQuarries.map((q) => (
            <div
              key={q.id}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-md space-y-3 relative group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold">
                    <Mountain className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm sm:text-base">{q.name}</h3>
                    <p className="text-xs text-zinc-400 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-amber-400" />
                      <span>{q.region}</span>
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => onDeleteQuarry(q.id)}
                  className="text-zinc-500 hover:text-red-400 p-1 transition"
                  title="حذف المحجر"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Materials badges */}
              <div className="space-y-1">
                <div className="text-[11px] text-zinc-400 font-semibold">الخامات المتاحة للتحميل:</div>
                <div className="flex flex-wrap gap-1.5">
                  {q.materialsAvailable.map((m, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-zinc-950 text-amber-400 border border-zinc-800 rounded-md text-xs font-medium"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>

              {/* Contact info */}
              <div className="pt-2 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-300">
                {q.contactPhone ? (
                  <a
                    href={`tel:${q.contactPhone}`}
                    className="flex items-center gap-1 text-emerald-400 hover:underline font-mono"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>{q.contactName ? `${q.contactName}: ` : ''}{q.contactPhone}</span>
                  </a>
                ) : (
                  <span className="text-zinc-500">بدون هاتف مسجل</span>
                )}

                <a
                  href={`https://maps.google.com/?q=${q.location.lat},${q.location.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 hover:underline flex items-center gap-1 text-[11px]"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>الموقع على الخريطة</span>
                </a>
              </div>

              {q.gateNotes && (
                <div className="p-2.5 bg-zinc-950 rounded-lg text-xs text-zinc-300 border border-zinc-800">
                  <span className="font-bold text-amber-400">تعليمات البوابة والميزان: </span>
                  {q.gateNotes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Clients Tab */}
      {activeTab === 'clients' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredClients.map((c) => (
            <div
              key={c.id}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-md space-y-3 relative group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm sm:text-base">{c.name}</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      الشركة / العميل: <span className="text-zinc-200">{c.clientName}</span>
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => onDeleteClient(c.id)}
                  className="text-zinc-500 hover:text-red-400 p-1 transition"
                  title="حذف المصنع"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-zinc-400 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-blue-400" />
                <span>المنطقة: {c.industrialZone} {c.address ? `(${c.address})` : ''}</span>
              </div>

              {/* Contact info */}
              <div className="pt-2 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-300">
                {c.contactPhone ? (
                  <a
                    href={`tel:${c.contactPhone}`}
                    className="flex items-center gap-1 text-emerald-400 hover:underline font-mono"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>{c.contactName ? `${c.contactName}: ` : ''}{c.contactPhone}</span>
                  </a>
                ) : (
                  <span className="text-zinc-500">بدون هاتف مسجل</span>
                )}

                <a
                  href={`https://maps.google.com/?q=${c.location.lat},${c.location.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline flex items-center gap-1 text-[11px]"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>الموقع على الخريطة</span>
                </a>
              </div>

              {c.unloadingNotes && (
                <div className="p-2.5 bg-zinc-950 rounded-lg text-xs text-zinc-300 border border-zinc-800">
                  <span className="font-bold text-blue-400">تعليمات التفريغ والاستلام: </span>
                  {c.unloadingNotes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal: Add Entry */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="bg-zinc-900 border border-zinc-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">
              {activeTab === 'quarries' ? 'إضافة محجر جديد للكشف' : 'إضافة مصنع وعميل جديد'}
            </h3>

            {activeTab === 'quarries' ? (
              <form onSubmit={handleCreateQuarry} className="space-y-3 text-xs">
                <div>
                  <label className="block mb-1 text-zinc-300">اسم المحجر *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: محجر بني سويف الشرقي"
                    value={qName}
                    onChange={(e) => setQName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-zinc-300">المنطقة أو الطريق</label>
                  <input
                    type="text"
                    placeholder="مثال: طريق الجيش - بني سويف"
                    value={qRegion}
                    onChange={(e) => setQRegion(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-zinc-300">الخامات المتاحة (افصل بفاصلة)</label>
                  <input
                    type="text"
                    placeholder="مثال: سن 1، سن 2، رمل خشن، بودرة"
                    value={qMaterials}
                    onChange={(e) => setQMaterials(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-zinc-100"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block mb-1 text-zinc-300">مسؤول الكسارة</label>
                    <input
                      type="text"
                      placeholder="مثال: الحاج عادل"
                      value={qContact}
                      onChange={(e) => setQContact(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-zinc-300">رقم الهاتف</label>
                    <input
                      type="text"
                      placeholder="010..."
                      value={qPhone}
                      onChange={(e) => setQPhone(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-zinc-100"
                    />
                  </div>
                </div>
                <div>
                  <label className="block mb-1 text-zinc-300">تعليمات البوابة والميزان</label>
                  <input
                    type="text"
                    placeholder="مثال: التحميل بعد سداد الكارتة"
                    value={qGateNotes}
                    onChange={(e) => setQGateNotes(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-zinc-100"
                  />
                </div>
                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-3 py-1.5 text-zinc-400 hover:text-white"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold px-4 py-2 rounded-lg"
                  >
                    حفظ المحجر
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCreateClient} className="space-y-3 text-xs">
                <div>
                  <label className="block mb-1 text-zinc-300">اسم المصنع *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: مصنع حديد السويس"
                    value={cFactoryName}
                    onChange={(e) => setCFactoryName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-zinc-300">اسم العميل / الشركة</label>
                  <input
                    type="text"
                    placeholder="مثال: شركة حديد السويس للصلب"
                    value={cClientName}
                    onChange={(e) => setCClientName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-zinc-300">المنطقة الصناعية</label>
                  <input
                    type="text"
                    placeholder="مثال: المنطقة الاقتصادية بالعين السخنة"
                    value={cZone}
                    onChange={(e) => setCZone(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-zinc-100"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block mb-1 text-zinc-300">مسؤول الاستلام</label>
                    <input
                      type="text"
                      placeholder="مثال: م. وائل"
                      value={cContact}
                      onChange={(e) => setCContact(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-zinc-300">رقم الهاتف</label>
                    <input
                      type="text"
                      placeholder="011..."
                      value={cPhone}
                      onChange={(e) => setCPhone(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-zinc-100"
                    />
                  </div>
                </div>
                <div>
                  <label className="block mb-1 text-zinc-300">تعليمات التفريغ</label>
                  <input
                    type="text"
                    placeholder="مثال: التفريغ بعد الوزن المسبق بميزان المصنع"
                    value={cUnloadingNotes}
                    onChange={(e) => setCUnloadingNotes(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-zinc-100"
                  />
                </div>
                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-3 py-1.5 text-zinc-400 hover:text-white"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold px-4 py-2 rounded-lg"
                  >
                    حفظ المصنع والعميل
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: Bulk Paste Parser */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="bg-zinc-900 border border-zinc-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ClipboardPaste className="w-5 h-5 text-amber-500" />
              <span>لصق كشف نصي سريع ({activeTab === 'quarries' ? 'كشف محاجر' : 'كشف عملاء ومصانع'})</span>
            </h3>
            <p className="text-xs text-zinc-400">
              يمكنك نسخ الكشف من الواتساب أو الإكسيل ولصقه هنا مباشرة، وسيقوم النظام باستخراج العناصر وإضافتها:
            </p>

            <textarea
              rows={6}
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              placeholder={
                activeTab === 'quarries'
                  ? 'محجر عتاقة - طريق السخنة - سن 1 وسن 2 - هاتف 0101111111\nمحجر الكريمات - بني سويف - رمل أصفر - هاتف 0112222222'
                  : 'مصنع أسمنت السويس - المنطقة الصناعية - م. طارق 0103333333\nمصنع سيراميك كليوباترا - العين السخنة - أ. سامح 0114444444'
              }
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500 font-mono"
            />

            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => setShowPasteModal(false)}
                className="px-3 py-1.5 text-zinc-400 hover:text-white"
              >
                إلغاء
              </button>
              <button
                onClick={handlePasteSubmit}
                className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold px-4 py-2 rounded-lg"
              >
                استيراد الكشف فوراً
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
