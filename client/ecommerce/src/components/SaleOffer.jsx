import { Link } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";

const parseTargetDateTime = (targetDate, targetTime = "00:00") => {
  if (!targetDate) return NaN;

  // Supports "DD-MM-YYYY" (e.g., "01-01-2027") or "YYYY-MM-DD"
  const parts = String(targetDate).trim().split("-");
  if (parts.length !== 3) return NaN;

  let year, month, day;
  if (parts[0].length === 4) {
    [year, month, day] = parts.map(Number);
  } else {
    [day, month, year] = parts.map(Number);
  }

  const [hours = 0, minutes = 0, seconds = 0] = String(targetTime)
    .trim()
    .split(":")
    .map(Number);

  return new Date(year, month - 1, day, hours, minutes, seconds).getTime();
};

const getRemainingTime = (endDateTime) => {
  if (Number.isNaN(endDateTime)) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }

  const distance = endDateTime - Date.now();
  if (distance <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }

  return {
    days: Math.floor(distance / (1000 * 60 * 60 * 24)),
    hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((distance % (1000 * 60)) / 1000),
    expired: false,
  };
};

const SaleOffer = ({
  targetDate = "01-01-2027",
  targetTime = "00:00",
  hideWhenExpired = false,
}) => {
  const [show, setShow] = useState(true);
  const [timeLeft, setTimeLeft] = useState(() =>
    getRemainingTime(parseTargetDateTime(targetDate, targetTime))
  );

  useEffect(() => {
    const endDateTime = parseTargetDateTime(targetDate, targetTime);

    const updateTimer = () => {
      const next = getRemainingTime(endDateTime);
      setTimeLeft(next);
      return next.expired;
    };

    // Run immediately on mount/change so there is no 1-second delay
    if (updateTimer()) return;

    const interval = setInterval(() => {
      if (updateTimer()) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate, targetTime]);

  const showControl = useCallback(() => {
    setShow((prev) => !prev);
  }, []);

  if (!show || (hideWhenExpired && timeLeft.expired)) {
    return null;
  }

  return (
    <div className="sale-offer">
      <div className="container container-full">
        <div className="sale-offer__content flx-between position-relative">
          <div className="sale-offer__countdown">
            <div className="countdown">
              <div className="day">
                <span className="num">{timeLeft.days}</span>
                <span className="word">Days</span>
              </div>
              <div className="hour">
                <span className="num">{timeLeft.hours}</span>
                <span className="word">Hours</span>
              </div>
              <div className="min">
                <span className="num">{timeLeft.minutes}</span>
                <span className="word">Min</span>
              </div>
              <div className="sec">
                <span className="num">{timeLeft.seconds}</span>
                <span className="word">Sec</span>
              </div>
            </div>
          </div>
          <div className="sale-offer__discount flx-align gap-2">
            <span className="sale-offer__text text-heading text-capitalize">
              New Year Flash Sale Offer
            </span>
            <strong className="sale-offer__qty text-heading font-heading">
              45% OFF
            </strong>
            <Link to="/all-products" className="btn btn-sm btn-white pill fw-500">
              Shop Now
            </Link>
          </div>
          <div className="sale-offer__button">
            <button
              type="button"
              className="sale-offer__close text-heading"
              onClick={showControl}
              aria-label="Close sale offer"
            >
              <i className="las la-times" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaleOffer;