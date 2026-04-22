import React, { useEffect, useMemo, useState } from 'react';
import {
  createProperty,
  getInbox,
  listProperties,
  login,
  register,
  sendMessage,
  type Message,
  type Property,
  type Role,
  type User
} from './api';

type AuthMode = 'login' | 'register';

function App() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string>('');
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authRole, setAuthRole] = useState<Role>('tenant');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [inbox, setInbox] = useState<Message[]>([]);
  const [districtFilter, setDistrictFilter] = useState('');
  const [maxPriceFilter, setMaxPriceFilter] = useState('');

  const [authForm, setAuthForm] = useState({ name: '', phone: '', password: '' });
  const [propertyForm, setPropertyForm] = useState({
    title: '',
    district: '',
    price: '',
    area: '',
    description: '',
    image_url: ''
  });
  const [messageDraft, setMessageDraft] = useState<Record<number, string>>({});

  const uniqueDistricts = useMemo(
    () => [...new Set(properties.map(p => p.district))].filter(Boolean),
    [properties]
  );

  async function loadProperties() {
    try {
      const data = await listProperties({
        district: districtFilter || undefined,
        max_price: maxPriceFilter ? Number(maxPriceFilter) : undefined
      });
      setProperties(data);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    loadProperties();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!token || user?.role !== 'landlord') return;
    getInbox(token).then(setInbox).catch(() => undefined);
  }, [token, user]);

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    try {
      const data =
        authMode === 'register'
          ? await register({
              name: authForm.name,
              phone: authForm.phone,
              password: authForm.password,
              role: authRole
            })
          : await login({ phone: authForm.phone, password: authForm.password });
      setToken(data.token);
      setUser(data.user);
      setInfo(`歡迎回來，${data.user.name}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleCreateProperty(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError('');
    try {
      await createProperty(token, {
        title: propertyForm.title,
        district: propertyForm.district,
        price: Number(propertyForm.price),
        area: Number(propertyForm.area),
        description: propertyForm.description,
        image_url: propertyForm.image_url
      });
      setPropertyForm({
        title: '',
        district: '',
        price: '',
        area: '',
        description: '',
        image_url: ''
      });
      await loadProperties();
      setInfo('房源已新增。');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleSendMessage(property: Property) {
    const content = messageDraft[property.id]?.trim();
    if (!token || !content) return;
    setError('');
    try {
      await sendMessage(token, {
        property_id: property.id,
        receiver_id: property.landlord_id,
        content
      });
      setMessageDraft(prev => ({ ...prev, [property.id]: '' }));
      setInfo('訊息已送出。');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <h1 className="text-xl font-bold">T-House Real User MVP</h1>
          <div className="text-sm">
            {user ? (
              <span>
                {user.name} ({user.role})
                <button
                  className="ml-3 rounded bg-slate-900 px-3 py-1 text-white"
                  onClick={() => {
                    setUser(null);
                    setToken('');
                    setInbox([]);
                    setInfo('已登出。');
                  }}
                >
                  登出
                </button>
              </span>
            ) : (
              '請先登入或註冊'
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-lg font-semibold">帳號</h2>
            <div className="mb-3 flex gap-2">
              <button
                className={`rounded px-3 py-1 text-sm ${authMode === 'login' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}
                onClick={() => setAuthMode('login')}
              >
                登入
              </button>
              <button
                className={`rounded px-3 py-1 text-sm ${authMode === 'register' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}
                onClick={() => setAuthMode('register')}
              >
                註冊
              </button>
            </div>
            <form className="space-y-2" onSubmit={handleAuthSubmit}>
              {authMode === 'register' && (
                <>
                  <input
                    className="w-full rounded border p-2 text-sm"
                    placeholder="姓名"
                    value={authForm.name}
                    onChange={e => setAuthForm(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                  <select
                    className="w-full rounded border p-2 text-sm"
                    value={authRole}
                    onChange={e => setAuthRole(e.target.value as Role)}
                  >
                    <option value="tenant">租客</option>
                    <option value="landlord">業主</option>
                  </select>
                </>
              )}
              <input
                className="w-full rounded border p-2 text-sm"
                placeholder="手機號碼"
                value={authForm.phone}
                onChange={e => setAuthForm(prev => ({ ...prev, phone: e.target.value }))}
                required
              />
              <input
                className="w-full rounded border p-2 text-sm"
                placeholder="密碼"
                type="password"
                value={authForm.password}
                onChange={e => setAuthForm(prev => ({ ...prev, password: e.target.value }))}
                required
              />
              <button className="w-full rounded bg-indigo-600 p-2 text-sm font-semibold text-white">
                {authMode === 'login' ? '登入' : '註冊'}
              </button>
            </form>
          </section>

          {user?.role === 'landlord' && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-lg font-semibold">新增房源</h2>
              <form className="space-y-2" onSubmit={handleCreateProperty}>
                <input
                  className="w-full rounded border p-2 text-sm"
                  placeholder="標題"
                  value={propertyForm.title}
                  onChange={e => setPropertyForm(prev => ({ ...prev, title: e.target.value }))}
                  required
                />
                <input
                  className="w-full rounded border p-2 text-sm"
                  placeholder="地區"
                  value={propertyForm.district}
                  onChange={e => setPropertyForm(prev => ({ ...prev, district: e.target.value }))}
                  required
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="rounded border p-2 text-sm"
                    placeholder="月租"
                    type="number"
                    value={propertyForm.price}
                    onChange={e => setPropertyForm(prev => ({ ...prev, price: e.target.value }))}
                    required
                  />
                  <input
                    className="rounded border p-2 text-sm"
                    placeholder="面積"
                    type="number"
                    value={propertyForm.area}
                    onChange={e => setPropertyForm(prev => ({ ...prev, area: e.target.value }))}
                    required
                  />
                </div>
                <textarea
                  className="w-full rounded border p-2 text-sm"
                  placeholder="描述"
                  value={propertyForm.description}
                  onChange={e => setPropertyForm(prev => ({ ...prev, description: e.target.value }))}
                  required
                />
                <input
                  className="w-full rounded border p-2 text-sm"
                  placeholder="圖片 URL"
                  value={propertyForm.image_url}
                  onChange={e => setPropertyForm(prev => ({ ...prev, image_url: e.target.value }))}
                  required
                />
                <button className="w-full rounded bg-slate-900 p-2 text-sm font-semibold text-white">
                  發佈房源
                </button>
              </form>
            </section>
          )}
        </aside>

        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-lg font-semibold">房源搜尋</h2>
            <div className="grid gap-2 md:grid-cols-3">
              <select
                className="rounded border p-2 text-sm"
                value={districtFilter}
                onChange={e => setDistrictFilter(e.target.value)}
              >
                <option value="">全部地區</option>
                {uniqueDistricts.map(d => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <input
                className="rounded border p-2 text-sm"
                placeholder="最高租金"
                type="number"
                value={maxPriceFilter}
                onChange={e => setMaxPriceFilter(e.target.value)}
              />
              <button className="rounded bg-indigo-600 p-2 text-sm font-semibold text-white" onClick={loadProperties}>
                套用篩選
              </button>
            </div>
          </div>

          {error && <p className="rounded bg-red-100 p-3 text-sm text-red-700">{error}</p>}
          {info && <p className="rounded bg-green-100 p-3 text-sm text-green-700">{info}</p>}

          <div className="grid gap-4 md:grid-cols-2">
            {properties.map(p => (
              <article key={p.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <img src={p.image_url} alt={p.title} className="h-44 w-full object-cover" />
                <div className="space-y-2 p-4">
                  <h3 className="text-lg font-bold">{p.title}</h3>
                  <p className="text-sm text-slate-600">
                    {p.district} ・ {p.area} 呎 ・ HK${p.price}/月
                  </p>
                  <p className="text-sm text-slate-700">{p.description}</p>
                  <p className="text-xs text-slate-500">業主：{p.landlord_name}</p>
                  {user?.role === 'tenant' && (
                    <div className="space-y-2 pt-2">
                      <textarea
                        className="w-full rounded border p-2 text-sm"
                        placeholder="輸入訊息給業主..."
                        value={messageDraft[p.id] ?? ''}
                        onChange={e =>
                          setMessageDraft(prev => ({
                            ...prev,
                            [p.id]: e.target.value
                          }))
                        }
                      />
                      <button
                        className="rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
                        onClick={() => handleSendMessage(p)}
                      >
                        發送訊息
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>

          {user?.role === 'landlord' && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-lg font-semibold">收件匣</h2>
              <div className="space-y-2">
                {inbox.length === 0 && <p className="text-sm text-slate-600">目前尚無訊息。</p>}
                {inbox.map(item => (
                  <div key={item.id} className="rounded border border-slate-200 p-3">
                    <p className="text-sm font-semibold">
                      {item.sender_name} {'->'} {item.property_title}
                    </p>
                    <p className="text-sm text-slate-700">{item.content}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;

