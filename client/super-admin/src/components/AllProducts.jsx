import ReactQuill from "react-quill-new";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  DeleteAlert,
  ErrorToast,
  formats,
  IsEmpty,
  modules,
} from "../helper/helper";
import Paginate from "../helper/Paginate";
import productStore from "../store/productStore";
import categoryStore from "../store/categoryStore";
import brandStore from "../store/brandStore";
import { useEffect, useState } from "react";
import Skeleton from "react-loading-skeleton";
import { baseURLFile, hostURL } from "../helper/config";

const PLACEHOLDER_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
      <rect width="80" height="80" fill="#f1f3f5"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#868e96" font-family="Arial, sans-serif" font-size="11">No Image</text>
    </svg>`
  );

const AllProducts = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const {
    allProducts,
    totalProducts,
    allProductsRequest,
    deleteProductRequest,
    updateProductRequest,
    singleProductsRequest,
  } = productStore();
  const { allCategoryRequest, allCategory } = categoryStore();
  const { allBrandRequest, allBrand } = brandStore();

  const per_page = 12;
  const page_no = Number(searchParams.get("page_no")) || 1;

  // Fetch products, categories, and brands
  useEffect(() => {
    (async () => {
      await allProductsRequest(0, 0, 0, 0, per_page, page_no);
      await allCategoryRequest(100, 1);
      await allBrandRequest(100, 1);
    })();
  }, [allBrandRequest, allCategoryRequest, allProductsRequest, page_no]);

  const handelPageClick = async (event) => {
    const nextPage = event.selected + 1;
    await allProductsRequest(0, 0, 0, 0, per_page, nextPage);
    navigate(`/all-products?page_no=${nextPage}`);
  };

  // Delete product
  const deleteProduct = async (_id) => {
    const res = await DeleteAlert(deleteProductRequest, _id);
    if (res) {
      await allProductsRequest(0, 0, 0, 0, per_page, page_no);
    }
  };

  // Edit modal state (keep raw comma-separated strings while typing so spaces/commas don't break editing)
  const [data, setData] = useState({
    title: "",
    imagesText: "",
    sort_description: "",
    price: "",
    is_discount: false,
    discount_price: 0,
    remark: "",
    stock: 0,
    colorText: "",
    sizeText: "",
    description: "",
    category_id: "",
    brand_id: "",
  });
  const [value, setValue] = useState("");
  const [_id, setId] = useState("");

  const toCommaString = (arr) => (Array.isArray(arr) ? arr.join(", ") : arr || "");
  const toStringArray = (val) =>
    Array.isArray(val)
      ? val.map((item) => String(item).trim()).filter(Boolean)
      : String(val || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

  const readSingleProduct = async (productId) => {
    if (!productId) {
      return ErrorToast("Product ID is missing!");
    }

    const res = await singleProductsRequest(productId);
    const product = res?.data && !Array.isArray(res.data) ? res.data : res;

    if (product) {
      setId(product?._id || productId || "");
      setData({
        title: product?.title || "",
        imagesText: toCommaString(product?.images),
        sort_description: product?.sort_description || "",
        price: product?.price ?? "",
        is_discount: Boolean(product?.is_discount),
        discount_price: product?.discount_price ?? 0,
        remark: product?.remark || "",
        stock: product?.stock ?? 0,
        colorText: toCommaString(product?.color),
        sizeText: toCommaString(product?.size),
        description: product?.description || "",
        category_id: product?.category_id || "",
        brand_id: product?.brand_id || "",
      });
      setValue(product?.description || "");
    }
  };

  const updateProduct = async () => {
    if (!_id) {
      return ErrorToast("Invalid product ID. Please reopen Edit and try again.");
    }

    const payload = {
      title: data.title,
      images: toStringArray(data.imagesText),
      sort_description: data.sort_description,
      price: Number(data.price),
      is_discount: Boolean(data.is_discount),
      discount_price: Number(data.discount_price),
      remark: data.remark,
      stock: Number(data.stock),
      color: toStringArray(data.colorText),
      size: toStringArray(data.sizeText),
      description: value,
      category_id: data.category_id,
      brand_id: data.brand_id,
    };

    const validations = [
      { field: payload.title, message: "Title is required!" },
      { field: payload.images.length ? payload.images : "", message: "Images is required!" },
      { field: payload.sort_description, message: "Sort description is required!" },
      { field: data.price === "" ? "" : payload.price, message: "Price is required!" },
      { field: payload.remark, message: "Remark is required!" },
      { field: data.stock === "" ? "" : payload.stock, message: "Stock is required!" },
      { field: payload.color.length ? payload.color : "", message: "Color is required!" },
      { field: payload.size.length ? payload.size : "", message: "Size is required!" },
      { field: payload.description, message: "Description is required!" },
      { field: payload.category_id, message: "Category is required!" },
      { field: payload.brand_id, message: "Brand is required!" },
    ];

    for (const { field, message } of validations) {
      if (IsEmpty(field)) {
        return ErrorToast(message);
      }
    }

    const res = await updateProductRequest(_id, payload);
    if (res) {
      await allProductsRequest(0, 0, 0, 0, per_page, page_no);
    }
  };

  const getProductImageUrl = (item) => {
    const firstImg = item?.images?.[0];
    if (!firstImg || firstImg === "/placeholder.png" || firstImg === "placeholder.png") {
      return PLACEHOLDER_IMAGE;
    }
    if (firstImg.startsWith("http://") || firstImg.startsWith("https://")) {
      return firstImg;
    }
    return `${baseURLFile}/${firstImg}`;
  };

  const hasMoreThanOnePage = Number(totalProducts || 0) > per_page;

  return (
    <>
      {/* Cover Photo Start */}
      <div className="cover-photo overflow-hidden">
        <div className="avatar-upload p-5">
          <h2>Super Admin</h2>
          <h5>All Product</h5>
        </div>
      </div>

      <div className="dashboard-body__content mt-0">
        <div className="row gy-4">
          <div className="col-12">
            <div className="card common-card border border-gray-five">
              <div className="card-body">
                <div className="table-responsive">
                  <table className="table text-body">
                    <thead>
                      <tr>
                        <th>Image</th>
                        <th>Title</th>
                        <th>Price</th>
                        <th>Is Discount</th>
                        <th>Stock</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.isArray(allProducts) && allProducts.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center">
                            No data found!
                          </td>
                        </tr>
                      )}

                      {allProducts === null ? (
                        [...Array(6)].map((_, skeletonIdx) => (
                          <tr key={`skeleton-${skeletonIdx}`} className="super_admin_all-product">
                            <td className="Skeleton"><Skeleton count={1} /></td>
                            <td className="Skeleton"><Skeleton count={1} /></td>
                            <td className="Skeleton"><Skeleton count={1} /></td>
                            <td className="Skeleton"><Skeleton count={1} /></td>
                            <td className="Skeleton"><Skeleton count={1} /></td>
                            <td className="Skeleton"><Skeleton count={1} /></td>
                          </tr>
                        ))
                      ) : (
                        allProducts?.map((item, index) => (
                          <tr
                            key={item?._id || `product-${index}`}
                            className="super_admin_all-product"
                          >
                            <td>
                              <img
                                src={getProductImageUrl(item)}
                                alt={item?.title || "Product"}
                                className="cover-img"
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = PLACEHOLDER_IMAGE;
                                }}
                              />
                            </td>
                            <td>
                              <h6 className="product-item__title">
                                <a
                                  href={`${hostURL}/product-details?product_id=${item?._id}`}
                                  className="link"
                                >
                                  {item?.title}
                                </a>
                              </h6>
                            </td>
                            <td>
                              <div className="flx-align justify-content-center gap-2">
                                <h6 className="product-item__price mb-0">
                                  {!item?.is_discount
                                    ? `৳${item?.price}`
                                    : `৳${item?.discount_price}`}
                                </h6>
                                {item?.is_discount && (
                                  <span className="product-item__prevPrice font-12 text-danger text-decoration-line-through">
                                    ৳{item?.price}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>{item?.is_discount ? "Yes" : "No"}</td>
                            <td>{item?.stock}</td>
                            <td>
                              <div className="d-flex justify-content-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => readSingleProduct(item?._id)}
                                  className="btn btn-success"
                                  data-bs-toggle="modal"
                                  data-bs-target="#exampleModal_1"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteProduct(item?._id)}
                                  className="btn btn-danger"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  {hasMoreThanOnePage && (
                    <div className="flx-between justify-content-end gap-2">
                      <nav aria-label="Page navigation example">
                        <Paginate
                          handelPageClick={handelPageClick}
                          page_no={page_no}
                          per_page={per_page}
                          totalCount={totalProducts}
                        />
                      </nav>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Update Product Modal */}
      <div
        className="modal fade"
        id="exampleModal_1"
        tabIndex={-1}
        aria-labelledby="exampleModalLabel"
        aria-hidden="true"
      >
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h6 className="modal-title fs-5" id="exampleModalLabel">
                Update Product
              </h6>
              <button
                type="button"
                className="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              />
            </div>
            <div className="modal-body">
              <div className="profile">
                <div className="row gy-4">
                  <div className="col-12">
                    <div className="dashboard-card">
                      <div className="profile-info-content">
                        <div className="tab-content" id="pills-tabContent">
                          <div className="tab-pane fade show active">
                            <div className="row gy-4">
                              <div className="col-sm-6 col-xs-6">
                                <label className="form-label mb-2 font-18 font-heading fw-600">
                                  Title
                                </label>
                                <input
                                  onChange={(e) =>
                                    setData({ ...data, title: e.target.value })
                                  }
                                  value={data.title}
                                  type="text"
                                  className="common-input border"
                                />
                              </div>

                              <div className="col-sm-6 col-xs-6">
                                <label className="form-label mb-2 font-18 font-heading fw-600">
                                  Short Description
                                </label>
                                <input
                                  onChange={(e) =>
                                    setData({
                                      ...data,
                                      sort_description: e.target.value,
                                    })
                                  }
                                  value={data.sort_description}
                                  type="text"
                                  className="common-input border"
                                />
                              </div>

                              <div className="col-12">
                                <label className="form-label mb-2 font-18 font-heading fw-600">
                                  Image (Use comma for multi images. Ex: image_1.png, image_2.jpg)
                                </label>
                                <textarea
                                  onChange={(e) =>
                                    setData({
                                      ...data,
                                      imagesText: e.target.value,
                                    })
                                  }
                                  value={data.imagesText}
                                  className="common-input border"
                                />
                              </div>

                              <div className="col-sm-4 col-xs-4">
                                <label className="form-label mb-2 font-18 font-heading fw-600">
                                  Price
                                </label>
                                <input
                                  onChange={(e) =>
                                    setData({
                                      ...data,
                                      price:
                                        e.target.value === ""
                                          ? ""
                                          : Number(e.target.value),
                                    })
                                  }
                                  value={data.price}
                                  type="number"
                                  className="common-input border"
                                />
                              </div>

                              <div className="col-sm-4 col-xs-4">
                                <label className="form-label mb-2 font-18 font-heading fw-600">
                                  Is Discount?
                                </label>
                                <div className="select-has-icon">
                                  <select
                                    className="common-input border"
                                    onChange={(e) =>
                                      setData({
                                        ...data,
                                        is_discount: e.target.value === "true",
                                      })
                                    }
                                    value={String(data.is_discount)}
                                  >
                                    <option value="true">True</option>
                                    <option value="false">False</option>
                                  </select>
                                </div>
                              </div>

                              <div className="col-sm-4 col-xs-4">
                                <label className="form-label mb-2 font-18 font-heading fw-600">
                                  Discount Price
                                </label>
                                <input
                                  onChange={(e) =>
                                    setData({
                                      ...data,
                                      discount_price:
                                        e.target.value === ""
                                          ? ""
                                          : Number(e.target.value),
                                    })
                                  }
                                  value={data.discount_price}
                                  type="number"
                                  className="common-input border"
                                />
                              </div>

                              <div className="col-sm-4 col-xs-4">
                                <label className="form-label mb-2 font-18 font-heading fw-600">
                                  Category
                                </label>
                                <div className="select-has-icon">
                                  <select
                                    className="common-input border"
                                    onChange={(e) =>
                                      setData({
                                        ...data,
                                        category_id: e.target.value,
                                      })
                                    }
                                    value={data.category_id}
                                  >
                                    <option value="">
                                      Please Select A Category **
                                    </option>
                                    {allCategory?.map((cat, idx) => (
                                      <option
                                        key={cat?._id || `cat-${idx}`}
                                        value={cat?._id}
                                      >
                                        {cat?.category_name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              <div className="col-sm-4 col-xs-4">
                                <label className="form-label mb-2 font-18 font-heading fw-600">
                                  Brand
                                </label>
                                <div className="select-has-icon">
                                  <select
                                    className="common-input border"
                                    onChange={(e) =>
                                      setData({
                                        ...data,
                                        brand_id: e.target.value,
                                      })
                                    }
                                    value={data.brand_id}
                                  >
                                    <option value="">
                                      Please Select A Brand **
                                    </option>
                                    {allBrand?.map((brand, idx) => (
                                      <option
                                        key={brand?._id || `brand-${idx}`}
                                        value={brand?._id}
                                      >
                                        {brand?.brand_name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              <div className="col-sm-4 col-xs-4">
                                <label className="form-label mb-2 font-18 font-heading fw-600">
                                  Remark (Ex: New)
                                </label>
                                <input
                                  onChange={(e) =>
                                    setData({ ...data, remark: e.target.value })
                                  }
                                  value={data.remark}
                                  type="text"
                                  className="common-input border"
                                />
                              </div>

                              <div className="col-sm-4 col-xs-4">
                                <label className="form-label mb-2 font-18 font-heading fw-600">
                                  Stock
                                </label>
                                <input
                                  onChange={(e) =>
                                    setData({
                                      ...data,
                                      stock:
                                        e.target.value === ""
                                          ? ""
                                          : Number(e.target.value),
                                    })
                                  }
                                  value={data.stock}
                                  type="number"
                                  className="common-input border"
                                />
                              </div>

                              <div className="col-sm-4 col-xs-4">
                                <label className="form-label mb-2 font-18 font-heading fw-600">
                                  Color (Ex: Red, Green, Blue)
                                </label>
                                <input
                                  onChange={(e) =>
                                    setData({
                                      ...data,
                                      colorText: e.target.value,
                                    })
                                  }
                                  value={data.colorText}
                                  type="text"
                                  className="common-input border"
                                />
                              </div>

                              <div className="col-sm-4 col-xs-4">
                                <label className="form-label mb-2 font-18 font-heading fw-600">
                                  Size (Ex: XXL, XL, X)
                                </label>
                                <input
                                  onChange={(e) =>
                                    setData({
                                      ...data,
                                      sizeText: e.target.value,
                                    })
                                  }
                                  value={data.sizeText}
                                  type="text"
                                  className="common-input border"
                                />
                              </div>

                              <div className="col-12">
                                <label className="form-label mb-2 font-18 font-heading fw-600">
                                  Description
                                </label>
                                <ReactQuill
                                  theme="snow"
                                  modules={modules}
                                  formats={formats}
                                  value={value}
                                  onChange={setValue}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                data-bs-dismiss="modal"
              >
                Close
              </button>
              <button
                onClick={updateProduct}
                data-bs-dismiss="modal"
                type="button"
                className="btn btn-primary"
              >
                Update Product
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AllProducts;