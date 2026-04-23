import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Star, ShoppingCart, Heart, Share2, CheckCircle, Truck, Shield, MessageCircle, Plus, Minus } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useToast } from '../hooks/use-toast';
import { productAPI } from '../api/service';
import { getApiErrorMessage } from '@/utils/apiError';
import { logger } from '@/utils/logger';
import { normalizeProductIdParam, productDetailPath } from '../utils/productId';
import { getDisplayProductTitle } from '../utils/productDisplay';

const ProductDetailPage = ({ onAddToCart }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    const param = normalizeProductIdParam(id);
    if (!param) {
      setProduct(null);
      setLoading(false);
      toast({ title: 'Invalid link', description: 'No product id in the URL.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const response = await productAPI.getById(param);
      const data = response.data;
      const canonicalId = data.id || data._id;
      if (canonicalId && canonicalId !== param) {
        navigate(productDetailPath(canonicalId), { replace: true });
      }
      setProduct(data);
    } catch (error) {
      logger.error('Error fetching product:', error);
      const detail = getApiErrorMessage(error, 'Product not found');
      toast({
        title: 'Unable to load product',
        description: detail,
        variant: 'destructive'
      });
      setProduct(null);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    onAddToCart({ ...product, quantity });
    toast({
      title: 'Added to cart',
      description: `${quantity} x ${getDisplayProductTitle(product)} added to your cart.`,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50/50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50/50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center px-4">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Product not found</h2>
          <Button onClick={() => navigate('/products')} className="bg-[#5BA3D0] hover:bg-[#4A8FB8]">
            Browse Products
          </Button>
        </div>
      </div>
    );
  }

  const images = product.images && product.images.length > 0 ? product.images : [product.image, product.image, product.image];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50/50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8 py-4 md:py-8">
        <div className="bg-white dark:bg-gray-800/80 rounded-2xl shadow-soft p-4 md:p-8 border border-gray-100 dark:border-gray-800">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-12">
            {/* Image Gallery */}
            <div>
              <div className="aspect-square rounded-lg overflow-hidden mb-4 bg-gray-100 dark:bg-gray-700">
                <img
                  src={images[selectedImage]}
                  alt={displayTitle}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex gap-2 md:gap-4 overflow-x-auto pb-2">
                {images.slice(0, 3).map((img, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`w-16 h-16 md:w-20 md:h-20 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                      selectedImage === index ? 'border-[#5BA3D0]' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* Product Info */}
            <div>
              <div className="mb-4">
                {product.tags && product.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {product.tags.map((tag, index) => (
                      <span key={index} className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-[#5BA3D0] text-xs rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-2">{displayTitle}</h1>
                <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-200 md:text-base">
                  {product.description}
                </p>
              </div>

              <div className="space-y-2 mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-1">
                  <Star className="w-5 h-5 fill-[#7BB8DC] text-[#7BB8DC]" />
                  <span className="font-bold text-gray-900 dark:text-gray-100">{product.rating}</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{product.orders} orders</p>
                <div className="flex items-baseline gap-3 pt-1">
                  <div className="text-3xl md:text-4xl font-bold text-[#5BA3D0]">${product.price}</div>
                  {product.originalPrice && (
                    <div className="text-lg text-gray-500 dark:text-gray-400 line-through">${product.originalPrice}</div>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">MOQ: {product.moq ?? 1} pieces</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  <span className="font-medium text-gray-800 dark:text-gray-200">Dispatch:</span>{' '}
                  <span className={product.featuredSale ? 'text-green-700 dark:text-green-400' : ''}>
                    {product.featuredSale ? 'High demand - fast dispatch' : 'Standard dispatch'}
                  </span>
                </p>
                {product.verified ? (
                  <div className="inline-flex items-center gap-1 rounded-full bg-green-50 dark:bg-green-950/40 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800 w-fit">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Verified
                  </div>
                ) : null}
                <p className="text-sm text-gray-600 dark:text-gray-400">{product.category || 'General'}</p>
              </div>

              {/* Quantity Selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quantity</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-10 h-10 flex items-center justify-center border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Minus className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                  </button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 h-10 text-center border border-gray-300 dark:border-gray-600 bg-background text-foreground rounded-lg focus:ring-2 focus:ring-[#5BA3D0] focus:border-transparent"
                  />
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-10 h-10 flex items-center justify-center border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Plus className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <Button
                  onClick={handleAddToCart}
                  className="flex-1 bg-[#5BA3D0] hover:bg-[#4A90B8] text-white h-10 text-sm sm:text-base"
                >
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  Add to Cart
                </Button>
              </div>

              {/* Features */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <Truck className="w-5 h-5 text-[#5BA3D0]" />
                  <span className="text-gray-700 dark:text-gray-300">Fast Delivery</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="w-5 h-5 text-[#5BA3D0]" />
                  <span className="text-gray-700 dark:text-gray-300">Secure Payment</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MessageCircle className="w-5 h-5 text-[#5BA3D0]" />
                  <span className="text-gray-700 dark:text-gray-300">24/7 Support</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPage;