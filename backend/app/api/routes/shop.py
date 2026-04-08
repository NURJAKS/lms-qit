"""Q Market - магазин за coins."""
from typing import Annotated
from datetime import datetime, timedelta
import random

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.shop_item import ShopItem
from app.models.user_purchase import UserPurchase
from app.models.user_favorite import UserFavorite
from app.models.cart_item import CartItem
from app.services.coins import spend_coins, add_coins, get_user_balance

router = APIRouter(prefix="/shop", tags=["shop"])

PREMIUM_SHOP_DISCOUNT = 0.15  # 15% discount for premium users


def get_discounted_price(price: int, is_premium: bool) -> int:
    """Calculate discounted price for premium users."""
    if not is_premium:
        return price
    return int(price * (1 - PREMIUM_SHOP_DISCOUNT))


@router.get("/items")
def list_shop_items(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    category: str | None = Query(None),
):
    """Список товаров магазина."""
    q = db.query(ShopItem).filter(ShopItem.is_active == 1)
    if category:
        q = q.filter(ShopItem.category == category)
    items = q.order_by(ShopItem.price_coins).all()
    is_premium = bool(current_user.is_premium)
    return [
        {
            "id": i.id,
            "title": i.title,
            "description": i.description,
            "price_coins": get_discounted_price(i.price_coins, is_premium),
            "original_price": i.price_coins,
            "category": i.category,
            "icon_name": i.icon_name,
            "image_url": i.image_url,
            "has_premium_discount": is_premium,
        }
        for i in items
    ]


