"use client";

import { useState } from "react";
import Image from "next/image";
import { Heart, ShoppingCart, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { MagicCard } from "@/components/ui/magic-card";
import { BorderBeam } from "@/components/ui/border-beam";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import { getTextColors } from "@/utils/themeStyles";
import { cn } from "@/lib/utils";
import { getLocalizedShopItemTitle, getLocalizedShopItemDesc } from "@/lib/shopUtils";

type ShopItem = {
  id: number;
  title: string;
  description: string | null;
  price_coins: number;
  category: string;
  icon_name: string | null;
  image_url: string | null;
};

interface ProductCardProps {
  item: ShopItem;
  canBuy: boolean;
  isPurchasing: boolean;
  isFavorite: boolean;
  onPurchase: (item: ShopItem) => void;
  onAddToCart: (item: ShopItem) => void;
  onToggleFavorite: (item: ShopItem) => void;
  onSelect: (item: ShopItem) => void;
  IconComponent: React.ComponentType<{ className?: string }>;
  index?: number;
}

export function ProductCard({
  item,
  canBuy,
  isPurchasing,
  isFavorite,
  onPurchase,
  onAddToCart,
  onToggleFavorite,
  onSelect,
  IconComponent,
  index = 0,
}: ProductCardProps) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const textColors = getTextColors(theme);
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.4,
        delay: index * 0.05,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      whileHover={{ y: -8, scale: 1.02 }}
      className="h-full"
    >
      <MagicCard
        className="relative overflow-hidden h-full group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <motion.div
          className="rounded-xl p-5 flex flex-col cursor-pointer backdrop-blur-sm relative z-10 h-full"
          onClick={() => onSelect(item)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onSelect(item)}
          whileHover={{ scale: 1.01 }}
          transition={{ duration: 0.2 }}
        >
          {/* Header with image and favorite */}
          <div className="flex items-start justify-between mb-4">
            <motion.div
              className="flex items-center gap-3 flex-1 min-w-0"
              initial={false}
              animate={{ x: isHovered ? 2 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                className={cn(
                  "w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center shrink-0 relative",
                  theme === "dark" ? "bg-[rgba(255,65,129,0.15)]" : "bg-[rgba(255,65,129,0.1)]",
                  "shadow-lg shadow-pink-500/20"
                )}
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                {item.image_url ? (
                  <>
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-br from-pink-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    />
                    <Image
                      src={item.image_url}
                      alt={item.title}
                      width={56}
                      height={56}
                      className={cn(
                        "w-full h-full object-cover transition-transform duration-500",
                        isHovered && "scale-110"
                      )}
                      unoptimized={item.image_url.startsWith("http")}
                      onLoad={() => setImageLoaded(true)}
                    />
                    <AnimatePresence>
                      {imageLoaded && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0"
                        />
                      )}
                    </AnimatePresence>
                  </>
                ) : (
                  <motion.div
                    animate={isHovered ? { rotate: 10 } : { rotate: 0 }}
                    transition={{ duration: 0.5, type: "tween" }}
                  >
                    <IconComponent className="w-7 h-7 text-[#FF4181]" />
                  </motion.div>
                )}
              </motion.div>
              <div className="min-w-0 flex-1">
                <motion.h3
                  className="font-semibold truncate text-base mb-1"
                  style={{ color: textColors.primary }}
                  whileHover={{ x: 2 }}
                  transition={{ duration: 0.2 }}
                >
                  {getLocalizedShopItemTitle(item as any, t)}
                </motion.h3>
                <motion.div
                  className="flex items-center gap-1.5"
                  initial={false}
                  animate={{ scale: isHovered ? 1.05 : 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <motion.div
                    animate={isHovered ? { rotate: 15 } : { rotate: 0 }}
                    transition={{ duration: 0.6, type: "tween" }}
                  >
                    <Image src="/icons/coin.png" alt="" width={18} height={18} />
                  </motion.div>
                  <motion.span
                    className="font-bold text-lg"
                    style={{ color: "#FBBF24" }}
                    animate={isHovered ? { scale: [1, 1.1, 1] } : {}}
                    transition={{ duration: 0.4 }}
                  >
                    {item.price_coins}
                  </motion.span>
                </motion.div>
              </div>
            </motion.div>
            <motion.button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(item);
              }}
              className={cn(
                "p-2 rounded-xl shrink-0 relative overflow-hidden",
                isFavorite
                  ? "bg-gradient-to-br from-red-500/20 to-pink-500/20 text-red-500"
                  : "bg-transparent text-gray-400 hover:text-red-500"
              )}
              whileHover={{ scale: 1.1, rotate: 10 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <AnimatePresence mode="wait">
                {isFavorite ? (
                  <motion.div
                    key="filled"
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 180 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  >
                    <Heart className="w-5 h-5 fill-current" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="outline"
                    initial={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Heart className="w-5 h-5" />
                  </motion.div>
                )}
              </AnimatePresence>
              {isFavorite && (
                <motion.div
                  className="absolute inset-0 bg-red-500/10"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 2 }}
                />
              )}
            </motion.button>
          </div>

          {/* Description */}
          {item.description && (
            <motion.p
              className="text-sm mb-4 flex-1 line-clamp-2 leading-relaxed"
              style={{ color: textColors.secondary }}
              initial={false}
              animate={{ opacity: isHovered ? 1 : 0.8 }}
              transition={{ duration: 0.2 }}
            >
              {getLocalizedShopItemDesc(item as any, t)}
            </motion.p>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 mt-auto">
            <motion.button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (canBuy) {
                  onPurchase(item);
                }
              }}
              disabled={!canBuy || isPurchasing}
              className={cn(
                "flex-1 py-2.5 rounded-xl font-semibold text-sm relative overflow-hidden",
                canBuy
                  ? "text-white shadow-lg shadow-pink-500/30"
                  : "cursor-not-allowed",
                theme === "dark"
                  ? canBuy
                    ? ""
                    : "bg-[rgba(26,34,56,0.5)] text-[#94A3B8]"
                  : canBuy
                    ? ""
                    : "bg-[rgba(0,0,0,0.05)] text-[#64748B]"
              )}
              style={
                canBuy
                  ? { background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)" }
                  : undefined
              }
              whileHover={canBuy ? { scale: 1.02, y: -2 } : {}}
              whileTap={canBuy ? { scale: 0.98 } : {}}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              {canBuy && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  animate={{
                    x: ["-100%", "100%"],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    repeatDelay: 1,
                    ease: "linear",
                  }}
                />
              )}
              <span className="relative z-10">
                {isPurchasing ? (
                  <motion.span
                    className="inline-flex items-center gap-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <Sparkles className="w-4 h-4" />
                    </motion.span>
                    {t("purchasing")}
                  </motion.span>
                ) : canBuy ? (
                  t("buyCourse")
                ) : (
                  t("notEnoughCoins")
                )}
              </span>
            </motion.button>
            <motion.button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddToCart(item);
              }}
              disabled={!canBuy}
              className={cn(
                "px-4 py-2.5 rounded-xl relative overflow-hidden",
                canBuy
                  ? "bg-gradient-to-br from-blue-500/10 to-cyan-500/10 text-blue-500 hover:from-blue-500/20 hover:to-cyan-500/20 shadow-md shadow-blue-500/10"
                  : "bg-[rgba(0,0,0,0.05)] text-gray-400 cursor-not-allowed"
              )}
              whileHover={canBuy ? { scale: 1.1, rotate: 5 } : {}}
              whileTap={canBuy ? { scale: 0.9 } : {}}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              title={t("addToCart")}
            >
              <ShoppingCart className="w-5 h-5" />
              {canBuy && isHovered && (
                <motion.div
                  className="absolute inset-0 bg-blue-500/10"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1.5, opacity: 0 }}
                  transition={{ duration: 0.4 }}
                />
              )}
            </motion.button>
          </div>
        </motion.div>

        {/* Enhanced Border Beam */}
        <BorderBeam
          size={120}
          duration={8}
          colorFrom="#FF4181"
          colorTo="#B938EB"
          delay={0}
          borderWidth={2}
        />

        {/* Hover glow effect */}
        <motion.div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none"
          style={{
            background: "radial-gradient(circle at 50% 0%, rgba(255, 65, 129, 0.1), transparent 70%)",
          }}
          transition={{ duration: 0.3 }}
        />
      </MagicCard>
    </motion.div>
  );
}
