import { useCallback, useEffect, useState } from 'react';
import { Home, Plus, DollarSign, Users, Bell, Settings, FileText, TrendingUp, MessageCircle, User } from 'lucide-react';
import { Property } from '../App';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { NoticeDialog } from './NoticeDialog';
import { PropertyManagementDialog } from './PropertyManagementDialog';
import { dedupePropertyRows, defaultPropertyImage } from '../lib/properties';
import { fetchUnreadInquiryCount } from '../lib/conversations';
import { fetchPendingApplicationCounts } from '../lib/leaseApplications';
import { supabase } from '../lib/supabase';
import { uploadDeedFile, uploadListingCoverImage, uploadProofPhotoFiles } from '../lib/propertyMediaUpload';
import thouseLogo from 'figma:asset/f0c80b0c66e9c54aea3881bdf7a4eb152cbc4c0b.png';
import { ThouseHomeFooter } from './ThouseHomeFooter';

interface LandlordHomeProps {
  onSignOut: () => void;
  onPropertyClick: (property: Property) => void;
  onChatClick: () => void;
  onProfileClick: () => void;
}

type VerificationState = 'pending' | 'approved' | 'rejected';

interface ManagedProperty extends Property {
  status: '已出租' | '招租中';
  tenantName: string | null;
  nextDueDate: string;
  applications: number;
  /** 後台審核：未通過則不會在首頁出現 */
  verificationStatus: VerificationState;
  verificationRejectedReason: string;
}

