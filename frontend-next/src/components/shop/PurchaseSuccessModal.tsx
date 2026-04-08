"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle, Package, Calendar } from "lucide-react";
import { Confetti, ConfettiRef } from "@/components/ui/confetti";
import { useTheme } from "@/context/ThemeContext";
import { getModalStyle, getTextColors } from "@/utils/themeStyles";
import { cn } from "@/lib/utils";

import { useLanguage } from "@/context/LanguageContext";
import { getLocaleForLang, formatDateLocalized } from "@/lib/dateUtils";

interface PurchaseSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemTitle: string;
  estimatedDeliveryDate?: string;
}

export function PurchaseSuccessModal({
  isOpen,
  onClose,
  itemTitle,
  estimatedDeliveryDate,
}: PurchaseSuccessModalProps) {
  const { t, lang } = useLanguage();
  const { theme } = useTheme();
  const textColors = getTextColors(theme);
  const modalStyle = getModalStyle(theme);
  const confettiRef = useRef<ConfettiRef>(null);

  useEffect(() => {
    if (isOpen && confettiRef.current) {
      setTimeout(() => {
        confettiRef.current?.fire({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#FF4181", "#B938EB", "#FBBF24", "#06B6D4"],
        });
      }, 100);
    }
  }, [isOpen]);

  const deliveryDate = estimatedDeliveryDate
    ? formatDateLocalized(estimatedDeliveryDate, lang, {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <>
      <Confetti ref={confettiRef} manualstart />
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ background: theme === "dark" ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.5)" }}
              onClick={onClose}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="rounded-2xl shadow-xl max-w-md w-full overflow-hidden relative"
                style={modalStyle}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-8 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                    className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
                    style={{
                      background: "linear-gradient(135deg, #10B981 0%, #34D399 100%)",
                    }}
                  >
                    <CheckCircle className="w-12 h-12 text-white" />
                  </motion.div>

                  <motion.h2
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-2xl font-bold mb-2"
                    style={{ color: textColors.primary }}
                  >
                    {t("shopPurchaseSuccess")}
                  </motion.h2>

                  <motion.p
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-lg mb-6"
                    style={{ color: textColors.secondary }}
                  >
                    {itemTitle}
                  </motion.p>

                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="rounded-xl p-4 mb-6"
                    style={{
                      background: theme === "dark" ? "rgba(6,182,212,0.1)" : "rgba(6,182,212,0.05)",
                      border: theme === "dark" ? "1px solid rgba(6,182,212,0.3)" : "1px solid rgba(6,182,212,0.2)",
                    }}
                  >
                    <p className="text-sm text-center mb-3" style={{ color: textColors.secondary }}>
                      {itemTitle === t("shopCartItems") ? t("shopCartItemsHint") : t("shopDeliveryEstimated")}
                    </p>
                    {deliveryDate && (
                      <div className="flex items-center gap-2 justify-center">
                        <Calendar className="w-4 h-4" style={{ color: "#06B6D4" }} />
                        <p className="text-sm" style={{ color: textColors.secondary }}>
                          {itemTitle === t("shopCartItems") ? t("shopCartItemsDeliveryDate") : t("shopDeliveryDateLabel")} {deliveryDate}
                        </p>
                      </div>
                    )}
                  </motion.div>

                  <motion.button
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    onClick={onClose}
                    className={cn(
                      "w-full py-3 rounded-lg font-medium text-white transition-all hover:opacity-90"
                    )}
                    style={{ background: "linear-gradient(135deg, #FF4181 0%, #B938EB 100%)" }}
                  >
                    {t("shopGreat")}
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