@router.get("/my-purchases")
def get_my_purchases(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Список купленных товаров пользователя с автоматическим обновлением статуса доставки."""
    now = datetime.utcnow()
    
    # Автоматически обновляем статусы заказов, время доставки которых уже наступило
    db.query(UserPurchase).filter(
        UserPurchase.user_id == current_user.id,
        UserPurchase.delivery_status.notin_(["delivered", "cancelled"]),
        UserPurchase.estimated_delivery_date <= now
    ).update({
        "delivery_status": "delivered",
        "delivered_at": now
    }, synchronize_session=False)
    
    db.commit()

    purchases = (
        db.query(UserPurchase)
        .filter(UserPurchase.user_id == current_user.id)
        .order_by(UserPurchase.purchased_at.desc())
        .all()
    )
    result = []
    for p in purchases:
        item = db.query(ShopItem).filter(ShopItem.id == p.shop_item_id).first()
        if item:
            result.append(
                {
                    "id": p.id,
                    "shop_item_id": item.id,
                    "title": item.title,
                    "description": item.description,
                    "category": item.category,
                    "icon_name": item.icon_name,
                    "purchased_at": p.purchased_at.isoformat() if p.purchased_at else None,
                    "delivery_status": p.delivery_status,
                    "estimated_delivery_date": p.estimated_delivery_date.isoformat() if p.estimated_delivery_date else None,
                    "delivered_at": p.delivered_at.isoformat() if p.delivered_at else None,
                }
            )
    return result


@router.post("/purchases/{purchase_id}/cancel")
def cancel_purchase(
    purchase_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Отменить заказ и вернуть 50% от стоимости товара."""
    try:
        purchase = db.query(UserPurchase).filter(
            UserPurchase.id == purchase_id,
            UserPurchase.user_id == current_user.id
        ).first()
        
        if not purchase:
            raise HTTPException(status_code=404, detail="Покупка не найдена")
        
        # Проверяем, можно ли отменить заказ
        if purchase.delivery_status == "delivered":
            raise HTTPException(status_code=400, detail="Нельзя отменить уже доставленный заказ")
        
        if purchase.delivery_status == "cancelled":
            raise HTTPException(status_code=400, detail="Заказ уже отменен")
        
        # Рассчитываем 50% от фактически оплаченной суммы (с учётом скидок)
        paid = purchase.price_paid
        if paid is None:
            # Fallback для старых записей без price_paid
            item = db.query(ShopItem).filter(ShopItem.id == purchase.shop_item_id).first()
            paid = item.price_coins if item else 0
        refund_amount = paid // 2
        
        # Обновляем статус заказа
        purchase.delivery_status = "cancelled"
        
        # Возвращаем 50% coins
        if refund_amount > 0:
            if not add_coins(db, current_user.id, refund_amount, f"order_cancellation_{purchase_id}"):
                raise HTTPException(status_code=500, detail="Не удалось вернуть coins")
        
        db.commit()
        # Получаем актуальный баланс после возврата
        new_balance = get_user_balance(db, current_user.id)
        return {
            "ok": True,
            "message": f"Заказ отменен. Возвращено {refund_amount} coins (50% от стоимости)",
            "refund_amount": refund_amount,
            "new_balance": new_balance,
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Внутренняя ошибка сервера: {str(e)}")


@router.delete("/purchases/{purchase_id}")
def delete_purchase(
    purchase_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Удалить запись о покупке (только если она отменена)."""
    purchase = db.query(UserPurchase).filter(
        UserPurchase.id == purchase_id,
        UserPurchase.user_id == current_user.id
    ).first()
    
    if not purchase:
        raise HTTPException(status_code=404, detail="Покупка не найдена")
    
    if purchase.delivery_status != "cancelled":
        raise HTTPException(status_code=400, detail="Можно удалять только отмененные заказы")
    
    db.delete(purchase)
    db.commit()
    return {"ok": True, "message": "Запись удалена"}


@router.post("/items/{item_id}/purchase")
def purchase_item(
    item_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Купить товар за coins."""
    try:
        item = db.query(ShopItem).filter(ShopItem.id == item_id, ShopItem.is_active == 1).first()
        if not item:
            raise HTTPException(status_code=404, detail="Товар не найден")
        is_premium = bool(current_user.is_premium)
        final_price = get_discounted_price(item.price_coins, is_premium)
        
        # Получаем актуальный баланс из БД (а не из кэша ORM!)
        balance = get_user_balance(db, current_user.id)
        if balance < final_price:
            raise HTTPException(status_code=400, detail=f"Недостаточно coins. Баланс: {balance}, нужно: {final_price}")
        
        if not spend_coins(db, current_user.id, final_price, f"shop_item_{item_id}"):
            raise HTTPException(status_code=400, detail="Не удалось списать coins")
        
        # Calculate estimated delivery date (6-7 days from now)
        days_until_delivery = 6 + random.randint(0, 1)  # 6 or 7 days
        estimated_delivery = datetime.utcnow() + timedelta(days=days_until_delivery)
        
        purchase = UserPurchase(
            user_id=current_user.id,
            shop_item_id=item_id,
            price_paid=final_price,
            delivery_status="pending",
            estimated_delivery_date=estimated_delivery,
        )
        db.add(purchase)
        
        # Remove from cart if exists
        cart_item = db.query(CartItem).filter(
            CartItem.user_id == current_user.id,
            CartItem.shop_item_id == item_id
        ).first()
        if cart_item:
            db.delete(cart_item)
        
        db.commit()
        # Получаем актуальный баланс после списания
        new_balance = get_user_balance(db, current_user.id)
        return {
            "ok": True,
            "message": f"Сәтті сатып алынды: {item.title}",
            "estimated_delivery_date": estimated_delivery.isoformat(),
            "new_balance": new_balance,
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Внутренняя ошибка сервера: {str(e)}")


# Favorites endpoints
@router.post("/items/{item_id}/favorite")
def add_to_favorites(
    item_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Добавить товар в избранное."""
    item = db.query(ShopItem).filter(ShopItem.id == item_id, ShopItem.is_active == 1).first()
    if not item:
        raise HTTPException(status_code=404, detail="Товар не найден")
    
    existing = db.query(UserFavorite).filter(
        UserFavorite.user_id == current_user.id,
        UserFavorite.shop_item_id == item_id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Товар уже в избранном")
    
    favorite = UserFavorite(user_id=current_user.id, shop_item_id=item_id)
    db.add(favorite)
    db.commit()
    return {"ok": True, "message": "Добавлено в избранное"}


@router.delete("/items/{item_id}/favorite")
def remove_from_favorites(
    item_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Удалить товар из избранного."""
    favorite = db.query(UserFavorite).filter(
        UserFavorite.user_id == current_user.id,
        UserFavorite.shop_item_id == item_id
    ).first()
    
    if not favorite:
        raise HTTPException(status_code=404, detail="Товар не найден в избранном")
    
    db.delete(favorite)
    db.commit()
    return {"ok": True, "message": "Удалено из избранного"}


@router.get("/favorites")
def get_favorites(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Получить список избранных товаров."""
    favorites = db.query(UserFavorite).filter(UserFavorite.user_id == current_user.id).all()
    result = []
    for fav in favorites:
        item = db.query(ShopItem).filter(ShopItem.id == fav.shop_item_id).first()
        if item:
            result.append({
                "id": item.id,
                "title": item.title,
                "description": item.description,
                "price_coins": item.price_coins,
                "category": item.category,
                "icon_name": item.icon_name,
                "image_url": item.image_url,
            })
    return result


# Cart endpoints
@router.get("/cart")
def get_cart(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Получить корзину пользователя."""
    cart_items = db.query(CartItem).filter(CartItem.user_id == current_user.id).all()
    result = []
    is_premium = bool(current_user.is_premium)
    for cart_item in cart_items:
        item = db.query(ShopItem).filter(ShopItem.id == cart_item.shop_item_id).first()
        if item:
            result.append({
                "id": cart_item.id,
                "shop_item_id": item.id,
                "title": item.title,
                "description": item.description,
                "price_coins": get_discounted_price(item.price_coins, is_premium),
                "original_price": item.price_coins,
                "category": item.category,
                "icon_name": item.icon_name,
                "image_url": item.image_url,
                "quantity": cart_item.quantity,
                "has_premium_discount": is_premium,
            })
    return result


@router.post("/cart/add")
def add_to_cart(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    item_id: int = Query(..., description="Shop item ID"),
    quantity: int = Query(default=1, ge=1),
):
    """Добавить товар в корзину."""
    item = db.query(ShopItem).filter(ShopItem.id == item_id, ShopItem.is_active == 1).first()
    if not item:
        raise HTTPException(status_code=404, detail="Товар не найден")
    
    existing = db.query(CartItem).filter(
        CartItem.user_id == current_user.id,
        CartItem.shop_item_id == item_id
    ).first()
    
    if existing:
        existing.quantity += quantity
    else:
        cart_item = CartItem(
            user_id=current_user.id,
            shop_item_id=item_id,
            quantity=quantity,
        )
        db.add(cart_item)
    
    db.commit()
    return {"ok": True, "message": "Добавлено в корзину"}


@router.delete("/cart/{item_id}")
def remove_from_cart(
    item_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Удалить товар из корзины."""
    cart_item = db.query(CartItem).filter(
        CartItem.user_id == current_user.id,
        CartItem.shop_item_id == item_id
    ).first()
    
    if not cart_item:
        raise HTTPException(status_code=404, detail="Товар не найден в корзине")
    
    db.delete(cart_item)
    db.commit()
    return {"ok": True, "message": "Удалено из корзины"}


@router.patch("/cart/{item_id}")
def update_cart_quantity(
    item_id: int,
    quantity: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Обновить количество товара в корзине."""
    if quantity < 1:
        raise HTTPException(status_code=400, detail="Количество должно быть не менее 1")
        
    cart_item = db.query(CartItem).filter(
        CartItem.user_id == current_user.id,
        CartItem.shop_item_id == item_id
    ).first()
    
    if not cart_item:
        raise HTTPException(status_code=404, detail="Товар не найден в корзине")
    
    cart_item.quantity = quantity
    db.commit()
    return {"ok": True, "message": "Количество обновлено", "quantity": quantity}


@router.post("/cart/checkout")
def checkout_cart(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Оформить заказ из корзины (покупка всех товаров)."""
    try:
        cart_items = db.query(CartItem).filter(CartItem.user_id == current_user.id).all()
        
        if not cart_items:
            raise HTTPException(status_code=400, detail="Корзина пуста")
        
        is_premium = bool(current_user.is_premium)
        total_cost = 0
        items_to_purchase = []
        for cart_item in cart_items:
            item = db.query(ShopItem).filter(ShopItem.id == cart_item.shop_item_id).first()
            if not item:
                raise HTTPException(status_code=404, detail=f"Товар с ID {cart_item.shop_item_id} не найден")
            if not item.is_active:
                raise HTTPException(status_code=400, detail=f"Товар '{item.title}' больше не доступен")
            
            item_final_price = get_discounted_price(item.price_coins, is_premium)
            total_cost += item_final_price * cart_item.quantity
            items_to_purchase.append((item, cart_item.quantity))
        
        # Check balance — из БД, а не из ORM-кэша!
        balance = get_user_balance(db, current_user.id)
        if balance < total_cost:
            raise HTTPException(
                status_code=400,
                detail=f"Недостаточно coins. Баланс: {balance}, нужно: {total_cost}"
            )
        
        # Spend coins
        if not spend_coins(db, current_user.id, total_cost, "cart_checkout"):
            raise HTTPException(status_code=400, detail="Не удалось списать coins")
        
        # Create purchases
        purchases = []
        days_until_delivery = 6 + random.randint(0, 1)
        estimated_delivery = datetime.utcnow() + timedelta(days=days_until_delivery)
        
        for item, quantity in items_to_purchase:
            item_price = get_discounted_price(item.price_coins, is_premium)
            for _ in range(quantity):
                purchase = UserPurchase(
                    user_id=current_user.id,
                    shop_item_id=item.id,
                    price_paid=item_price,
                    delivery_status="pending",
                    estimated_delivery_date=estimated_delivery,
                )
                db.add(purchase)
                purchases.append(purchase)
        
        # Clear cart
        for cart_item in cart_items:
            db.delete(cart_item)
        
        db.commit()
        # Получаем актуальный баланс после checkout
        new_balance = get_user_balance(db, current_user.id)
        return {
            "ok": True,
            "message": f"Сәтті сатып алынды {len(purchases)} товаров",
            "estimated_delivery_date": estimated_delivery.isoformat(),
            "new_balance": new_balance,
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Внутренняя ошибка сервера: {str(e)}")


@router.delete("/purchases/{purchase_id}")
def delete_purchase(
    purchase_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Удалить запись о покупке (только если она отменена)."""
    purchase = db.query(UserPurchase).filter(
        UserPurchase.id == purchase_id,
        UserPurchase.user_id == current_user.id
    ).first()
    
    if not purchase:
        raise HTTPException(status_code=404, detail="Покупка не найдена")
    
    if purchase.delivery_status != "cancelled":
        raise HTTPException(status_code=400, detail="Можно удалять только отмененные заказы")
    
    db.delete(purchase)
    db.commit()
    return {"ok": True, "message": "Запись удалена"}
