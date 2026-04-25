import { useEffect, useState } from 'react';
import { MessageCircle, Phone, Mail, Send, Check, User, Star } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Property } from '../App';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner@2.0.3';
import { getPublicLandlordProfile } from '../lib/profiles';
import { supabase } from '../lib/supabase';
import { sendTenantInquiryMessage } from '../lib/conversations';
import { getProfileStarSummary, type StarSummary } from '../lib/transactionReviews';

interface ContactLandlordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property: Property;
  isAuthenticated: boolean;
}

export function ContactLandlordDialog({ open, onOpenChange, property, isAuthenticated }: ContactLandlordDialogProps) {
  const [contactMethod, setContactMethod] = useState<'message' | 'call' | 'email'>('message');
  const [messageSent, setMessageSent] = useState(false);
  const [landlordLoading, setLandlordLoading] = useState(true);
  const [ratingLoading, setRatingLoading] = useState(true);
  const [starSummary, setStarSummary] = useState<StarSummary>({ avgStars: 0, reviewCount: 0 });
  
  // Message form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  
  const [sending, setSending] = useState(false);
  const [landlord, setLandlord] = useState({
    name: '業主',
    phone: '',
    email: '',
    responseTime: '未設定',
    verificationStatus: '未驗證',
  });

  const formatLandlordDisplayName = (fullName: string, salutation: string) => {
    const trimmedName = fullName.trim();
    if (!trimmedName) {
      return salutation ? `業主 ${salutation}` : '業主';
    }

    const surname = trimmedName.split(/\s+/)[0];
    return salutation ? `${surname} ${salutation}` : surname;
  };

  useEffect(() => {
    let isMounted = true;

    const loadLandlordProfile = async () => {
      if (!property.landlordId) {
        if (isMounted) {
          setLandlordLoading(false);
          setRatingLoading(false);
          setStarSummary({ avgStars: 0, reviewCount: 0 });
        }
        return;
      }

      setLandlordLoading(true);
      setRatingLoading(true);

      let summary: StarSummary = { avgStars: 0, reviewCount: 0 };
      try {
        summary = await getProfileStarSummary(property.landlordId);
      } catch {
        summary = { avgStars: 0, reviewCount: 0 };
      }
      if (isMounted) {
        setStarSummary(summary);
        setRatingLoading(false);
      }

      if (!isMounted) return;

      try {
        const data = await getPublicLandlordProfile(property.landlordId);

        if (!isMounted || !data) return;

        const fullName = typeof data.full_name === 'string' ? data.full_name : '';
        const salutation = data.salutation === '先生' || data.salutation === '女士' ? data.salutation : '';
        setLandlord({
          name: formatLandlordDisplayName(fullName, salutation),
          phone: typeof data.phone === 'string' ? data.phone : '',
          email: typeof data.email === 'string' ? data.email : '',
          responseTime: typeof data.response_time === 'string' && data.response_time.trim() ? data.response_time : '未設定',
          verificationStatus: data.is_verified ? '已驗證' : '未驗證',
        });
      } catch {
        // Keep fallback landlord display when RPC is not yet available.
      } finally {
        if (isMounted) {
          setLandlordLoading(false);
        }
      }
    };

    loadLandlordProfile();

    return () => {
      isMounted = false;
    };
  }, [property.landlordId]);

  const handleSendMessage = async () => {
    if (!name || !phone || !message) {
      toast.error('請填寫所有必填欄位');
      return;
    }
    if (!isAuthenticated) {
      toast.error('請先登入，以便業主在通知與聊天室內回覆你。');
      return;
    }
    if (!property.landlordId) {
      toast.error('物業缺少業主資料，無法發送。');
      return;
    }

    setSending(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        throw new Error('無法取得登入狀態，請重新登入。');
      }
      if (user.id === property.landlordId) {
        toast.error('你係此單位業主，毋須聯絡自己。');
        return;
      }

      await sendTenantInquiryMessage({
        propertyId: property.id,
        landlordId: property.landlordId,
        tenantId: user.id,
        tenantDisplayName: name.trim(),
        message,
        contactName: name,
        contactPhone: phone,
        contactEmail: email,
      });

      setMessageSent(true);
      toast.success('訊息已發送！');
      setTimeout(() => {
        onOpenChange(false);
        setMessageSent(false);
        setName('');
        setPhone('');
        setEmail('');
        setMessage('');
      }, 2000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '發送失敗，請稍後再試。');
    } finally {
      setSending(false);
    }
  };

  const handleCall = () => {
    if (!landlord.phone) {
      toast.error('此業主尚未提供電話。');
      return;
    }
    toast.success('正在撥號至業主...');
    window.location.href = `tel:${landlord.phone}`;
  };

  const handleEmail = () => {
    if (!landlord.email) {
      toast.error('此業主尚未提供電郵。');
      return;
    }
    toast.success('正在開啟電郵應用程式...');
    window.location.href = `mailto:${landlord.email}?subject=查詢物業: ${property.title}`;
  };

  if (messageSent) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <div className="text-center py-8 space-y-4">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl">訊息已發送！</h2>
            <p className="text-gray-600">
              業主將會盡快回覆您的查詢
              <br />
              預計回覆時間：{landlord.responseTime}
            </p>
            <div className="p-4 bg-gray-50 rounded-lg space-y-2 text-left">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">物業</span>
                <span>{property.title}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">業主</span>
                <span>{landlord.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">您的電話</span>
                <span>{phone}</span>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              業主可於「通知」及「聊天室」內看到此則查詢。
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto overflow-x-hidden sm:max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            聯絡業主
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            選擇聯絡方式與業主溝通
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Property Summary */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium mb-2">{property.title}</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <div className="flex justify-between">
                <span>每月租金</span>
                <span className="font-medium text-black">${property.price}</span>
              </div>
              <div className="flex justify-between">
                <span>面積</span>
                <span>{property.area} 平方呎</span>
              </div>
            </div>
          </div>

          {/* Landlord Info */}
          <div className="p-4 border rounded-lg space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-gray-600" />
                </div>
                <div>
                  <h4 className="font-medium">{landlordLoading ? '載入業主資料中...' : landlord.name}</h4>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        landlord.verificationStatus === '已驗證'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {landlord.verificationStatus}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-600">
              <span className="text-gray-500">評分</span>
              {ratingLoading ? (
                <span className="text-gray-400">載入中…</span>
              ) : (
                <>
                  <div className="flex items-center gap-0.5" aria-hidden>
                    {[1, 2, 3, 4, 5].map((n) => {
                      const hasReviews = starSummary.reviewCount > 0;
                      const filled = hasReviews && n <= Math.round(starSummary.avgStars);
                      return (
                        <Star
                          key={n}
                          className={`h-4 w-4 shrink-0 ${filled ? 'fill-amber-400 text-amber-500' : 'text-gray-300'}`}
                        />
                      );
                    })}
                  </div>
                  {starSummary.reviewCount === 0 ? (
                    <span className="text-gray-500">(未有評分)</span>
                  ) : (
                    <span className="text-gray-600">
                      平均 {starSummary.avgStars.toFixed(1)} 星 · {starSummary.reviewCount} 則評價
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="text-sm text-gray-600">
              平均回覆時間：{landlord.responseTime}
            </div>
            <div className="space-y-1 text-sm text-gray-600">
              <div className="flex justify-between gap-3">
                <span>電話</span>
                <span>{landlord.phone || '未提供電話'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span>電郵</span>
                <span className="break-all text-right">{landlord.email || '未提供電郵'}</span>
              </div>
            </div>
          </div>

          {/* Contact Methods Tabs */}
          <Tabs value={contactMethod} onValueChange={(v) => setContactMethod(v as any)} className="w-full min-w-0">
            <TabsList className="grid w-full min-w-0 grid-cols-1 gap-2 p-1.5 sm:grid sm:grid-cols-3 sm:gap-1 sm:p-1">
              <TabsTrigger
                value="message"
                className="min-h-11 w-full justify-center gap-2 sm:min-h-8 sm:flex-1"
              >
                <MessageCircle className="h-4 w-4 shrink-0" />
                訊息
              </TabsTrigger>
              <TabsTrigger
                value="call"
                className="min-h-11 w-full justify-center gap-2 sm:min-h-8 sm:flex-1"
              >
                <Phone className="h-4 w-4 shrink-0" />
                電話
              </TabsTrigger>
              <TabsTrigger
                value="email"
                className="min-h-11 w-full justify-center gap-2 sm:min-h-8 sm:flex-1"
              >
                <Mail className="h-4 w-4 shrink-0" />
                電郵
              </TabsTrigger>
            </TabsList>

            {/* Message Tab */}
            <TabsContent value="message" className="mt-4 space-y-4 data-[state=inactive]:hidden">
              <div className="space-y-2">
                <Label htmlFor="name">您的姓名 *</Label>
                <Input
                  id="name"
                  placeholder="請輸入您的姓名"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">聯絡電話 *</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="請輸入您的電話號碼"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">電郵地址</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="請輸入您的電郵地址（選填）"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">訊息 *</Label>
                <Textarea
                  id="message"
                  placeholder="請輸入您想向業主查詢的內容..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                />
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                <p className="font-medium mb-1">快速訊息範本：</p>
                <button
                  className="text-left hover:underline block"
                  onClick={() => setMessage('您好，我對此物業感興趣，請問何時可以安排參觀？')}
                >
                  • 我對此物業感興趣，請問何時可以安排參觀？
                </button>
                <button
                  className="text-left hover:underline block"
                  onClick={() => setMessage('您好，請問租金可以商議嗎？')}
                >
                  • 請問租金可以商議嗎？
                </button>
                <button
                  className="text-left hover:underline block"
                  onClick={() => setMessage('您好，請問最快何時可以入住？')}
                >
                  • 請問最快何時可以入住？
                </button>
              </div>

              <Button
                onClick={handleSendMessage}
                className="w-full bg-black text-white hover:bg-gray-800"
                disabled={sending || !name || !phone || !message}
              >
                <Send className="w-4 h-4 mr-2" />
                {sending ? '發送中…' : '發送訊息'}
              </Button>
            </TabsContent>

            {/* Call Tab */}
            <TabsContent value="call" className="mt-4 space-y-4 data-[state=inactive]:hidden">
              <div className="text-center py-8 space-y-4">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                  <Phone className="w-10 h-10 text-blue-600" />
                </div>
                <div>
                  <p className="text-gray-600 mb-2">業主電話</p>
                  <p className="text-2xl font-medium">{landlord.phone || '未提供電話'}</p>
                </div>
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                  <p className="font-medium mb-1">致電前提示：</p>
                  <ul className="list-disc list-inside text-left space-y-1">
                    <li>請準備好您的問題清單</li>
                    <li>建議在辦公時間（9:00-18:00）致電</li>
                    <li>記得詢問參觀時間</li>
                  </ul>
                </div>
                <Button
                  onClick={handleCall}
                  className="w-full bg-green-600 text-white hover:bg-green-700"
                >
                  <Phone className="w-4 h-4 mr-2" />
                  立即致電
                </Button>
              </div>
            </TabsContent>

            {/* Email Tab */}
            <TabsContent value="email" className="mt-4 space-y-4 data-[state=inactive]:hidden">
              <div className="text-center py-8 space-y-4">
                <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
                  <Mail className="w-10 h-10 text-purple-600" />
                </div>
                <div>
                  <p className="text-gray-600 mb-2">業主電郵</p>
                  <p className="text-lg font-medium break-all px-4">{landlord.email || '未提供電郵'}</p>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                  <p className="font-medium mb-1">電郵聯絡優點：</p>
                  <ul className="list-disc list-inside text-left space-y-1">
                    <li>可以詳細說明您的需求</li>
                    <li>保留完整溝通記錄</li>
                    <li>可附上相關文件</li>
                  </ul>
                </div>
                <Button
                  onClick={handleEmail}
                  className="w-full bg-purple-600 text-white hover:bg-purple-700"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  發送電郵
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          <div className="text-xs text-center text-gray-500 pt-4 border-t">
            聯絡業主時，請注意保護個人私隱，切勿透露敏感資料
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
