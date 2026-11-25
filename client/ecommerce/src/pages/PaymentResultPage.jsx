import { Link, useSearchParams } from "react-router-dom";
import BrandSectionOne from "../components/BrandSectionOne";
import FooterOne from "../components/FooterOne";
import HeaderOne from "../components/HeaderOne";
import Preloader from "../helper/Preloader";

const PaymentResultPage = ({ status }) => {
  const cancelled = status === "cancel";
  const [searchParams] = useSearchParams();
  const refundRequired = searchParams.get("reason") === "refund_required";
  const verificationPending =
    searchParams.get("reason") === "verification_pending";

  return (
    <>
      <Preloader />
      <HeaderOne />
      <section className='section-bg padding-y-120'>
        <div className='container container-two'>
          <div className='row justify-content-center'>
            <div className='col-lg-7 text-center'>
              <h2 className='mb-3'>
                {refundRequired
                  ? "Payment received; order needs attention"
                  : verificationPending
                    ? "Payment verification is pending"
                    : cancelled
                      ? "Payment cancelled"
                      : "Payment was not completed"}
              </h2>
              <p className='mb-4'>
                {refundRequired
                  ? "Your payment was verified, but the items could not be reserved. Please contact support to arrange a refund. Do not place the order again."
                  : verificationPending
                    ? "We could not verify the payment response yet. Please check your orders before trying again; payment notifications may still confirm it."
                    : cancelled
                      ? "Your order has not been paid. Your cart is still available so you can try again."
                      : "We could not confirm your payment. Your cart is still available so you can try again."}
              </p>
              <div className='d-flex justify-content-center gap-3 flex-wrap'>
                {refundRequired ? (
                  <Link to='/contact' className='btn btn-main pill'>
                    Contact support
                  </Link>
                ) : verificationPending ? (
                  <Link to='/dashboard-all-orders' className='btn btn-main pill'>
                    Check my orders
                  </Link>
                ) : (
                  <Link to='/cart' className='btn btn-main pill'>
                    Return to cart
                  </Link>
                )}
                <Link to='/' className='btn btn-secondary pill'>
                  Continue shopping
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
      <BrandSectionOne />
      <FooterOne />
    </>
  );
};

export default PaymentResultPage;