export function LandlordHome({ onSignOut, onPropertyClick, onChatClick, onProfileClick }: LandlordHomeProps) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<ManagedProperty | null>(null);
  const [dialogMode, setDialogMode] = useState<'details' | 'lease'>('details');
  const [managementOpen, setManagementOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentLandlordId, setCurrentLandlordId] = useState<string | null>(null);
  const [myProperties, setMyProperties] = useState<ManagedProperty[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formArea, setFormArea] = useState('');
  const [formFloor, setFormFloor] = useState('');
  const [formBedrooms, setFormBedrooms] = useState('1');
  const [formBathrooms, setFormBathrooms] = useState('1');
  const [formDistrict, setFormDistrict] = useState('');
  const [formImage, setFormImage] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCoverFile, setFormCoverFile] = useState<File | null>(null);
  const [formProofFiles, setFormProofFiles] = useState<File[]>([]);
  const [formDeedFile, setFormDeedFile] = useState<File | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refreshUnread = async () => {
      const n = await fetchUnreadInquiryCount();
      if (!cancelled) setUnreadCount(n);
    };
    void refreshUnread();
    const interval = setInterval(refreshUnread, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const loadLandlordProperties = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setPropertiesLoading(true);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMyProperties([]);
      setCurrentLandlordId(null);
      if (!options?.silent) {
        setPropertiesLoading(false);
      }
      return;
    }

    setCurrentLandlordId(user.id);

    const { data, error } = await supabase
      .from('properties')
      .select(
        'id,landlord_id,title,image,price,area,floor,bedrooms,bathrooms,status,created_at,verification_status,verification_rejected_reason'
      )
      .eq('landlord_id', user.id)
      .order('created_at', { ascending: false });

    if (error || !data) {
      setMyProperties([]);
      if (!options?.silent) {
        setPropertiesLoading(false);
      }
      return;
    }

    const uniqueRows = dedupePropertyRows(
      data as Array<{
        id: string;
        landlord_id: string;
        title: string | null;
        image: string | null;
        price: number;
        area: number;
        floor: number;
        bedrooms: number;
        bathrooms: number;
        status: string | null;
        created_at: string;
        verification_status: string | null;
        verification_rejected_reason: string | null;
      }>,
      'newestByCreatedAt'
    );
    uniqueRows.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const propertyIds = uniqueRows.map((p) => p.id);
    const pendingCounts = await fetchPendingApplicationCounts(user.id, propertyIds);

    setMyProperties(
      uniqueRows.map((property) => {
        const vs = property.verification_status;
        const ver: VerificationState =
          vs === 'pending' || vs === 'approved' || vs === 'rejected' ? vs : 'pending';
        return {
          id: property.id,
          landlordId: property.landlord_id ?? undefined,
          title: property.title ?? '未命名物業',
          image: property.image || defaultPropertyImage,
          price: Number(property.price ?? 0),
          area: Number(property.area ?? 0),
          floor: Number(property.floor ?? 0),
          bedrooms: Number(property.bedrooms ?? 1),
          bathrooms: Number(property.bathrooms ?? 1),
          isFavorite: false,
          status: property.status === 'rented' ? '已出租' : '招租中',
          tenantName: null,
          nextDueDate: property.status === 'rented' ? '待設定' : '待出租',
          applications: pendingCounts[property.id] ?? 0,
          verificationStatus: ver,
          verificationRejectedReason: (property.verification_rejected_reason ?? '').trim(),
        };
      })
    );
    if (!options?.silent) {
      setPropertiesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLandlordProperties();
  }, [loadLandlordProperties]);

  const resetForm = () => {
    setFormTitle('');
    setFormPrice('');
    setFormArea('');
    setFormFloor('');
    setFormBedrooms('1');
    setFormBathrooms('1');
    setFormDistrict('');
    setFormImage('');
    setFormDescription('');
    setFormCoverFile(null);
    setFormProofFiles([]);
    setFormDeedFile(null);
    setSaveError('');
  };

  const handleCreateProperty = async () => {
    try {
      setSaveError('');

      if (!currentLandlordId) {
        throw new Error('未能識別目前業主帳號。');
      }

      if (!formTitle.trim()) {
        throw new Error('請輸入物業標題。');
      }
      if (formProofFiles.length < 1) {
        throw new Error('請上傳至少一張實景佐證照片。');
      }
      if (!formDeedFile) {
        throw new Error('請上傳房產證明（圖片或 PDF）。');
      }

      setSaveLoading(true);

      let coverUrl = formImage.trim();
      if (formCoverFile) {
        coverUrl = await uploadListingCoverImage(currentLandlordId, formCoverFile);
      } else if (!coverUrl) {
        throw new Error('請上傳租盤主圖，或填寫主圖網址。');
      }

      const proofPaths = await uploadProofPhotoFiles(currentLandlordId, formProofFiles);
      const deedPath = await uploadDeedFile(currentLandlordId, formDeedFile);

      const payload = {
        landlord_id: currentLandlordId,
        title: formTitle.trim(),
        image: coverUrl,
        price: Number(formPrice || 0),
        area: Number(formArea || 0),
        floor: Number(formFloor || 0),
        bedrooms: Number(formBedrooms || 1),
        bathrooms: Number(formBathrooms || 1),
        district: formDistrict.trim(),
        description: formDescription.trim(),
        status: 'available',
        proof_photo_urls: proofPaths,
        property_deed_url: deedPath,
        verification_status: 'pending',
      };

      const { error } = await supabase.from('properties').insert(payload);

      if (error) {
        const m = (error.message || '').toLowerCase();
        if (m.includes('column') || m.includes('proof_photo') || m.includes('verification')) {
          throw new Error(
            '資料庫尚未套用審核欄位。請在 Supabase 執行 supabase/property_listing_verification.sql 後再試。'
          );
        }
        throw error;
      }

      await loadLandlordProperties({ silent: true });
      resetForm();
      setShowAddProperty(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '新增物業失敗，請稍後再試。');
    } finally {
      setSaveLoading(false);
    }
  };

  const openPropertyDialog = (property: ManagedProperty, mode: 'details' | 'lease') => {
    setSelectedProperty(property);
    setDialogMode(mode);
    setManagementOpen(true);
  };

  const occupiedCount = myProperties.filter((p) => p.status === '已出租').length;
  const pendingApplications = myProperties.reduce((sum, p) => sum + p.applications, 0);
  const monthlyIncome = myProperties
    .filter((p) => p.status === '已出租')
    .reduce((sum, p) => sum + p.price, 0);

  const stats = {
    totalProperties: myProperties.length,
    occupiedProperties: occupiedCount,
    monthlyIncome,
    pendingApplications,
  };

  return (
    <>
    <div className="max-w-7xl mx-auto bg-white min-h-screen pb-20 md:pb-8 flex flex-col w-full">
      {/* Header */}
      <div className="p-4 md:px-6 lg:px-8 bg-white sticky top-0 z-10 border-b shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={thouseLogo} alt="簡屋" className="w-10 h-10" />
            <div>
              <span className="tracking-wider">簡屋</span>
              <p className="text-xs text-gray-600">業主管理</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setNoticeOpen(true)} className="relative p-2 rounded-full bg-gray-100 hover:bg-gray-200">
              <Bell className="w-5 h-5 text-gray-600" />
              {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>}
            </button>
            <button onClick={onChatClick} className="relative p-2 rounded-full bg-gray-100 hover:bg-gray-200">
              <MessageCircle className="w-5 h-5 text-gray-600" />
              {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>}
            </button>
            <button
              onClick={onProfileClick}
              className="p-2 rounded-full bg-gray-100 hover:bg-gray-200"
              aria-label="個人資料"
            >
              <User className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:px-6 lg:px-8 flex-1 min-h-0 w-full">
        {activeTab === 'dashboard' && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <Home className="w-5 h-5 text-gray-600" />
                  <span className="text-2xl">{stats.totalProperties}</span>
                </div>
                <p className="text-sm text-gray-600">總物業數</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <Users className="w-5 h-5 text-gray-600" />
                  <span className="text-2xl">{stats.occupiedProperties}</span>
                </div>
                <p className="text-sm text-gray-600">已出租</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <DollarSign className="w-5 h-5 text-gray-600" />
                  <span className="text-xl">${stats.monthlyIncome}</span>
                </div>
                <p className="text-sm text-gray-600">月收入</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <FileText className="w-5 h-5 text-gray-600" />
                  <span className="text-2xl">{stats.pendingApplications}</span>
                </div>
                <p className="text-sm text-gray-600">待處理申請</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mb-6">
              <h2 className="mb-3">快速操作</h2>
              <Dialog open={showAddProperty} onOpenChange={setShowAddProperty}>
                <DialogTrigger asChild>
                  <Button className="w-full bg-black text-white hover:bg-gray-800 mb-2">
                    <Plus className="w-4 h-4 mr-2" />
                    新增物業
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md mx-auto max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>新增租盤</DialogTitle>
                    <p className="text-sm text-gray-500 pt-1">
                      請上傳實景佐證與房產證明，管理員審核通過後租盤才會出現在租客首頁。
                    </p>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label>物業標題</Label>
                      <Input
                        placeholder="例如：油麻地 雅賓大廈 劏房"
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>月租金額</Label>
                      <Input type="number" placeholder="3450" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} />
                    </div>
                    <div>
                      <Label>面積 (平方呎)</Label>
                      <Input type="number" placeholder="74" value={formArea} onChange={(e) => setFormArea(e.target.value)} />
                    </div>
                    <div>
                      <Label>樓層</Label>
                      <Input type="number" placeholder="1" value={formFloor} onChange={(e) => setFormFloor(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>房間數</Label>
                        <Input type="number" placeholder="1" value={formBedrooms} onChange={(e) => setFormBedrooms(e.target.value)} />
                      </div>
                      <div>
                        <Label>浴室數</Label>
                        <Input type="number" placeholder="1" value={formBathrooms} onChange={(e) => setFormBathrooms(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <Label>地區</Label>
                      <Input placeholder="例如：油麻地" value={formDistrict} onChange={(e) => setFormDistrict(e.target.value)} />
                    </div>
                    <div>
                      <Label>租盤主圖（展示用）</Label>
                      <Input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="mt-2"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          setFormCoverFile(f ?? null);
                        }}
                      />
                      <p className="text-xs text-gray-500 mt-1">或改填下方主圖網址（二擇一）</p>
                    </div>
                    <div>
                      <Label>主圖網址（若已上傳檔案則可留空）</Label>
                      <Input
                        placeholder="https://..."
                        value={formImage}
                        onChange={(e) => setFormImage(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>實景佐證照片（至少一張）</Label>
                      <Input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        className="mt-2"
                        onChange={(e) => {
                          setFormProofFiles(e.target.files ? Array.from(e.target.files) : []);
                        }}
                      />
                    </div>
                    <div>
                      <Label>房產證明（圖片或 PDF）</Label>
                      <Input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        className="mt-2"
                        onChange={(e) => {
                          setFormDeedFile(e.target.files?.[0] ?? null);
                        }}
                      />
                    </div>
                    <div>
                      <Label>物業描述</Label>
                      <Textarea
                        placeholder="描述您的物業特色..."
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                      />
                    </div>
                    {saveError ? <p className="text-sm text-red-500">{saveError}</p> : null}
                    <Button className="w-full bg-black text-white hover:bg-gray-800" onClick={handleCreateProperty} disabled={saveLoading}>
                      {saveLoading ? '送出中...' : '送出審核'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Button variant="outline" className="w-full">
                <FileText className="w-4 h-4 mr-2" />
                查看所有申請
              </Button>
            </div>

            {/* My Properties */}
            <div>
              <h2 className="mb-3">我的物業</h2>
              {propertiesLoading ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center text-gray-500">
                  正在載入你的物業...
                </div>
              ) : myProperties.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center">
                  <p className="text-base text-gray-700 mb-2">你目前未有任何物業</p>
                  <p className="text-sm text-gray-500 mb-5">新增第一個租盤後，物業資料會顯示在這裡。</p>
                  <Button className="bg-black text-white hover:bg-gray-800" onClick={() => setShowAddProperty(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    新增第一個物業
                  </Button>
                </div>
              ) : (
                <div className="space-y-5">
                  {myProperties.map((property) => (
                    <div key={property.id} className="rounded-lg border border-gray-200 p-4 bg-white">
                      <div className="flex gap-4 items-start">
                        <ImageWithFallback
                          src={property.image}
                          alt={property.title}
                          className="w-56 h-40 object-cover rounded-md shrink-0"
                        />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="min-w-0">
                              <h3 className="font-medium truncate">{property.title}</h3>
                              <p className="text-sm text-gray-500 mt-1">
                                {property.area} 平方呎 ・ {property.floor} 樓 ・ {property.bedrooms} 房 {property.bathrooms} 廁
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span
                                className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                                  property.status === '已出租'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}
                              >
                                {property.status}
                              </span>
                              <span
                                className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                                  property.verificationStatus === 'approved'
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : property.verificationStatus === 'pending'
                                      ? 'bg-gray-100 text-gray-700 border border-gray-200'
                                      : 'bg-red-50 text-red-800 border border-red-200'
                                }`}
                              >
                                {property.verificationStatus === 'approved'
                                  ? '已上架首頁'
                                  : property.verificationStatus === 'pending'
                                    ? '審核中'
                                    : '審核未通過'}
                              </span>
                            </div>
                          </div>
                          {property.verificationStatus === 'rejected' && property.verificationRejectedReason ? (
                            <p className="text-xs text-red-600 mt-1">{property.verificationRejectedReason}</p>
                          ) : null}

                          <div className="space-y-2 text-sm text-gray-600 mb-4">
                            <div className="flex justify-between gap-3">
                              <span>月租</span>
                              <span className="font-medium text-gray-900">${property.price}</span>
                            </div>
                            <div className="flex justify-between gap-3">
                              <span>租客</span>
                              <span>{property.tenantName ?? '未有租客'}</span>
                            </div>
                            <div className="flex justify-between gap-3">
                              <span>下次租金到期</span>
                              <span>{property.nextDueDate}</span>
                            </div>
                            <div className="flex justify-between gap-3">
                              <span>新申請</span>
                              <span>{property.applications}</span>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              className="flex-1"
                            onClick={() => openPropertyDialog(property, 'details')}
                            >
                              查看詳情
                            </Button>
                          <Button
                            className="flex-1 bg-black text-white hover:bg-gray-800"
                            onClick={() => openPropertyDialog(property, 'lease')}
                          >
                            管理租約
                          </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'analytics' && (
          <div className="text-center py-12">
            <TrendingUp className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <h2 className="mb-2">數據分析</h2>
            <p className="text-gray-600">詳細分析功能即將推出</p>
          </div>
        )}
      </div>
    </div>

    <ThouseHomeFooter className="w-full" />

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t md:hidden z-30">
        <div className="flex items-center justify-around py-3">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center gap-1 ${activeTab === 'dashboard' ? 'text-black' : 'text-gray-400'}`}
          >
            <Home className="w-6 h-6" />
            <span className="text-xs">總覽</span>
            {activeTab === 'dashboard' && <div className="w-8 h-1 bg-black" />}
          </button>
          <button 
            onClick={() => setActiveTab('analytics')}
            className={`flex flex-col items-center gap-1 ${activeTab === 'analytics' ? 'text-black' : 'text-gray-400'}`}
          >
            <TrendingUp className="w-6 h-6" />
            <span className="text-xs">分析</span>
            {activeTab === 'analytics' && <div className="w-8 h-1 bg-black" />}
          </button>
          <button className="flex flex-col items-center gap-1 text-gray-400">
            <Settings className="w-6 h-6" />
            <span className="text-xs">設定</span>
          </button>
        </div>
      </div>

      <NoticeDialog open={noticeOpen} onOpenChange={setNoticeOpen} userRole="landlord" />
      <PropertyManagementDialog
        open={managementOpen}
        onOpenChange={setManagementOpen}
        property={selectedProperty}
        mode={dialogMode}
      />
    </>
  );
}
