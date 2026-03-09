"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { X, ShoppingCart, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import { getGlassCardStyle, getTextColors } from "@/utils/themeStyles";
import { cn } from "@/lib/utils";

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

interface CartSheetProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onRemove: (itemId: number) => void;
  onCheckout: () => void;
  totalCost: number;
  userBalance: number;
  IconComponentMap: Record<string, React.ComponentType<{ className?: string }>>;
}

export function CartSheet({
  isOpen,
  onClose,
  items,
  onRemove,
  onCheckout,
  totalCost,
  userBalance,
  IconComponentMap,
}: CartSheetProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const textColors = getTextColors(theme);
  const cardStyle = getGlassCardStyle(theme);
  const canCheckout = userBalance >= totalCost && items.length > 0;

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md overflow-hidden"
            style={cardStyle}
          >
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b p-4" style={{ borderColor: theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }}>
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" style={{ color: "#FF4181" }} />
                  <h2 className="text-lg font-semibold" style={{ color: textColors.primary }}>
                    {t("shopCart")}
                  </h2>
                  {items.length > 0 && (
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{
                        background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)",
                        color: "#FFFFFF",
                      }}
                    >
                      {items.length}
                    </span>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="rounded-lg p-1.5 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X className="w-5 h-5" style={{ color: textColors.secondary }} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {items.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <ShoppingCart className="w-16 h-16 mb-4 opacity-20" style={{ color: textColors.secondary }} />
                    <p className="text-lg font-medium mb-2" style={{ color: textColors.primary }}>
                      {t("shopCartEmpty")}
                    </p>
                    <p className="text-sm" style={{ color: textColors.secondary }}>
                      {t("shopAddItemsToCart")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {items.map((item) => {
                      const IconComponent = item.icon_name
                        ? IconComponentMap[item.icon_name] ?? ShoppingCart
                        : ShoppingCart;
                      return (
                        <div
                          key={item.id}
                          className="rounded-lg p-3 flex items-start gap-3"
                          style={{
                            ...cardStyle,
                            border: theme === "dark" ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.06)",
                          }}
                        >
                          <div
                            className="w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center shrink-0"
                            style={theme === "dark" ? { background: "rgba(255,65,129,0.1)" } : { background: "rgba(255,65,129,0.08)" }}
                          >
                            {item.image_url ? (
                              <Image
                                src={item.image_url}
                                alt={item.title}
                                width={48}
                                height={48}
                                className="w-full h-full object-cover"
                                unoptimized={item.image_url.startsWith("http")}
                              />
                            ) : (
                              <IconComponent className="w-6 h-6 text-[#FF4181]" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium truncate" style={{ color: textColors.primary }}>
                              {item.title}
                            </h3>
                            <div className="flex items-center justify-between mt-1">
                              <div className="flex items-center gap-1">
                                <Image src="/icons/coin.png" alt="" width={14} height={14} />
                                <span className="text-sm font-medium" style={{ color: "#FBBF24" }}>
                                  {item.price_coins} × {item.quantity}
                                </span>
                              </div>
                              <button
                                onClick={() => onRemove(item.shop_item_id)}
                                className="p-1 rounded hover:bg-red-500/10 text-red-500 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {items.length > 0 && (
                <div
                  className="border-t p-4 space-y-3"
                  style={{ borderColor: theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium" style={{ color: textColors.primary }}>
                      {t("shopTotal")}:
                    </span>
                    <div className="flex items-center gap-1">
                      <Image src="/icons/coin.png" alt="" width={18} height={18} />
                      <span className="text-lg font-bold" style={{ color: "#FBBF24" }}>
                        {totalCost}
                      </span>
                    </div>
                  </div>
                  {userBalance < totalCost && (
                    <p className="text-sm text-red-500">
                      {t("shopNotEnoughCoins")}. {t("shopNeedMoreCoins")} {totalCost - userBalance} coins
                    </p>
                  )}
                  <button
                    onClick={onCheckout}
                    disabled={!canCheckout}
                    className={cn(
                      "w-full py-3 rounded-lg font-medium text-white transition-all",
                      canCheckout
                        ? "hover:opacity-90"
                        : "opacity-50 cursor-not-allowed"
                    )}
                    style={
                      canCheckout
                        ? { background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)" }
                        : { background: "rgba(0,0,0,0.1)" }
                    }
                  >
                    {t("shopCheckout")}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
