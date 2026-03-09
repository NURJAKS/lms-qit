"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import Image from "next/image";
import { api } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/i18n/translations";
import {
  BookOpen,
  Gift,
  Shirt,
  FileText,
  File,
  Headphones,
  Keyboard,
  Laptop,
  Sparkles,
  HardDrive,
  Pen,
  ShoppingBag,
  Monitor,
  Mouse,
  Video,
  Briefcase,
  Layout,
  Battery,
  ShoppingCart,
  Heart,
  Package,
  Truck,
  CheckCircle,
  X,
  AlertCircle,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { getGlassCardStyle, getTextColors, getDashboardCardStyle } from "@/utils/themeStyles";
import { ProductCard } from "@/components/shop/ProductCard";
import { CartSheet } from "@/components/shop/CartSheet";
import { PurchaseSuccessModal } from "@/components/shop/PurchaseSuccessModal";
import { DeliveryAddressModal, type DeliveryData } from "@/components/shop/DeliveryAddressModal";
import { AnimatedGradientText } from "@/components/ui/animated-gradient-text";
import { NumberTicker } from "@/components/ui/number-ticker";
import { cn } from "@/lib/utils";
import type { User } from "@/types";
import { getLocalizedShopItemTitle, getLocalizedShopItemDesc, CATEGORY_KEYS } from "@/lib/shopUtils";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  BookOpen,
  Gift,
  Shirt,
  FileText,
  File,
  Headphones,
  Keyboard,
  Laptop,
  Sparkles,
  HardDrive,
  Pen,
  Monitor,
  Mouse,
  Video,
  Briefcase,
  Layout,
  Battery,
};

type ShopItem = {
  id: number;
  title: string;
  description: string | null;
  price_coins: number;
  category: string;
  icon_name: string | null;
  image_url: string | null;
};

type Purchase = {
  id: number;
  shop_item_id: number;
  title: string;
  description: string | null;
  category: string;
  icon_name: string | null;
  purchased_at: string | null;
  delivery_status?: string;
  estimated_delivery_date?: string;
  delivered_at?: string | null;
  courier_id?: number | null;
  courier_name?: string | null;
};

type CartItem = {
  id: number;
  shop_item_id: number;
  title: string;
  description: string | null;
  price_coins: number;
  category: string;
  icon_name: string | null;
  image_url: string | null;
  quantity: number;
};

const DELIVERY_STATUS_KEYS: Record<string, string> = {
  cancelled: "shopDeliveryCancelled",
  pending: "shopDeliveryPending",
  processing: "shopDeliveryProcessing",
  shipped: "shopDeliveryShipped",
  delivered: "shopDeliveryDelivered",
};

