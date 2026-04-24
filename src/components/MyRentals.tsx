import { useState } from 'react';
import { Building, Calendar, DollarSign, FileText, Download, MessageCircle } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

interface Rental {
  id: string;
  propertyTitle: string;
  propertyImage: string;
  monthlyRent: number;
  startDate: string;
  endDate: string;
  status: 'pending' | 'active' | 'ending-soon' | 'completed';
  landlordName: string;
  landlordPhone: string;
  nextPaymentDate?: string;
  depositAmount: number;
}

export function MyRentals() {
  const [rentals] = useState<Rental[]>([
    {
      id: '1',
      propertyTitle: '油麻地 雅賓大廈',
      propertyImage: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&auto=format&fit=crop',
      monthlyRent: 3450,
      startDate: '2024-01-15',
      endDate: '2025-01-14',
      status: 'active',
      landlordName: '張先生',
      landlordPhone: '+852 9123 4567',
      nextPaymentDate: '2024-12-01',
      depositAmount: 6900,
    },
    {
      id: '2',
      propertyTitle: '旺角 豪華公寓',
      propertyImage: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&auto=format&fit=crop',
      monthlyRent: 4800,
      startDate: '2024-03-01',
      endDate: '2024-08-31',
      status: 'pending',
      landlordName: '李小姐',
      landlordPhone: '+852 9234 5678',
      depositAmount: 9600,
    },
  ]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-orange-500">待審核</Badge>;
      case 'active':
        return <Badge className="bg-green-500">租賃中</Badge>;
      case 'ending-soon':
        return <Badge className="bg-yellow-500">即將到期</Badge>;
      case 'completed':
        return <Badge className="bg-gray-500">已完成</Badge>;
      default:
        return null;
    }
  };

  const activeRentals = rentals.filter(r => r.status === 'active' || r.status === 'ending-soon');
  const pendingRentals = rentals.filter(r => r.status === 'pending');
  const pastRentals = rentals.filter(r => r.status === 'completed');

  return (
    <div className="max-w-7xl mx-auto bg-white min-h-screen p-4 md:px-6 lg:px-8">
      <h1 className="text-2xl mb-6">我的租賃</h1>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="active">租賃中</TabsTrigger>
          <TabsTrigger value="pending">待審核</TabsTrigger>
          <TabsTrigger value="past">歷史記錄</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4 mt-4">
          {activeRentals.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Building className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p>暫無租賃中的物業</p>
            </div>
          ) : (
            activeRentals.map((rental) => (
              <Card key={rental.id} className="overflow-hidden">
                <div className="flex gap-3 p-4">
                  <img
                    src={rental.propertyImage}
                    alt={rental.propertyTitle}
                    className="w-24 h-24 object-cover rounded"
                  />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between">
                      <h3 className="text-sm">{rental.propertyTitle}</h3>
                      {getStatusBadge(rental.status)}
                    </div>
                    <p className="text-lg">${rental.monthlyRent}/月</p>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Calendar className="w-3 h-3" />
                      <span>{rental.startDate} 至 {rental.endDate}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t p-4 bg-gray-50 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">業主</span>
                    <span>{rental.landlordName}</span>
                  </div>
                  {rental.nextPaymentDate && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">下次繳租</span>
                      <span className="font-medium">{rental.nextPaymentDate}</span>
                    </div>
                  )}
                  <div className="flex gap-2 mt-3">
                    <Button variant="outline" size="sm" className="flex-1">
                      <FileText className="w-3 h-3 mr-1" />
                      租約
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      <DollarSign className="w-3 h-3 mr-1" />
                      繳租
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      <MessageCircle className="w-3 h-3 mr-1" />
                      聯絡
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="pending" className="space-y-4 mt-4">
          {pendingRentals.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Building className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p>沒有待審核的申請</p>
            </div>
          ) : (
            pendingRentals.map((rental) => (
              <Card key={rental.id} className="overflow-hidden">
                <div className="flex gap-3 p-4">
                  <img
                    src={rental.propertyImage}
                    alt={rental.propertyTitle}
                    className="w-24 h-24 object-cover rounded"
                  />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between">
                      <h3 className="text-sm">{rental.propertyTitle}</h3>
                      {getStatusBadge(rental.status)}
                    </div>
                    <p className="text-lg">${rental.monthlyRent}/月</p>
                    <div className="text-xs text-gray-600">
                      已付按金: ${rental.depositAmount}
                    </div>
                  </div>
                </div>

                <div className="border-t p-4 bg-orange-50">
                  <div className="flex items-start gap-2 text-sm">
                    <div className="w-2 h-2 bg-orange-500 rounded-full mt-1.5 flex-shrink-0"></div>
                    <div>
                      <p className="font-medium text-orange-800">等待業主審核</p>
                      <p className="text-xs text-orange-700 mt-1">
                        業主通常在 1-3 個工作天內回覆申請
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="past" className="space-y-4 mt-4">
          {pastRentals.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Building className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p>沒有歷史記錄</p>
            </div>
          ) : (
            pastRentals.map((rental) => (
              <Card key={rental.id} className="overflow-hidden opacity-75">
                <div className="flex gap-3 p-4">
                  <img
                    src={rental.propertyImage}
                    alt={rental.propertyTitle}
                    className="w-24 h-24 object-cover rounded grayscale"
                  />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between">
                      <h3 className="text-sm">{rental.propertyTitle}</h3>
                      {getStatusBadge(rental.status)}
                    </div>
                    <p className="text-sm text-gray-600">${rental.monthlyRent}/月</p>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Calendar className="w-3 h-3" />
                      <span>{rental.startDate} 至 {rental.endDate}</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
