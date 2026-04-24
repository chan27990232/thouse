import { useState } from 'react';
import { ArrowLeft, MapPin, Home, Bed, Bath } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { Property } from '../App';
import { submitLeaseApplication } from '../lib/leaseApplications';
import { Button } from './ui/button';
import { RentalApplication, ApplicationData } from './RentalApplication';
import { PaymentDialog } from './PaymentDialog';
import { ContactLandlordDialog } from './ContactLandlordDialog';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface PropertyDetailProps {
  property: Property;
  onBack: () => void;
  isAuthenticated: boolean;
}

export function PropertyDetail({ property, onBack, isAuthenticated }: PropertyDetailProps) {
  const [showRentalApp, setShowRentalApp] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [applicationData, setApplicationData] = useState<ApplicationData | null>(null);

  const handleProceedToPayment = (data: ApplicationData) => {
    setApplicationData(data);
    setShowRentalApp(false);
    setShowPayment(true);
  };

  const handlePaymentSuccess = () => {
    setShowPayment(false);
    // Show success and navigate back
    setTimeout(() => {
      onBack();
    }, 500);
  };

  return (
    <div className="mx-auto min-h-screen w-full min-w-0 max-w-5xl overflow-x-hidden bg-white">
      {/* Header */}
      <div className="relative">
        <ImageWithFallback
          src={property.image}
          alt={property.title}
          className="h-48 w-full object-cover sm:h-64 md:h-80 lg:h-[26rem]"
        />
        <button
          onClick={onBack}
          className="absolute left-3 top-3 rounded-full bg-white p-2 shadow-lg hover:bg-gray-100 sm:left-4 sm:top-4"
          type="button"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-6 md:px-8 lg:px-10">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="mb-1 text-xl sm:text-2xl">{property.title}</h1>
            <div className="flex items-center gap-2 text-gray-600">
              <MapPin className="h-4 w-4 shrink-0" />
              <span>香港</span>
            </div>
          </div>
          <div className="shrink-0 sm:text-right">
            <div className="text-2xl sm:text-3xl">${property.price}</div>
            <div className="text-gray-500">/月</div>
          </div>
        </div>

        {/* Property Details：手機 2×2，sm+ 四欄 */}
        <div className="grid grid-cols-2 gap-3 border-y py-5 sm:grid-cols-4 sm:gap-4 sm:py-6">
          <div className="text-center">
            <Home className="w-6 h-6 mx-auto mb-2 text-gray-600" />
            <div>{property.area}</div>
            <div className="text-sm text-gray-500">平方呎</div>
          </div>
          <div className="text-center">
            <Bed className="w-6 h-6 mx-auto mb-2 text-gray-600" />
            <div>{property.bedrooms}</div>
            <div className="text-sm text-gray-500">臥室</div>
          </div>
          <div className="text-center">
            <Bath className="w-6 h-6 mx-auto mb-2 text-gray-600" />
            <div>{property.bathrooms}</div>
            <div className="text-sm text-gray-500">浴室</div>
          </div>
          <div className="text-center">
            <div className="w-6 h-6 mx-auto mb-2 text-gray-600 flex items-center justify-center">
              <span className="text-lg">🏢</span>
            </div>
            <div>{property.floor}</div>
            <div className="text-sm text-gray-500">樓層</div>
          </div>
        </div>

        {/* Description */}
        <div className="py-6">
          <h2 className="mb-3">物業描述</h2>
          <p className="text-gray-600 leading-relaxed">
            此劏房位置優越，設備齊全，適合個人或小家庭居住。鄰近公共交通設施、購物中心及餐廳，生活便利。
          </p>
        </div>

        {/* Amenities */}
        <div className="border-t py-6">
          <h2 className="mb-3">設施</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
            {['冷氣', '暖氣', 'WiFi', '停車場', '升降機', '保安'].map((amenity) => (
              <div key={amenity} className="flex items-center gap-2 text-gray-600">
                <div className="w-2 h-2 bg-black rounded-full" />
                <span>{amenity}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-6 flex min-h-11 flex-col gap-2.5 sm:flex-row sm:gap-3">
          <Button
            variant="outline"
            className="w-full min-h-11 flex-1 sm:min-h-10"
            onClick={() => setShowContactDialog(true)}
            type="button"
          >
            聯絡業主
          </Button>
          <Button
            className="w-full min-h-11 flex-1 bg-black text-white hover:bg-gray-800 sm:min-h-10"
            type="button"
            onClick={() => {
              if (!isAuthenticated) {
                toast.error('請先登入，以便完成線上簽約與支付首期。');
                return;
              }
              setShowRentalApp(true);
            }}
          >
            立即簽約
          </Button>
        </div>
      </div>

      {/* Contact Landlord Dialog */}
      {showContactDialog && (
        <ContactLandlordDialog
          open={showContactDialog}
          onOpenChange={setShowContactDialog}
          property={property}
          isAuthenticated={isAuthenticated}
        />
      )}

      {/* Rental Application */}
      {showRentalApp && (
        <RentalApplication
          open={showRentalApp}
          onOpenChange={setShowRentalApp}
          property={property}
          onProceedToPayment={handleProceedToPayment}
        />
      )}

      {/* Payment Dialog */}
      {showPayment && applicationData && (
        <PaymentDialog
          open={showPayment}
          onOpenChange={setShowPayment}
          property={property}
          applicationData={applicationData}
          onRecordLease={async (payment) => {
            if (!property.landlordId) {
              throw new Error('此物業缺少業主資料，無法通知業主。請重新從列表進入。');
            }
            return await submitLeaseApplication({
              propertyId: property.id,
              landlordId: property.landlordId,
              monthlyPrice: property.price,
              applicationData,
              payment,
            });
          }}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}
