import { useState } from 'react';
import { Property } from '../App';
import { submitLeaseApplication } from '../lib/leaseApplications';
import { sendLeaseNoticeForApplication } from '../lib/leaseNotice';
import { supabase } from '../lib/supabase';
import { useLocale } from '../context/LocaleContext';
import { RentalApplication, ApplicationData } from './RentalApplication';
import { PaymentDialog } from './PaymentDialog';

interface PropertySignLeaseFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property: Property;
  conversationId?: string;
  onCompleted?: () => void;
}

/**
 * 租客「立即簽約」流程（申請表 → 付款 → 提交租約）。
 * 目前由聊天室租客快捷操作掛載；亦可在其他入口重用。
 */
export function PropertySignLeaseFlow({
  open,
  onOpenChange,
  property,
  conversationId,
  onCompleted,
}: PropertySignLeaseFlowProps) {
  const { propertyT, noticeT } = useLocale();
  const [showPayment, setShowPayment] = useState(false);
  const [applicationData, setApplicationData] = useState<ApplicationData | null>(null);

  const finishFlow = () => {
    setShowPayment(false);
    setApplicationData(null);
    onOpenChange(false);
    onCompleted?.();
  };

  const handleProceedToPayment = (data: ApplicationData) => {
    setApplicationData(data);
    setShowPayment(true);
    onOpenChange(false);
  };

  const handleApplicationOpenChange = (next: boolean) => {
    if (!next && !showPayment) {
      onOpenChange(false);
      onCompleted?.();
    } else {
      onOpenChange(next);
    }
  };

  const handlePaymentOpenChange = (next: boolean) => {
    setShowPayment(next);
    if (!next) {
      setApplicationData(null);
      onCompleted?.();
    }
  };

  const handlePaymentSuccess = () => {
    finishFlow();
  };

  return (
    <>
      <RentalApplication
        open={open && !showPayment}
        onOpenChange={handleApplicationOpenChange}
        property={property}
        conversationId={conversationId}
        onProceedToPayment={handleProceedToPayment}
      />

      {applicationData ? (
        <PaymentDialog
          open={showPayment}
          onOpenChange={handlePaymentOpenChange}
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
            }).then(async (result) => {
              const {
                data: { user },
              } = await supabase.auth.getUser();
              if (user) {
                await sendLeaseNoticeForApplication({
                  propertyId: property.id,
                  tenantId: user.id,
                  landlordId: property.landlordId,
                  senderId: user.id,
                  type: 'submitted',
                  text: noticeT.bodyLeaseSubmitted,
                });
              }
              return result;
            });
          }}
          onPaymentSuccess={handlePaymentSuccess}
        />
      ) : null}
    </>
  );
}
