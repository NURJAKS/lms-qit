"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import React from "react";
import Image from "next/image";
import { api } from "@/api/client";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { getGlassCardStyle, getTextColors, getInputStyle, getModalStyle } from "@/utils/themeStyles";
import { Truck, Package, CheckCircle, Clock, User, Search, X, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatLocalizedDate } from "@/utils/dateUtils";


type Courier = {
  id: number;
  full_name: string;
  email: string;
  phone?: string | null;
  deliveries_count: number;
  pending_deliveries: number;
  delivered_count: number;
};

type CourierDelivery = {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  shop_item_id: number;
  item_title: string;
  item_price_coins: number;
  purchased_at: string | null;
  delivery_status: string;
  estimated_delivery_date: string | null;
  delivered_at: string | null;
};

const DELIVERY_STATUSES = [
  { value: "pending", color: "#64748B" },
  { value: "processing", color: "#F59E0B" },
  { value: "shipped", color: "#3B82F6" },
  { value: "delivered", color: "#10B981" },
  { value: "cancelled", color: "#EF4444" },
];

interface CourierListViewProps {
  initialCourierId?: number | null;
}

export function CourierListView({ initialCourierId = null }: CourierListViewProps = {}) {
  const { t, lang } = useLanguage();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const textColors = getTextColors(theme);
  const cardStyle = getGlassCardStyle(theme);
  const isDark = theme === "dark";

  const [selectedCourierId, setSelectedCourierId] = useState<number | null>(initialCourierId);
  const [search, setSearch] = useState("");
  const [showAddCourierModal, setShowAddCourierModal] = useState(false);

  // Обновляем selectedCourierId когда изменяется initialCourierId
  React.useEffect(() => {
    if (initialCourierId !== null && initialCourierId !== undefined) {
      setSelectedCourierId(initialCourierId);
    }
  }, [initialCourierId]);

  const { data: couriers = [] } = useQuery({
    queryKey: ["admin-shop-couriers"],
    queryFn: async () => {
      const { data } = await api.get<Courier[]>("/admin/shop/purchases/couriers");
      return data;
    },
  });

  const { data: courierDeliveries } = useQuery({
    queryKey: ["admin-courier-deliveries", selectedCourierId],
    queryFn: async () => {
      if (!selectedCourierId) return null;
      const { data } = await api.get<{ courier: Courier; deliveries: CourierDelivery[] }>(
        `/admin/shop/purchases/courier/${selectedCourierId}`
      );
      return data;
    },
    enabled: !!selectedCourierId,
  });

  const filteredCouriers = couriers.filter((courier) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      courier.full_name.toLowerCase().includes(searchLower) ||
      courier.email.toLowerCase().includes(searchLower) ||
      (courier.phone && courier.phone.toLowerCase().includes(searchLower))
    );
  });

  const getStatusColor = (status: string) => {
    return DELIVERY_STATUSES.find((s) => s.value === status)?.color || "#64748B";
  };

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: t("adminShopStatusPending"),
      processing: t("adminShopStatusProcessing"),
      shipped: t("adminShopStatusShipped"),
      delivered: t("adminShopStatusDelivered"),
      cancelled: t("adminShopStatusCancelled"),
    };
    return statusMap[status] || status;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "delivered":
        return <CheckCircle className="w-4 h-4" />;
      case "shipped":
        return <Truck className="w-4 h-4" />;
      case "cancelled":
        return <X className="w-4 h-4" />;
      case "processing":
        return <Package className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  return (
       <div className="space-y-6 pb-24 lg:pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
        <h1 className="text-xl sm:text-3xl font-bold flex items-center gap-2 sm:gap-3 min-w-0" style={{ color: textColors.primary }}>
          <Truck className="w-7 h-7 sm:w-8 sm:h-8 shrink-0" style={{ color: "#06B6D4" }} />
          <span className="break-words">{t("adminShopCouriersAndDeliveries")}</span>
        </h1>
        <button
          onClick={() => setShowAddCourierModal(true)}
          className="w-full sm:w-auto shrink-0 px-4 py-2.5 rounded-lg font-medium text-white text-sm transition-all hover:opacity-90 flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)" }}
        >
          <UserPlus className="w-5 h-5 shrink-0" />
          {t("adminShopAddCourier")}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Список курьеров */}
        <div className="lg:w-1/3 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: textColors.secondary }} />
            <input
              type="text"
              placeholder={t("adminShopSearchCourier")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg"
              style={getInputStyle(theme)}
            />
          </div>

          <div className="space-y-3">
            {filteredCouriers.length === 0 ? (
              <div className="text-center py-12 rounded-xl" style={cardStyle}>
                <Truck className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: textColors.secondary }} />
                <p className="text-lg font-medium mb-2" style={{ color: textColors.primary }}>
                  {t("adminShopCouriersNotFound")}
                </p>
                <p className="text-sm" style={{ color: textColors.secondary }}>
                  {search ? t("adminShopTryDifferentSearch") : t("adminShopAssignCouriersHint")}
                </p>
              </div>
            ) : (
              filteredCouriers.map((courier) => (
                <div
                  key={courier.id}
                  onClick={() => setSelectedCourierId(courier.id)}
                  className={cn(
                    "rounded-xl p-4 cursor-pointer transition-all",
                    selectedCourierId === courier.id && "ring-2",
                    selectedCourierId === courier.id && (isDark ? "ring-cyan-500" : "ring-cyan-400")
                  )}
                  style={{
                    ...cardStyle,
                    border: isDark ? "1px solid rgba(6,182,212,0.3)" : "1px solid rgba(6,182,212,0.2)",
                    background:
                      selectedCourierId === courier.id
                        ? isDark
                          ? "rgba(6,182,212,0.1)"
                          : "rgba(6,182,212,0.05)"
                        : cardStyle.background,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: "rgba(6,182,212,0.2)" }}
                    >
                      <User className="w-6 h-6" style={{ color: "#06B6D4" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base mb-1" style={{ color: textColors.primary }}>
                        {courier.full_name}
                      </h3>
                      <p className="text-xs mb-2" style={{ color: textColors.secondary }}>
                        {courier.email}
                      </p>
                      {courier.phone && (
                        <p className="text-xs mb-2" style={{ color: textColors.secondary }}>
                          {courier.phone}
                        </p>
                      )}
                      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mt-2 w-full min-w-0">
                        <div className="min-w-0 px-0.5">
                          <div
                            className="text-[10px] sm:text-xs leading-tight break-words"
                            style={{ color: textColors.secondary }}
                          >
                            {t("adminShopTotal")}
                          </div>
                          <div className="text-sm font-bold tabular-nums" style={{ color: textColors.primary }}>
                            {courier.deliveries_count}
                          </div>
                        </div>
                        <div className="min-w-0 px-0.5">
                          <div
                            className="text-[10px] sm:text-xs leading-tight break-words"
                            style={{ color: "#F59E0B" }}
                          >
                            {t("adminShopInWork")}
                          </div>
                          <div className="text-sm font-bold tabular-nums" style={{ color: "#F59E0B" }}>
                            {courier.pending_deliveries}
                          </div>
                        </div>
                        <div className="min-w-0 px-0.5">
                          <div
                            className="text-[10px] sm:text-xs leading-tight break-words"
                            style={{ color: "#10B981" }}
                          >
                            {t("adminShopDelivered")}
                          </div>
                          <div className="text-sm font-bold tabular-nums" style={{ color: "#10B981" }}>
                            {courier.delivered_count}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Детали курьера и его доставки */}
        <div className="lg:w-2/3">
          {selectedCourierId && courierDeliveries ? (
            <div className="space-y-4">
              <div className="rounded-xl p-6" style={cardStyle}>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: textColors.primary }}>
                  <User className="w-6 h-6" style={{ color: "#06B6D4" }} />
                  {courierDeliveries.courier.full_name}
                </h2>
                <div className="grid grid-cols-3 gap-2 sm:gap-4 min-w-0">
                  <div className="min-w-0">
                    <div
                      className="text-xs sm:text-sm mb-1 leading-tight break-words"
                      style={{ color: textColors.secondary }}
                    >
                      {t("adminShopTotalDeliveries")}
                    </div>
                    <div className="text-2xl font-bold tabular-nums" style={{ color: textColors.primary }}>
                      {courierDeliveries.deliveries.length}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div
                      className="text-xs sm:text-sm mb-1 leading-tight break-words"
                      style={{ color: "#F59E0B" }}
                    >
                      {t("adminShopInWork")}
                    </div>
                    <div className="text-2xl font-bold tabular-nums" style={{ color: "#F59E0B" }}>
                      {courierDeliveries.deliveries.filter((d) => d.delivery_status !== "delivered").length}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div
                      className="text-xs sm:text-sm mb-1 leading-tight break-words"
                      style={{ color: "#10B981" }}
                    >
                      {t("adminShopDelivered")}
                    </div>
                    <div className="text-2xl font-bold tabular-nums" style={{ color: "#10B981" }}>
                      {courierDeliveries.deliveries.filter((d) => d.delivery_status === "delivered").length}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl overflow-hidden" style={cardStyle}>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)" }}>
                        <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: textColors.primary }}>
                          {t("adminShopProduct")}
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: textColors.primary }}>
                          {t("adminShopStudent")}
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: textColors.primary }}>
                          {t("adminShopStatus")}
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: textColors.primary }}>
                          {t("adminShopDeliveryDate")}
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: textColors.primary }}>
                          {t("adminShopPurchaseDate")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {courierDeliveries.deliveries.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center">
                            <Package className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: textColors.secondary }} />
                            <p className="text-sm" style={{ color: textColors.secondary }}>
                              {t("adminShopNoDeliveriesForCourier")}
                            </p>
                          </td>
                        </tr>
                      ) : (
                        courierDeliveries.deliveries.map((delivery) => (
                          <tr
                            key={delivery.id}
                            className="hover:bg-opacity-50 transition-colors"
                            style={{ borderBottom: isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(0,0,0,0.05)" }}
                          >
                            <td className="px-4 py-3">
                              <div className="font-medium text-sm" style={{ color: textColors.primary }}>
                                {delivery.item_title}
                              </div>
                              <div className="flex items-center gap-1 mt-1">
                                <Image src="/icons/coin.png" alt="" width={12} height={12} />
                                <span className="text-xs" style={{ color: "#FBBF24" }}>
                                  {delivery.item_price_coins}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm" style={{ color: textColors.primary }}>
                                {delivery.user_name}
                              </div>
                              <div className="text-xs" style={{ color: textColors.secondary }}>
                                {delivery.user_email}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div
                                className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium w-fit"
                                style={{
                                  background: `${getStatusColor(delivery.delivery_status)}20`,
                                  color: getStatusColor(delivery.delivery_status),
                                }}
                              >
                                {getStatusIcon(delivery.delivery_status)}
                                {getStatusLabel(delivery.delivery_status)}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {delivery.delivery_status === "delivered" && delivery.delivered_at ? (
                                <div className="flex items-center gap-1.5">
                                  <CheckCircle className="w-3.5 h-3.5" style={{ color: "#10B981" }} />
                                  <span className="text-sm" style={{ color: "#10B981" }}>
                                    {formatLocalizedDate(delivery.delivered_at, lang as any, t)}

                                  </span>
                                </div>
                              ) : delivery.estimated_delivery_date ? (
                                <div className="flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5" style={{ color: textColors.secondary }} />
                                  <span className="text-sm" style={{ color: textColors.secondary }}>
                                    {t("adminShopExpected")} {formatLocalizedDate(delivery.estimated_delivery_date, lang as any, t)}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs" style={{ color: textColors.secondary }}>
                                  -
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm" style={{ color: textColors.secondary }}>
                              {delivery.purchased_at
                                ? formatLocalizedDate(delivery.purchased_at, lang as any, t)
                                : "-"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl p-12 text-center" style={cardStyle}>
              <Truck className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: textColors.secondary }} />
              <p className="text-lg font-medium mb-2" style={{ color: textColors.primary }}>
                {t("adminShopSelectCourierFromList")}
              </p>
              <p className="text-sm" style={{ color: textColors.secondary }}>
                {t("adminShopSelectCourierHint")}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Модальное окно добавления курьера */}
      {showAddCourierModal && (
        <AddCourierModal
          onClose={() => setShowAddCourierModal(false)}
          onSuccess={() => {
            setShowAddCourierModal(false);
            queryClient.invalidateQueries({ queryKey: ["admin-shop-couriers"] });
          }}
        />
      )}
    </div>
  );
}

function AddCourierModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const textColors = getTextColors(theme);
  const modalStyle = getModalStyle(theme);
  const inputStyle = getInputStyle(theme);
  const isDark = theme === "dark";
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("courier");

  const createCourierMutation = useMutation({
    mutationFn: async (data: {
      email: string;
      password: string;
      full_name: string;
      role: string;
      phone?: string;
    }) => {
      await api.post("/admin/users", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-shop-couriers"] });
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createCourierMutation.mutate({
      email,
      password,
      full_name: fullName,
      role,
      phone: phone || undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: isDark ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl shadow-xl max-w-md w-full p-6"
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: textColors.primary }}>
          <UserPlus className="w-6 h-6" style={{ color: "#06B6D4" }} />
          {t("adminShopAddCourier")}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>
              Email *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 rounded-lg"
              style={inputStyle}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>
              {t("adminShopFullName")} *
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-2 rounded-lg"
              style={inputStyle}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>
              {t("password")} *
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-lg"
              style={inputStyle}
              required
              minLength={6}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>
              {t("adminShopPhone")}
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2 rounded-lg"
              style={inputStyle}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: textColors.secondary }}>
              {t("role")}
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-2 rounded-lg"
              style={inputStyle}
              disabled
            >
              <option value="courier">{t("adminShopCourierRole")}</option>
            </select>
            <p className="text-xs mt-1" style={{ color: textColors.secondary }}>
              {t("adminShopCourierRoleHint")}
            </p>
          </div>

          {createCourierMutation.isError && (
            <div className="text-sm text-red-500">
              {t("adminShopCourierCreateError")}
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg font-medium transition-colors"
              style={{
                color: textColors.primary,
                background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
                border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)",
              }}
            >
              {t("adminShopCancel")}
            </button>
            <button
              type="submit"
              disabled={createCourierMutation.isPending}
              className="flex-1 py-2.5 rounded-lg font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)" }}
            >
              {createCourierMutation.isPending ? t("adminShopCreating") : t("adminShopCreate")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
