import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { ImageWithFallback } from './figma/ImageWithFallback';
import type { Property } from '../App';

interface ManagedProperty extends Property {
  status: '已出租' | '招租中';
  tenantName: string | null;
  nextDueDate: string;
  applications: number;
}

interface PropertyManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property: ManagedProperty | null;
  mode: 'details' | 'lease';
}

export function PropertyManagementDialog({
  open,
  onOpenChange,
  property,
  mode,
}: PropertyManagementDialogProps) {
  const [tenantName, setTenantName] = useState(property?.tenantName ?? '');
  const [rentAmount, setRentAmount] = useState(String(property?.price ?? ''));
  const [dueDate, setDueDate] = useState(property?.nextDueDate ?? '');
  const [notes, setNotes] = useState('');

  if (!property) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'details' ? '物業資料' : '管理租約'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <ImageWithFallback
            src={property.image}
            alt={property.title}
            className="w-full h-56 object-cover rounded-lg"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>物業標題</Label>
              <div className="mt-2 rounded-md border px-3 py-2 text-sm bg-gray-50">{property.title}</div>
            </div>
            <div>
              <Label>狀態</Label>
              <div className="mt-2 rounded-md border px-3 py-2 text-sm bg-gray-50">{property.status}</div>
            </div>
            <div>
              <Label>月租</Label>
              <div className="mt-2 rounded-md border px-3 py-2 text-sm bg-gray-50">${property.price}</div>
            </div>
            <div>
              <Label>物業規格</Label>
              <div className="mt-2 rounded-md border px-3 py-2 text-sm bg-gray-50">
                {property.area} 平方呎 ・ {property.floor} 樓 ・ {property.bedrooms} 房 {property.bathrooms} 廁
              </div>
            </div>
          </div>

          {mode === 'details' ? (
            <div className="space-y-4">
              <div>
                <Label>租客</Label>
                <div className="mt-2 rounded-md border px-3 py-2 text-sm bg-gray-50">{property.tenantName ?? '未有租客'}</div>
              </div>
              <div>
                <Label>下次租金到期</Label>
                <div className="mt-2 rounded-md border px-3 py-2 text-sm bg-gray-50">{property.nextDueDate}</div>
              </div>
              <div>
                <Label>新申請數量</Label>
                <div className="mt-2 rounded-md border px-3 py-2 text-sm bg-gray-50">{property.applications}</div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label>租客名稱</Label>
                <Input value={tenantName} onChange={(e) => setTenantName(e.target.value)} placeholder="輸入租客名稱" className="mt-2" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>租金金額</Label>
                  <Input value={rentAmount} onChange={(e) => setRentAmount(e.target.value)} placeholder="輸入租金" className="mt-2" />
                </div>
                <div>
                  <Label>下次到期日</Label>
                  <Input value={dueDate} onChange={(e) => setDueDate(e.target.value)} placeholder="YYYY-MM-DD" className="mt-2" />
                </div>
              </div>
              <div>
                <Label>租約備註</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="例如：已收按金、準備續租、待簽文件..."
                  className="mt-2"
                />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1">
                  發送租金提醒
                </Button>
                <Button className="flex-1 bg-black text-white hover:bg-gray-800">
                  儲存租約資料
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