export default function ShopPage() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const { theme } = useTheme();

  const locale = lang === "ru" ? "ru-RU" : lang === "kk" ? "kk-KZ" : "en-US";
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((s) => s.setAuth);
  const token = useAuthStore((s) => s.token);
  const storeUser = useAuthStore((s) => s.user);
  
  // Получаем актуальные данные пользователя из API
  const { data: currentUser } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data } = await api.get<User>("/users/me");
      // Обновляем store актуальными данными
      if (data && token) {
        setAuth(data, token);
      }
      return data;
    },
  });
  
  const user = currentUser || storeUser;

  useEffect(() => {
    if (user?.role === "parent") {
      router.replace("/app");
    }
  }, [user, router]);

  if (user?.role === "parent") {
    return null;
  }
  const points = user?.points ?? 0;
  const [category, setCategory] = useState<string>("all");
  const [purchasingId, setPurchasingId] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [successItemTitle, setSuccessItemTitle] = useState("");
  const [successDeliveryDate, setSuccessDeliveryDate] = useState<string | undefined>();
  const [pendingPurchase, setPendingPurchase] = useState<{ type: "single" | "cart"; itemId?: number } | null>(null);

  const textColors = getTextColors(theme);
  const cardStyle = getGlassCardStyle(theme);
  const isDark = theme === "dark";

  const { data: items = [] } = useQuery({
    queryKey: ["shop-items", category],
    queryFn: async () => {
      if (category === "favorites") {
        const { data } = await api.get<ShopItem[]>("/shop/favorites");
        return data;
      }
      const url = category === "all" ? "/shop/items" : `/shop/items?category=${category}`;
      const { data } = await api.get<ShopItem[]>(url);
      return data;
    },
  });

  const { data: favorites = [] } = useQuery({
    queryKey: ["shop-favorites"],
    queryFn: async () => {
      const { data } = await api.get<ShopItem[]>("/shop/favorites");
      return data.map((item) => item.id);
    },
  });

  const { data: cartItems = [] } = useQuery({
    queryKey: ["shop-cart"],
    queryFn: async () => {
      const { data } = await api.get<CartItem[]>("/shop/cart");
      return data;
    },
  });

  const { data: myPurchases = [] } = useQuery({
    queryKey: ["shop-my-purchases"],
    queryFn: async () => {
      const { data } = await api.get<Purchase[]>("/shop/my-purchases");
      return data;
    },
  });

  const favoriteIds = new Set(favorites);
  const isFavorite = (itemId: number) => favoriteIds.has(itemId);

  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ itemId, isFavorite }: { itemId: number; isFavorite: boolean }) => {
      if (isFavorite) {
        await api.delete(`/shop/items/${itemId}/favorite`);
      } else {
        await api.post(`/shop/items/${itemId}/favorite`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shop-favorites"] });
      if (category === "favorites") {
        queryClient.invalidateQueries({ queryKey: ["shop-items", "favorites"] });
      }
    },
  });

  const addToCartMutation = useMutation({
    mutationFn: async (itemId: number) => {
      await api.post(`/shop/cart/add?item_id=${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shop-cart"] });
    },
  });

  const removeFromCartMutation = useMutation({
    mutationFn: async (itemId: number) => {
      await api.delete(`/shop/cart/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shop-cart"] });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ estimated_delivery_date: string }>("/shop/cart/checkout");
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["shop-items"] });
      queryClient.invalidateQueries({ queryKey: ["shop-my-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["shop-cart"] });
      const { data: freshUser } = await api.get<typeof user>("/users/me");
      const token = useAuthStore.getState().token;
      if (freshUser && token) useAuthStore.getState().setAuth(freshUser, token);
      setIsCartOpen(false);
      setSuccessItemTitle(t("shopCartItems"));
      setSuccessDeliveryDate(data.estimated_delivery_date);
      setShowSuccessModal(true);
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { detail?: string }; status?: number }; message?: string };
      const errorMessage = err?.response?.data?.detail || err?.message || t("shopCheckoutError");
      alert(errorMessage);
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: async (itemId: number) => {
      const { data } = await api.post<{ estimated_delivery_date: string }>(`/shop/items/${itemId}/purchase`);
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["shop-items"] });
      queryClient.invalidateQueries({ queryKey: ["shop-my-purchases"] });
      const { data: freshUser } = await api.get<typeof user>("/users/me");
      const token = useAuthStore.getState().token;
      if (freshUser && token) useAuthStore.getState().setAuth(freshUser, token);
      setPurchasingId(null);
      setSelectedItem(null);
      setSuccessItemTitle(items.find((i) => i.id === purchasingId)?.title || "");
      setSuccessDeliveryDate(data.estimated_delivery_date);
      setShowSuccessModal(true);
    },
    onError: (error: unknown) => {
      setPurchasingId(null);
      const err = error as { response?: { data?: { detail?: string }; status?: number }; message?: string };
      const errorMessage = err?.response?.data?.detail || err?.message || t("shopPurchaseError");
      alert(errorMessage);
    },
  });

  const cancelPurchaseMutation = useMutation({
    mutationFn: async (purchaseId: number) => {
      const { data } = await api.post<{ refund_amount: number; message: string }>(`/shop/purchases/${purchaseId}/cancel`);
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["shop-my-purchases"] });
      const { data: freshUser } = await api.get<typeof user>("/users/me");
      const token = useAuthStore.getState().token;
      if (freshUser && token) useAuthStore.getState().setAuth(freshUser, token);
      alert(data.message);
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { detail?: string }; status?: number }; message?: string };
      const errorMessage = err?.response?.data?.detail || err?.message || t("shopCancelOrderError");
      alert(errorMessage);
    },
  });

  const handlePurchase = (item: ShopItem) => {
    if (points < item.price_coins) return;
    setPendingPurchase({ type: "single", itemId: item.id });
    setShowDeliveryModal(true);
  };

  const handleDeliverySubmit = (deliveryData: DeliveryData) => {
    setShowDeliveryModal(false);
    if (pendingPurchase?.type === "single" && pendingPurchase.itemId) {
      setPurchasingId(pendingPurchase.itemId);
      purchaseMutation.mutate(pendingPurchase.itemId);
    } else if (pendingPurchase?.type === "cart") {
      checkoutMutation.mutate();
    }
    setPendingPurchase(null);
  };

  const handleAddToCart = (item: ShopItem) => {
    addToCartMutation.mutate(item.id);
  };

  const handleToggleFavorite = (item: ShopItem) => {
    toggleFavoriteMutation.mutate({ itemId: item.id, isFavorite: isFavorite(item.id) });
  };

  const handleRemoveFromCart = (itemId: number) => {
    removeFromCartMutation.mutate(itemId);
  };

  const handleCheckout = () => {
    setPendingPurchase({ type: "cart" });
    setShowDeliveryModal(true);
  };

  const totalCartCost = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.price_coins * item.quantity, 0),
    [cartItems]
  );

  const getDeliveryStatusColor = (status?: string) => {
    switch (status) {
      case "delivered":
        return "#10B981";
      case "shipped":
        return "#3B82F6";
      case "processing":
        return "#F59E0B";
      case "cancelled":
        return "#EF4444";
      default:
        return "#64748B";
    }
  };

  const getDeliveryProgress = (purchase: Purchase) => {
    switch (purchase.delivery_status) {
      case "delivered":
        return 100;
      case "shipped":
        return 75;
      case "processing":
        return 50;
      case "cancelled":
        return 0;
      default:
        return 25;
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedItem(null);
        setIsCartOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="relative min-h-screen">
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-3" style={{ color: textColors.primary }}>
            <ShoppingBag className="w-10 h-10" style={{ background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }} />
            <AnimatedGradientText colorFrom="#FF4181" colorTo="#B938EB" speed={1.5}>
              {t("shopTitle")}
            </AnimatedGradientText>
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative flex items-center gap-2 px-4 py-2 rounded-xl transition-all hover:scale-105"
              style={cardStyle}
            >
              <ShoppingCart className="w-6 h-6 shrink-0" style={{ color: "#FF4181" }} />
              <span className="text-sm font-medium hidden sm:inline" style={{ color: "#FF4181" }}>
                {t("shopCart")}
              </span>
              {cartItems.length > 0 && (
                <span
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)" }}
                >
                  {cartItems.length}
                </span>
              )}
            </button>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl border-0 backdrop-blur-sm" style={{ ...cardStyle, border: isDark ? "1px solid rgba(251, 191, 36, 0.3)" : "1px solid rgba(251, 191, 36, 0.2)" }}>
              <Image src="/icons/coin.png" alt="coins" width={24} height={24} />
              <NumberTicker value={points} className="font-semibold" style={{ color: "#FBBF24" }} />
              <span className="text-sm" style={{ color: "#FBBF24" }}>{t("shopCoins")}</span>
            </div>
          </div>
        </div>

        {myPurchases.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: textColors.primary }}>
              <Gift className="w-5 h-5" style={{ color: "#06B6D4" }} />
              {t("shopMyPurchases")}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {myPurchases.map((p) => {
                const IconComponent = p.icon_name ? ICON_MAP[p.icon_name] ?? Gift : Gift;
                const progress = getDeliveryProgress(p);
                return (
                  <div
                    key={p.id}
                    className="rounded-xl border-0 backdrop-blur-sm p-4 flex flex-col gap-3 card-glow-hover"
                    style={{ ...cardStyle, border: isDark ? "1px solid rgba(6, 182, 212, 0.3)" : "1px solid rgba(6, 182, 212, 0.2)" }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0" style={{ background: isDark ? "rgba(6, 182, 212, 0.2)" : "rgba(6, 182, 212, 0.1)" }}>
                        <IconComponent className="w-6 h-6" style={{ color: "#06B6D4" }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium truncate" style={{ color: textColors.primary }}>{getLocalizedShopItemTitle(p as any, t)}</h3>
                        {p.purchased_at && (
                          <p className="text-xs mt-0.5" style={{ color: textColors.secondary }}>
                            {new Date(p.purchased_at).toLocaleDateString(locale)}
                          </p>
                        )}
                      </div>
                    </div>
                    {p.delivery_status && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span style={{ color: textColors.secondary }}>{t("shopDeliveryStatus")}</span>
                          <span style={{ color: getDeliveryStatusColor(p.delivery_status) }}>
                            {DELIVERY_STATUS_KEYS[p.delivery_status] ? t(DELIVERY_STATUS_KEYS[p.delivery_status] as any) : p.delivery_status}
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }}>
                          <div
                            className="h-full transition-all duration-500 rounded-full"
                            style={{
                              width: `${progress}%`,
                              background: `linear-gradient(90deg, ${getDeliveryStatusColor(p.delivery_status)} 0%, ${getDeliveryStatusColor(p.delivery_status)}80 100%)`,
                            }}
                          />
                        </div>
                        {p.delivery_status === "delivered" && p.delivered_at && (
                          <div className="flex items-center gap-1 text-xs" style={{ color: "#10B981" }}>
                            <CheckCircle className="w-3 h-3" />
                            <span>{t("shopDeliveredOn")} {new Date(p.delivered_at).toLocaleDateString(locale)}</span>
                          </div>
                        )}
                        {p.delivery_status !== "delivered" && p.estimated_delivery_date && (
                          <div className="flex items-center gap-1 text-xs" style={{ color: textColors.secondary }}>
                            <Truck className="w-3 h-3" />
                            <span>{t("shopExpectedOn")} {new Date(p.estimated_delivery_date).toLocaleDateString(locale)}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {p.delivery_status !== "delivered" && p.delivery_status !== "cancelled" && (
                      <button
                        onClick={() => {
                          if (confirm(t("shopCancelOrderConfirm"))) {
                            cancelPurchaseMutation.mutate(p.id);
                          }
                        }}
                        disabled={cancelPurchaseMutation.isPending}
                        className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          background: "rgba(239, 68, 68, 0.1)",
                          color: "#EF4444",
                          border: "1px solid rgba(239, 68, 68, 0.3)",
                        }}
                      >
                        {cancelPurchaseMutation.isPending ? (
                          <>
                            <AlertCircle className="w-3.5 h-3.5 animate-spin" />
                            <span>{t("shopCancelling")}</span>
                          </>
                        ) : (
                          <>
                            <X className="w-3.5 h-3.5" />
                            <span>{t("shopCancelOrder")}</span>
                          </>
                        )}
                      </button>
                    )}
                    {p.delivery_status === "cancelled" && (
                      <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs" style={{ background: "rgba(239, 68, 68, 0.1)", color: "#EF4444" }}>
                        <X className="w-3.5 h-3.5" />
                        <span>{t("shopOrderCancelled")}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-6">
          {Object.entries(CATEGORY_KEYS).map(([id, key]) => (
            <button
              key={id}
              type="button"
              onClick={() => setCategory(id)}
              className={cn("py-1.5 px-3 rounded-lg text-sm font-medium transition-all")}
              style={
                category === id
                  ? { background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)", color: "#FFFFFF" }
                  : { ...cardStyle, color: textColors.secondary, border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.06)" }
              }
              onMouseEnter={(e) => {
                if (category !== id) {
                  e.currentTarget.style.color = textColors.primary;
                  e.currentTarget.style.background = isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.05)";
                }
              }}
              onMouseLeave={(e) => {
                if (category !== id) {
                  e.currentTarget.style.color = textColors.secondary;
                  e.currentTarget.style.background = cardStyle.background;
                }
              }}
            >
              {id === "favorites" && <Heart className="w-3 h-3 inline mr-1" />}
              {t(key as TranslationKey)}
            </button>
          ))}
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item, index) => {
            const IconComponent = item.icon_name ? ICON_MAP[item.icon_name] ?? Gift : Gift;
            const canBuy = points >= item.price_coins;
            const isPurchasing = purchasingId === item.id && purchaseMutation.isPending;

            return (
              <ProductCard
                key={item.id}
                item={item}
                canBuy={canBuy}
                isPurchasing={isPurchasing}
                isFavorite={isFavorite(item.id)}
                onPurchase={handlePurchase}
                onAddToCart={handleAddToCart}
                onToggleFavorite={handleToggleFavorite}
                onSelect={setSelectedItem}
                IconComponent={IconComponent}
                index={index}
              />
            );
          })}
        </div>

        {items.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: textColors.secondary }} />
            <p className="text-lg font-medium mb-2" style={{ color: textColors.primary }}>
              {category === "favorites" ? t("shopNoFavorites") : t("shopNoItems")}
            </p>
            <p className="text-sm" style={{ color: textColors.secondary }}>
              {category === "favorites" ? t("shopFavoritesHint") : t("shopTryOtherCategory")}
            </p>
          </div>
        )}

        {selectedItem && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: isDark ? "rgba(0, 0, 0, 0.5)" : "rgba(0, 0, 0, 0.3)" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-detail-title"
            onClick={() => setSelectedItem(null)}
          >
            <div
              className="rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto backdrop-blur-xl border"
              style={{ ...getDashboardCardStyle(theme), border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(0, 0, 0, 0.1)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-start gap-4 mb-6">
                  {selectedItem.image_url ? (
                    <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0 relative bg-gray-100 dark:bg-gray-700">
                      <Image
                        src={selectedItem.image_url}
                        alt={selectedItem.title}
                        width={96}
                        height={96}
                        className="w-full h-full object-cover"
                        unoptimized={selectedItem.image_url.startsWith("http")}
                      />
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-xl flex items-center justify-center shrink-0 bg-pink-100 dark:bg-pink-500/10">
                      {(() => {
                        const Icon = ICON_MAP[selectedItem.icon_name ?? ""] ?? Gift;
                        return <Icon className="w-12 h-12 text-pink-600 dark:text-pink-400" />;
                      })()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h2 id="product-detail-title" className="text-xl font-bold mb-2" style={{ color: textColors.primary }}>
                      {getLocalizedShopItemTitle(selectedItem as any, t)}
                    </h2>
                    <div className="flex items-center gap-2 font-semibold">
                      <Image src="/icons/coin.png" alt="" width={20} height={20} />
                      <span style={{ color: "#FBBF24" }}>{selectedItem.price_coins}</span>
                      <span className="text-sm font-normal" style={{ color: textColors.secondary }}>{t("shopCoins")}</span>
                    </div>
                    <p className="text-sm mt-1" style={{ color: textColors.secondary }}>
                      {t("shopProductCategory")}: {t((CATEGORY_KEYS[selectedItem.category] ?? "shopOther") as TranslationKey)}
                    </p>
                  </div>
                </div>

                {selectedItem.description && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold mb-2" style={{ color: textColors.primary }}>{t("shopProductDescription")}</h3>
                    <p style={{ color: textColors.secondary }}>{getLocalizedShopItemDesc(selectedItem as any, t)}</p>
                  </div>
                )}

                <div className="mb-6 p-4 rounded-xl border" style={{ borderColor: isDark ? "rgba(251,191,36,0.3)" : "rgba(251,191,36,0.2)", background: isDark ? "rgba(251,191,36,0.1)" : "rgba(251,191,36,0.05)" }}>
                  <p className="text-sm" style={{ color: isDark ? "#FBBF24" : "#D97706" }}>{t("shopProductMotivation")}</p>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedItem(null)}
                    className="flex-1 py-2.5 rounded-lg font-medium transition-colors"
                    style={{
                      color: textColors.primary,
                      background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
                      border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)",
                    }}
                  >
                    {t("shopProductClose")}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (points >= selectedItem.price_coins) {
                        handlePurchase(selectedItem);
                        setSelectedItem(null);
                      }
                    }}
                    disabled={points < selectedItem.price_coins || purchasingId === selectedItem.id}
                    className={cn("flex-1 py-2.5 rounded-lg font-medium transition-all", points >= selectedItem.price_coins ? "text-white hover:opacity-90" : "cursor-not-allowed opacity-50")}
                    style={points >= selectedItem.price_coins ? { background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)" } : { background: "rgba(0,0,0,0.1)", color: textColors.secondary }}
                  >
                    {purchasingId === selectedItem.id && purchaseMutation.isPending
                      ? t("shopBuying")
                      : points >= selectedItem.price_coins
                        ? t("shopBuy")
                        : t("shopNotEnoughCoins")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <CartSheet
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          items={cartItems}
          onRemove={handleRemoveFromCart}
          onCheckout={handleCheckout}
          totalCost={totalCartCost}
          userBalance={points}
          IconComponentMap={ICON_MAP}
        />

        <PurchaseSuccessModal
          isOpen={showSuccessModal}
          onClose={() => setShowSuccessModal(false)}
          itemTitle={successItemTitle}
          estimatedDeliveryDate={successDeliveryDate}
        />

        <DeliveryAddressModal
          isOpen={showDeliveryModal}
          onClose={() => {
            setShowDeliveryModal(false);
            setPendingPurchase(null);
          }}
          onSubmit={handleDeliverySubmit}
          isSubmitting={purchaseMutation.isPending || checkoutMutation.isPending}
        />
      </div>
    </div>
  );
}
