import { FaRegStar, FaStar } from "react-icons/fa";
import { Swiper, SwiperSlide } from "swiper/react";
import { useNavigate, useSearchParams } from "react-router-dom";
import parse from "html-react-parser";
import Skeleton from "react-loading-skeleton";
import "swiper/css";
import "swiper/css/free-mode";
import "swiper/css/navigation";
import "swiper/css/thumbs";
import { FreeMode, Navigation, Thumbs } from "swiper/modules";
import { useEffect, useRef, useState } from "react";
import productStore from "../store/productStore";
import { baseURLFile } from "../helper/config";
import cartStore from "../store/cartStore";
import { ErrorToast, formatDate, IsEmpty } from "../helper/helper";
import reviewStore from "../store/reviewStore";

const StarRating = ({ star }) => {
  const rating = Math.max(0, Math.min(5, parseInt(star, 10) || 0));
  const totalStars = 5;
  const filledStars = Array(rating).fill(<FaStar />);
  const emptyStars = Array(totalStars - rating).fill(<FaRegStar />);

  return (
    <div className='star'>
      {filledStars.concat(emptyStars).map((icon, index) => (
        <span key={`star-${index}`}>{icon}</span>
      ))}
    </div>
  );
};

const ProductDetails = () => {
  const [thumbsSwiper, setThumbsSwiper] = useState(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const prevProductIdRef = useRef(null);
  const initializedProductIdRef = useRef(null);

  const [data, setData] = useState({
    size: "",
    color: "",
    qty: 1,
    activeColor: null,
    activeSize: null,
  });

  const product_id = searchParams.get("product_id");

  // Product Store
  const { singleProduct, singleProductsRequest } = productStore();
  const product = Array.isArray(singleProduct)
    ? singleProduct[0] || {}
    : singleProduct || {};

  useEffect(() => {
    if (!product_id) return;

    if (prevProductIdRef.current !== product_id) {
      prevProductIdRef.current = product_id;
      initializedProductIdRef.current = null;
      productStore.setState({ singleProduct: null });
    }

    singleProductsRequest(product_id);
  }, [product_id, singleProductsRequest]);

  // Pre-select default size & color once per product_id
  useEffect(() => {
    if (!product?._id || initializedProductIdRef.current === product._id) {
      return;
    }
    initializedProductIdRef.current = product._id;

    const sizes = Array.isArray(product?.size)
      ? product.size.filter(Boolean)
      : [];
    const colors = Array.isArray(product?.color)
      ? product.color.filter(Boolean)
      : [];

    setData({
      size: sizes.length > 0 ? sizes[0] : "",
      activeSize: sizes.length > 0 ? 0 : null,
      color: colors.length > 0 ? colors[0] : "",
      activeColor: colors.length > 0 ? 0 : null,
      qty: 1,
    });
  }, [product?._id, product?.size, product?.color]);

  const priceNum = Number(product?.price) || 0;
  const discountPriceNum = Number(product?.discount_price) || 0;
  const discount =
    product?.is_discount === true && priceNum > 0
      ? Math.max(0, ((priceNum - discountPriceNum) / priceNum) * 100)
      : 0;

  // Cart Store
  const { createCartLoading, createCartRequest, allCartRequest } = cartStore();

  const cartSubmit = async () => {
    if (IsEmpty(product_id)) {
      return ErrorToast("Product ID is required!");
    }
    if (IsEmpty(product?.title)) {
      return ErrorToast("Product details are still loading. Please try again.");
    }

    const availableColors = Array.isArray(product?.color)
      ? product.color.filter(Boolean)
      : [];
    const availableSizes = Array.isArray(product?.size)
      ? product.size.filter(Boolean)
      : [];

    if (availableColors.length > 0 && IsEmpty(data.color)) {
      return ErrorToast("Color is required!");
    }
    if (availableSizes.length > 0 && IsEmpty(data.size)) {
      return ErrorToast("Size is required!");
    }
    if (!data.qty || Number(data.qty) < 1) {
      return ErrorToast("Qty is required!");
    }

    const submitData = {
      product_id,
      product_name: product?.title,
      color: data.color || "",
      qty: Number(data.qty),
      size: data.size || "",
    };

    const res = await createCartRequest(submitData);
    if (res === 401) {
      navigate("/login");
      return;
    }
    await allCartRequest();
  };

  // Review Store
  const { allReviewByProductRequest, allReviewByProduct } = reviewStore();
  useEffect(() => {
    if (!product_id) return;
    allReviewByProductRequest(product_id);
  }, [product_id, allReviewByProductRequest]);

  const hasProduct = Boolean(product?._id);
  const showSkeleton = !hasProduct;

  const images = Array.isArray(product?.images)
    ? product.images.filter(Boolean)
    : [];
  const categoryName =
    product?.category?.category_name ||
    product?.category?.[0]?.category_name ||
    "";
  const brandName =
    product?.brand?.brand_name || product?.brand?.[0]?.brand_name || "";

  return (
    <div className='product-details mt-32 padding-b-120'>
      <div className='container container-two'>
        <div className='row gy-4'>
          {showSkeleton ? (
            <>
              {[...Array(2)].map((_, idx) => (
                <div key={`skeleton-col-${idx}`} className='col-lg-6'>
                  <div className='Skeleton'>
                    <Skeleton count={8} />
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
              {/* Left Column - Product Images and Description */}
              <div className='col-lg-6'>
                <div className='tab-content' id='pills-tabContent'>
                  <div
                    className='tab-pane fade show active'
                    id='pills-product-details'
                    role='tabpanel'
                    aria-labelledby='pills-product-details-tab'
                    tabIndex={0}
                  >
                    <div className='product-details'>
                      <div>
                        <Swiper
                          style={{
                            "--swiper-navigation-color": "#fff",
                            "--swiper-pagination-color": "#fff",
                          }}
                          spaceBetween={10}
                          navigation={true}
                          thumbs={{
                            swiper:
                              thumbsSwiper && !thumbsSwiper.destroyed
                                ? thumbsSwiper
                                : null,
                          }}
                          modules={[FreeMode, Navigation, Thumbs]}
                          className='mySwiper2'
                        >
                          {images.map((img, index) => (
                            <SwiperSlide key={`main-slide-${img}-${index}`}>
                              <div className='main-product-image mb-3'>
                                <img
                                  src={`${baseURLFile}/${img}`}
                                  alt={product?.title || "Product"}
                                  onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = "/placeholder.png";
                                  }}
                                />
                              </div>
                            </SwiperSlide>
                          ))}
                        </Swiper>

                        <div className='product-thumbnails d-flex gap-2'>
                          <Swiper
                            onSwiper={setThumbsSwiper}
                            spaceBetween={10}
                            slidesPerView={4}
                            freeMode={true}
                            watchSlidesProgress={true}
                            modules={[FreeMode, Navigation, Thumbs]}
                            className='mySwiper'
                          >
                            {images.map((img, index) => (
                              <SwiperSlide key={`thumb-slide-${img}-${index}`}>
                                <div className='main-product-image mb-3'>
                                  <img
                                    src={`${baseURLFile}/${img}`}
                                    alt={product?.title || "Thumbnail"}
                                    onError={(e) => {
                                      e.currentTarget.onerror = null;
                                      e.currentTarget.src = "/placeholder.png";
                                    }}
                                  />
                                </div>
                              </SwiperSlide>
                            ))}
                          </Swiper>
                        </div>
                      </div>

                      <h5 className='product-details__desc mt-4'>
                        Product Description
                      </h5>
                      <div className='product-details__item'>
                        {parse(product?.description || "")}
                      </div>
                    </div>
                  </div>

                  {/* Reviews Tab */}
                  <div
                    className='tab-pane fade'
                    id='pills-rating'
                    role='tabpanel'
                    aria-labelledby='pills-rating-tab'
                    tabIndex={0}
                  >
                    <div className='product-review-wrapper'>
                      {allReviewByProduct?.map((item, index) => (
                        <div
                          key={item?._id || `review-${index}`}
                          className='product-review'
                        >
                          <div className='product-review__top flx-between'>
                            <div className='product-review__rating flx-align'>
                              <div className='d-flex align-items-center gap-1'>
                                <div className='star'>
                                  <StarRating star={item?.rating} />
                                </div>
                                <span className='star-rating__text text-body'>
                                  {item?.rating}.0
                                </span>
                              </div>
                              <span className='product-review__reason'>
                                For{" "}
                                <span className='product-review__subject'>
                                  Customer Support
                                </span>
                              </span>
                            </div>
                            <div className='product-review__date'>
                              by{" "}
                              <strong className='product-review__user text--base'>
                                {item?.user?.cus_name}
                              </strong>{" "}
                              ({formatDate(item?.updatedAt)})
                            </div>
                          </div>
                          <div className='product-review__body'>
                            <p className='product-review__desc'>{item?.des}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Product Info and Purchase Options */}
              <div className='col-lg-6'>
                <div className='product-sidebar pt-0'>
                  <div className='product-sidebar__top position-relative flx-between gap-1'>
                    <div className='title_box'>
                      <h3 className='product-sidebar__title'>
                        {product?.title}
                      </h3>
                    </div>

                    <div className='price py-3'>
                      <h4>
                        {product?.is_discount === false
                          ? `৳${priceNum}`
                          : `৳${discountPriceNum}`}{" "}
                        <del>
                          {product?.is_discount === false ? "" : `৳${priceNum}`}
                        </del>{" "}
                        {product?.is_discount === true && (
                          <span className='discount_percent'>
                            - {discount.toFixed(0)} % Off
                          </span>
                        )}
                      </h4>
                      <p>{product?.sort_description}</p>
                    </div>

                    <div className='size py-3'>
                      <h5>Size: {data?.size}</h5>
                      <div className='size_varient'>
                        {product?.size?.map((item, index) => (
                          <button
                            type='button'
                            className={data?.activeSize === index ? "active" : ""}
                            key={`size-${item}-${index}`}
                            onClick={() => {
                              setData({
                                ...data,
                                size: item,
                                activeSize: index,
                              });
                            }}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className='color py-3'>
                      <h5>Color: {data?.color}</h5>
                      <div className='size_varient'>
                        {product?.color?.map((item, index) => (
                          <button
                            type='button'
                            className={data?.activeColor === index ? "active" : ""}
                            key={`color-${item}-${index}`}
                            onClick={() => {
                              setData({
                                ...data,
                                color: item,
                                activeColor: index,
                              });
                            }}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className='quantity py-3'>
                      <div className='w-100'>
                        <h5 className='text-danger'>
                          Stock: {product?.stock ?? 0}
                        </h5>
                        <div className='inner'>
                          <button
                            type='button'
                            className='btn-quantity btn-decrease'
                            onClick={() => {
                              setData({
                                ...data,
                                qty: data.qty > 1 ? data.qty - 1 : 1,
                              });
                            }}
                          >
                            -
                          </button>
                          <span className='quantity-product'>{data?.qty}</span>
                          <button
                            type='button'
                            className='btn-quantity btn-increase'
                            onClick={() => {
                              setData({
                                ...data,
                                qty:
                                  product?.stock && data.qty >= product.stock
                                    ? product.stock
                                    : data.qty + 1,
                              });
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className='w-100 pt-5'>
                        {Number(product?.stock) === 0 ? (
                          <button
                            type='button'
                            disabled={true}
                            className='btn not-allow btn-main d-flex w-100 justify-content-center align-items-center gap-2 pill px-sm-5'
                          >
                            <img
                              src='/assets/images/icons/add-to-cart.svg'
                              alt=''
                            />
                            Product out of stock
                          </button>
                        ) : (
                          <button
                            type='button'
                            disabled={createCartLoading}
                            onClick={cartSubmit}
                            className='btn btn-main d-flex w-100 justify-content-center align-items-center gap-2 pill px-sm-5'
                          >
                            <img
                              src='/assets/images/icons/add-to-cart.svg'
                              alt=''
                            />
                            {createCartLoading ? "Loading..." : "Add To Cart"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <ul className='meta-attribute'>
                    <li className='meta-attribute__item'>
                      <span className='name'>Last Update</span>
                      <span className='details'>
                        {formatDate(product?.updatedAt)}
                      </span>
                    </li>
                    <li className='meta-attribute__item'>
                      <span className='name'>Published</span>
                      <span className='details'>
                        {formatDate(product?.createdAt)}
                      </span>
                    </li>
                    <li className='meta-attribute__item'>
                      <span className='name'>Category</span>
                      <span className='details'>{categoryName}</span>
                    </li>
                    <li className='meta-attribute__item'>
                      <span className='name'>Brand</span>
                      <span className='details'>{brandName}</span>
                    </li>
                    <li className='meta-attribute__item'>
                      <span className='name'>Is Discount</span>
                      <span className='details'>
                        {product?.is_discount ? "True" : "False"}
                      </span>
                    </li>
                    {product?.is_discount === true && (
                      <li className='meta-attribute__item'>
                        <span className='name'>Discount Percent</span>
                        <span className='details'>{discount.toFixed(0)}%</span>
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductDetails;