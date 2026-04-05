"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
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
  LayoutGrid,
  ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "@/context/ThemeContext";
import { getGlassCardStyle, getTextColors, getDashboardCardStyle } from "@/utils/themeStyles";
import { ProductCard } from "@/components/shop/ProductCard";
import { CartSheet } from "@/components/shop/CartSheet";
import { PurchaseSuccessModal } from "@/components/shop/PurchaseSuccessModal";
import { DeliveryAddressModal, type DeliveryData } from "@/components/shop/DeliveryAddressModal";
import { ShopSkeleton } from "@/components/shop/ShopSkeleton";
import { AnimatedGradientText } from "@/components/ui/animated-gradient-text";
import { NumberTicker } from "@/components/ui/number-ticker";
import { DeleteConfirmButton } from "@/components/ui/DeleteConfirmButton";
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
  original_price?: number;
  category: string;
  icon_name: string | null;
  image_url: string | null;
  has_premium_discount?: boolean;
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

type CartItem = ShopItem & {
  shop_item_id: number;
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
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);

  const textColors = getTextColors(theme);
  const cardStyle = getGlassCardStyle(theme);
  const isDark = theme === "dark";

  const { data: items = [], isLoading: isItemsLoading } = useQuery({
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
    placeholderData: keepPreviousData,
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
    onMutate: async ({ itemId, isFavorite }) => {
      await queryClient.cancelQueries({ queryKey: ["shop-favorites"] });
      await queryClient.cancelQueries({ queryKey: ["shop-items", "favorites"] });

      const prevFavoriteIds = queryClient.getQueryData<number[]>(["shop-favorites"]);
      const prevFavoriteItems = queryClient.getQueryData<ShopItem[]>(["shop-items", "favorites"]);

      // Optimistically update favorites IDs
      queryClient.setQueryData<number[]>(["shop-favorites"], (old = []) => {
        const set = new Set(old);
        if (isFavorite) set.delete(itemId);
        else set.add(itemId);
        return Array.from(set);
      });

      // Optimistically update favorites list items (used by category === "favorites")
      queryClient.setQueryData<ShopItem[]>(["shop-items", "favorites"], (old = []) => {
        if (isFavorite) {
          return old.filter((x) => x.id !== itemId);
        }
        const exists = old.some((x) => x.id === itemId);
        if (exists) return old;
        const found = items.find((x) => x.id === itemId);
        return found ? [found, ...old] : old;
      });

      return { prevFavoriteIds, prevFavoriteItems };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx) return;
      queryClient.setQueryData(["shop-favorites"], ctx.prevFavoriteIds);
      queryClient.setQueryData(["shop-items", "favorites"], ctx.prevFavoriteItems);
    },
    onSuccess: () => {
      // Always invalidate favorites list so switching tab refetches even with refetchOnMount=false
      queryClient.invalidateQueries({ queryKey: ["shop-favorites"] });
      queryClient.invalidateQueries({ queryKey: ["shop-items", "favorites"] });
    },
    onSettled: () => {
      // Ensure eventual consistency with backend
      queryClient.invalidateQueries({ queryKey: ["shop-favorites"] });
      queryClient.invalidateQueries({ queryKey: ["shop-items", "favorites"] });
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

  const updateCartQuantityMutation = useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: number; quantity: number }) => {
      await api.patch(`/shop/cart/${itemId}?quantity=${quantity}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shop-cart"] });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ estimated_delivery_date: string; new_balance?: number }>("/shop/cart/checkout");
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["shop-items"] });
      queryClient.invalidateQueries({ queryKey: ["shop-my-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["shop-cart"] });
      // Сразу обновляем баланс из ответа API и рефетчим полные данные пользователя
      if (typeof data.new_balance === "number") {
        const currentStoreUser = useAuthStore.getState().user;
        const currentToken = useAuthStore.getState().token;
        if (currentStoreUser && currentToken) {
          useAuthStore.getState().setAuth({ ...currentStoreUser, points: data.new_balance }, currentToken);
        }
      }
      queryClient.invalidateQueries({ queryKey: ["me"] });
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
      const { data } = await api.post<{ estimated_delivery_date: string; new_balance?: number }>(`/shop/items/${itemId}/purchase`);
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["shop-items"] });
      queryClient.invalidateQueries({ queryKey: ["shop-my-purchases"] });
      // Сразу обновляем баланс из ответа API
      if (typeof data.new_balance === "number") {
        const currentStoreUser = useAuthStore.getState().user;
        const currentToken = useAuthStore.getState().token;
        if (currentStoreUser && currentToken) {
          useAuthStore.getState().setAuth({ ...currentStoreUser, points: data.new_balance }, currentToken);
        }
      }
      queryClient.invalidateQueries({ queryKey: ["me"] });
      setPurchasingId(null);
      setSelectedItem(null);
      const purchased = items.find((i) => i.id === purchasingId);
      setSuccessItemTitle(purchased ? getLocalizedShopItemTitle(purchased as any, lang, t) : "");
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
      const { data } = await api.post<{ refund_amount: number; message: string; new_balance?: number }>(`/shop/purchases/${purchaseId}/cancel`);
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["shop-my-purchases"] });
      // Сразу обновляем баланс из ответа API
      if (typeof data.new_balance === "number") {
        const currentStoreUser = useAuthStore.getState().user;
        const currentToken = useAuthStore.getState().token;
        if (currentStoreUser && currentToken) {
          useAuthStore.getState().setAuth({ ...currentStoreUser, points: data.new_balance }, currentToken);
        }
      }
      queryClient.invalidateQueries({ queryKey: ["me"] });
      alert(data.message);
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { detail?: string }; status?: number }; message?: string };
      const errorMessage = err?.response?.data?.detail || err?.message || t("shopCancelOrderError");
      alert(errorMessage);
    },
  });

  const deletePurchaseMutation = useMutation({
    mutationFn: async (purchaseId: number) => {
      await api.delete(`/shop/purchases/${purchaseId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shop-my-purchases"] });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { detail?: string }; status?: number }; message?: string };
      const errorMessage = err?.response?.data?.detail || err?.message || t("shopDeletePurchaseError");
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

  const handleUpdateCartQuantity = (itemId: number, quantity: number) => {
    updateCartQuantityMutation.mutate({ itemId, quantity });
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
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 sm:gap-3" style={{ color: textColors.primary }}>
            <ShoppingBag className="w-10 h-10" style={{ background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }} />
            <AnimatedGradientText colorFrom="#FF4181" colorTo="#B938EB" speed={1.5}>
              {t("shopTitle")}
            </AnimatedGradientText>
          </h1>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl transition-all hover:scale-105 min-h-[2.5rem]"
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
            <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl border-0 backdrop-blur-sm min-h-[2.5rem]" style={{ ...cardStyle, border: isDark ? "1px solid rgba(251, 191, 36, 0.3)" : "1px solid rgba(251, 191, 36, 0.2)" }}>
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
                        <h3 className="font-medium truncate" style={{ color: textColors.primary }}>{getLocalizedShopItemTitle(p as any, lang, t)}</h3>
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
                      <DeleteConfirmButton
                        onDelete={() => cancelPurchaseMutation.mutate(p.id)}
                        isLoading={cancelPurchaseMutation.isPending}
                        text={t("shopCancelOrder")}
                        title={t("shopCancelOrderConfirm")}
                        description={t("confirmDelete")}
                        size="sm"
                        className="w-full justify-center"
                      />
                    )}
                    {p.delivery_status === "cancelled" && (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs" style={{ background: "rgba(239, 68, 68, 0.1)", color: "#EF4444" }}>
                          <X className="w-3.5 h-3.5" />
                          <span>{t("shopOrderCancelled")}</span>
                        </div>
                        <DeleteConfirmButton
                          onDelete={() => deletePurchaseMutation.mutate(p.id)}
                          isLoading={deletePurchaseMutation.isPending}
                          text={t("shopDeletePurchase")}
                          title={t("shopDeletePurchaseConfirm")}
                          description={t("confirmDelete")}
                          size="sm"
                          className="w-full justify-center"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="relative mb-8">
          <button
            onClick={() => setIsCategoryMenuOpen(!isCategoryMenuOpen)}
            className="flex items-center gap-2.5 px-5 py-3 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-pink-500/20 font-semibold group min-h-[3rem]"
            style={{ 
              background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)",
              color: "#FFFFFF"
            }}
          >
            <div className="p-1.5 rounded-lg bg-white/20 group-hover:rotate-12 transition-transform">
              <LayoutGrid className="w-5 h-5" />
            </div>
            <div className="flex flex-col items-start leading-tight">
              <span className="text-[10px] opacity-70 uppercase tracking-wider">{t("shopCategory")}</span>
              <span className="text-sm">{t(CATEGORY_KEYS[category] as TranslationKey)}</span>
            </div>
            <ChevronDown className={cn("ml-2 w-5 h-5 transition-transform duration-300", isCategoryMenuOpen && "rotate-180")} />
          </button>

          <AnimatePresence>
            {isCategoryMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-20" 
                  onClick={() => setIsCategoryMenuOpen(false)} 
                />
                <motion.div
                  initial={{ opacity: 0, y: 15, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 15, scale: 0.95 }}
                  className="absolute top-[calc(100%+0.75rem)] left-0 z-30 p-3 rounded-[2rem] shadow-2xl backdrop-blur-2xl border w-full max-w-sm sm:max-w-md grid grid-cols-2 sm:grid-cols-2 gap-2"
                  style={{ 
                    ...getDashboardCardStyle(theme), 
                    border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid rgba(0, 0, 0, 0.08)",
                    boxShadow: isDark ? "0 20px 40px rgba(0,0,0,0.4)" : "0 20px 40px rgba(0,0,0,0.1)"
                  }}
                >
                  {Object.entries(CATEGORY_KEYS).map(([id, key]) => (
                    <button
                      key={id}
                      onClick={() => {
                        setCategory(id);
                        setIsCategoryMenuOpen(false);
                      }}
                      className={cn(
                        "flex items-center gap-3 p-3.5 rounded-2xl text-sm font-medium transition-all duration-200 group/item",
                        category === id 
                          ? "bg-pink-500/10 dark:bg-pink-500/20" 
                          : "hover:bg-black/5 dark:hover:bg-white/5"
                      )}
                    >
                      <div 
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                          category === id 
                            ? "bg-pink-500 text-white" 
                            : "bg-black/5 dark:bg-white/10 text-gray-400 group-hover/item:text-pink-500"
                        )}
                      >
                        {id === "favorites" ? (
                          <Heart className={cn("w-4 h-4", category === id ? "fill-current" : "")} />
                        ) : (
                          <ShoppingCart className="w-4 h-4" />
                        )}
                      </div>
                      <span 
                        className="truncate" 
                        style={{ color: category === id ? "#FF4181" : textColors.primary }}
                      >
                        {t(key as TranslationKey)}
                      </span>
                      {category === id && (
                         <div className="ml-auto w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse" />
                      )}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <div className="grid gap-3 sm:gap-4 lg:gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {!isItemsLoading && items.map((item, index) => {
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

        {isItemsLoading && <ShopSkeleton />}

        {!isItemsLoading && items.length === 0 && (
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
                      {getLocalizedShopItemTitle(selectedItem as any, lang, t)}
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
                    <p style={{ color: textColors.secondary }}>{getLocalizedShopItemDesc(selectedItem as any, lang, t)}</p>
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
          onUpdateQuantity={handleUpdateCartQuantity}
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
