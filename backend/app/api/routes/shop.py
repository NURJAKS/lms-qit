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
from app.services.coins import spend_coins, add_coins

router = APIRouter(prefix="/shop", tags=["shop"])


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
    return [
        {
            "id": i.id,
            "title": i.title,
            "description": i.description,
            "price_coins": i.price_coins,
            "category": i.category,
            "icon_name": i.icon_name,
            "image_url": i.image_url,
        }
        for i in items
    ]


@router.get("/my-purchases")
def get_my_purchases(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Список купленных товаров пользователя."""
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
        
        # Получаем информацию о товаре для расчета возврата
        item = db.query(ShopItem).filter(ShopItem.id == purchase.shop_item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Товар не найден")
        
        # Рассчитываем 50% от стоимости
        refund_amount = item.price_coins // 2
        
        # Обновляем статус заказа
        purchase.delivery_status = "cancelled"
        
        # Возвращаем 50% coins
        if refund_amount > 0:
            if not add_coins(db, current_user.id, refund_amount, f"order_cancellation_{purchase_id}"):
                raise HTTPException(status_code=500, detail="Не удалось вернуть coins")
        
        db.commit()
        return {
            "ok": True,
            "message": f"Заказ отменен. Возвращено {refund_amount} coins (50% от стоимости)",
            "refund_amount": refund_amount,
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Внутренняя ошибка сервера: {str(e)}")


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
        balance = current_user.points or 0
        if balance < item.price_coins:
            raise HTTPException(status_code=400, detail=f"Недостаточно coins. Баланс: {balance}, нужно: {item.price_coins}")
        if not spend_coins(db, current_user.id, item.price_coins, f"shop_item_{item_id}"):
            raise HTTPException(status_code=400, detail="Не удалось списать coins")
        
        # Calculate estimated delivery date (6-7 days from now)
        days_until_delivery = 6 + random.randint(0, 1)  # 6 or 7 days
        estimated_delivery = datetime.utcnow() + timedelta(days=days_until_delivery)
        
        purchase = UserPurchase(
            user_id=current_user.id,
            shop_item_id=item_id,
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
        return {
            "ok": True,
            "message": f"Сәтті сатып алынды: {item.title}",
            "estimated_delivery_date": estimated_delivery.isoformat(),
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
    for cart_item in cart_items:
        item = db.query(ShopItem).filter(ShopItem.id == cart_item.shop_item_id).first()
        if item:
            result.append({
                "id": cart_item.id,
                "shop_item_id": item.id,
                "title": item.title,
                "description": item.description,
                "price_coins": item.price_coins,
                "category": item.category,
                "icon_name": item.icon_name,
                "image_url": item.image_url,
                "quantity": cart_item.quantity,
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
        
        # Calculate total cost
        total_cost = 0
        items_to_purchase = []
        for cart_item in cart_items:
            item = db.query(ShopItem).filter(ShopItem.id == cart_item.shop_item_id).first()
            if not item:
                raise HTTPException(status_code=404, detail=f"Товар с ID {cart_item.shop_item_id} не найден")
            if not item.is_active:
                raise HTTPException(status_code=400, detail=f"Товар '{item.title}' больше не доступен")
            total_cost += item.price_coins * cart_item.quantity
            items_to_purchase.append((item, cart_item.quantity))
        
        # Check balance
        balance = current_user.points or 0
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
            for _ in range(quantity):
                purchase = UserPurchase(
                    user_id=current_user.id,
                    shop_item_id=item.id,
                    delivery_status="pending",
                    estimated_delivery_date=estimated_delivery,
                )
                db.add(purchase)
                purchases.append(purchase)
        
        # Clear cart
        for cart_item in cart_items:
            db.delete(cart_item)
        
        db.commit()
        return {
            "ok": True,
            "message": f"Сәтті сатып алынды {len(purchases)} товаров",
            "estimated_delivery_date": estimated_delivery.isoformat(),
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Внутренняя ошибка сервера: {str(e)}")
