import { useState } from 'react';
import { ArrowLeft, MapPin, Bed, Building2, Maximize2, ShowerHead } from 'lucide-react';
import { Property } from '../App';
import { submitLeaseApplication } from '../lib/leaseApplications';
import { Button } from './ui/button';
import { RentalApplication, ApplicationData } from './RentalApplication';
import { PaymentDialog } from './PaymentDialog';
import { ContactLandlordDialog } from './ContactLandlordDialog';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { useLocale } from '../context/LocaleContext';

interface PropertyDetailProps {
  property: Property;
  onBack: () => void;
  isAuthenticated: boolean;
  onRequireAuth: () => void;
}

export function PropertyDetail({ property, onBack, isAuthenticated, onRequireAuth }: PropertyDetailProps) {
  const { commonT, propertyT, filtersT, localizePropertyTitle, localizePropertyDistrict, extractPropertyAreaFromTitle } =
    useLocale();
  const displayTitle = localizePropertyTitle(property.title);
  const locationLabel =
    localizePropertyDistrict(property.district) ||
    extractPropertyAreaFromTitle(property.title) ||
    propertyT.hongKong;
  const buildingAgeLabel =
    property.buildingAge === 'new'
      ? commonT.buildingAgeNew
      : property.buildingAge === '5-10'
        ? commonT.buildingAge5_10
        : property.buildingAge === '10-20'
          ? commonT.buildingAge10_20
          : property.buildingAge === '20+'
            ? commonT.buildingAge20Plus
            : null;

  const yearLabels = [
    property.builtYear ? `${propertyT.yearBuilt}：${property.builtYear}` : null,
    property.renovationYear ? `${propertyT.yearRenovated}：${property.renovationYear}` : null,
  ].filter(Boolean) as string[];

  const listedRoomFeatures = property.roomFeatures ?? [];
  const listedAmenities = property.amenities ?? [];
  const hasListingFeatures =
    yearLabels.length > 0 || Boolean(buildingAgeLabel) || listedRoomFeatures.length > 0 || listedAmenities.length > 0;
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
    setTimeout(() => {
      onBack();
    }, 500);
  };

  return (
    <div className="mx-auto min-h-screen w-full min-w-0 max-w-5xl overflow-x-hidden bg-white">
      <div className="relative">
        <ImageWithFallback
          src={property.image}
          alt={displayTitle}
          className="h-48 w-full object-cover sm:h-64 md:h-80 lg:h-[26rem]"
        />
        <button
          onClick={onBack}
          className="absolute left-3 top-3 rounded-full bg-white p-2 shadow-lg hover:bg-gray-100 sm:left-4 sm:top-4"
          type="button"
          aria-label={commonT.back}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      </div>

      <div className="p-4 sm:p-6 md:px-8 lg:px-10">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="mb-1 text-xl sm:text-2xl">{displayTitle}</h1>
            <div className="flex items-center gap-2 text-gray-600">
              <MapPin className="h-4 w-4 shrink-0" />
              <span>{locationLabel}</span>
            </div>
          </div>
          <div className="shrink-0 sm:text-right">
            <div className="text-2xl sm:text-3xl">${property.price}</div>
            <div className="text-gray-500">{commonT.perMonth}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-y py-5 sm:grid-cols-4 sm:gap-4 sm:py-6">
          <div className="text-center">
            <Maximize2 className="mx-auto mb-2 h-6 w-6 text-gray-600" strokeWidth={1.75} />
            <div>{property.area}</div>
            <div className="text-sm text-gray-500">{commonT.sqftUnit}</div>
          </div>
          <div className="text-center">
            <Bed className="w-6 h-6 mx-auto mb-2 text-gray-600" />
            <div>{property.bedrooms}</div>
            <div className="text-sm text-gray-500">{commonT.bedrooms}</div>
          </div>
          <div className="text-center">
            <ShowerHead className="mx-auto mb-2 h-6 w-6 text-gray-600" strokeWidth={1.75} />
            <div>{property.bathrooms}</div>
            <div className="text-sm text-gray-500">{commonT.bathrooms}</div>
          </div>
          <div className="text-center">
            <Building2 className="mx-auto mb-2 h-6 w-6 text-gray-600" strokeWidth={1.75} />
            <div>{property.floor}</div>
            <div className="text-sm text-gray-500">{propertyT.floor}</div>
          </div>
        </div>

        <div className="py-6">
          <h2 className="mb-3">{propertyT.descriptionTitle}</h2>
          <p className="text-gray-600 leading-relaxed">{propertyT.descriptionBody}</p>
        </div>

        {hasListingFeatures ? (
          <div className="border-t py-6">
            <h2 className="mb-3">{propertyT.amenitiesTitle}</h2>
            <div className="flex flex-wrap gap-2">
              {yearLabels.map((label) => (
                <span key={label} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-gray-700">
                  {label}
                </span>
              ))}
              {!yearLabels.length && buildingAgeLabel ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-gray-700">{buildingAgeLabel}</span>
              ) : null}
              {listedRoomFeatures.map((name) => (
                <span key={name} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-gray-700">
                  {filtersT.roomFeature(name)}
                </span>
              ))}
              {listedAmenities.map((name) => (
                <span key={name} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-gray-700">
                  {filtersT.amenity(name)}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex min-h-11 flex-col gap-2.5 sm:flex-row sm:gap-3">
          <Button
            variant="outline"
            className="w-full min-h-11 flex-1 sm:min-h-10"
            onClick={() => {
              if (!isAuthenticated) {
                onRequireAuth();
                return;
              }
              setShowContactDialog(true);
            }}
            type="button"
          >
            {propertyT.contactLandlord}
          </Button>
          <Button
            className="w-full min-h-11 flex-1 bg-black text-white hover:bg-gray-800 sm:min-h-10"
            type="button"
            onClick={() => {
              if (!isAuthenticated) {
                onRequireAuth();
                return;
              }
              setShowRentalApp(true);
            }}
          >
            {propertyT.signNow}
          </Button>
        </div>
      </div>

      {showContactDialog && (
        <ContactLandlordDialog
          open={showContactDialog}
          onOpenChange={setShowContactDialog}
          property={property}
          isAuthenticated={isAuthenticated}
        />
      )}

      {showRentalApp && (
        <RentalApplication
          open={showRentalApp}
          onOpenChange={setShowRentalApp}
          property={property}
          onProceedToPayment={handleProceedToPayment}
        />
      )}

      {showPayment && applicationData && (
        <PaymentDialog
          open={showPayment}
          onOpenChange={setShowPayment}
          property={property}
          applicationData={applicationData}
          onRecordLease={async (payment) => {
            if (!property.landlordId) {
              throw new Error(propertyT.missingLandlordError);
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
