# РАСШИРЕННЫЙ ОТЧЕТ О РЕАЛИЗАЦИИ ПРОЕКТА

## Образовательная платформа LMS с AI-помощником и геймификацией

---

## ОРИГИНАЛЬНОЕ СОДЕРЖАНИЕ (разделы 1-12)
[Все предыдущие разделы остаются без изменений]

---

## НОВЫЕ РАЗДЕЛЫ

### 13. Система безопасности и защита данных

#### Шифрование и защита пароля

```python
# backend/app/core/security.py
from passlib.context import CryptContext
from cryptography.fernet import Fernet
from datetime import datetime, timedelta
import jwt

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class SecurityManager:
    def __init__(self):
        self.cipher_suite = Fernet(settings.ENCRYPTION_KEY)
    
    def hash_password(self, password: str) -> str:
        """Хеширование пароля с bcrypt (разные соли для каждого пароля)."""
        return pwd_context.hash(password)
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Верификация пароля."""
        return pwd_context.verify(plain_password, hashed_password)
    
    def encrypt_sensitive_data(self, data: str) -> str:
        """Шифрование чувствительных данных (номера карт, ДКД и т.д.)."""
        return self.cipher_suite.encrypt(data.encode()).decode()
    
    def decrypt_sensitive_data(self, encrypted_data: str) -> str:
        """Расшифровка чувствительных данных."""
        return self.cipher_suite.decrypt(encrypted_data.encode()).decode()
    
    def create_access_token(
        self, 
        data: dict, 
        expires_delta: timedelta = None
    ) -> str:
        """Создание JWT токена с автоматическим истечением."""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(hours=24)
        
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(
            to_encode, 
            settings.SECRET_KEY, 
            algorithm=settings.ALGORITHM
        )
        return encoded_jwt
    
    def verify_token(self, token: str) -> dict:
        """Верификация и расшифровка JWT токена."""
        try:
            payload = jwt.decode(
                token, 
                settings.SECRET_KEY, 
                algorithms=[settings.ALGORITHM]
            )
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Токен истек")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Неверный токен")
```

**Механизмы защиты:**
- Bcrypt хеширование паролей с автоматической генерацией солей
- Использование разных алгоритмов для разных типов данных
- JWT токены с автоматическим истечением (24 часа)
- Двухфакторная аутентификация через email (опционально)
- Шифрование чувствительных данных (номера карт, персональная информация)
- Регулярная ротация шифровальных ключей
- HTTPS для всех подключений
- CSRF токены для всех POST/PATCH/DELETE запросов

---

### 14. Система мониторинга и логирования

#### Централизованное логирование с аналитикой

```python
# backend/app/core/logging.py
import logging
from pythonjsonlogger import jsonlogger
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, JSON

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String(100))
    resource_type = Column(String(100))  # user, course, test, shop_item
    resource_id = Column(Integer)
    old_values = Column(JSON)  # предыдущие значения при изменении
    new_values = Column(JSON)  # новые значения
    ip_address = Column(String(45))  # поддержка IPv6
    user_agent = Column(String(500))
    status_code = Column(Integer)
    response_time_ms = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", backref="audit_logs")

class PerformanceMonitor:
    """Мониторинг производительности приложения."""
    
    @staticmethod
    async def track_request(request: Request, call_next):
        """Middleware для отслеживания времени обработки запроса."""
        start_time = datetime.utcnow()
        
        response = await call_next(request)
        
        process_time = (datetime.utcnow() - start_time).total_seconds() * 1000
        response.headers["X-Process-Time"] = str(process_time)
        
        # Логирование медленных запросов (>1 сек)
        if process_time > 1000:
            logger.warning(
                f"Slow request: {request.method} {request.url.path}",
                extra={
                    "duration_ms": process_time,
                    "endpoint": request.url.path,
                    "method": request.method
                }
            )
        
        return response

@router.post("/api/protected-action")
async def protected_action(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Любой protected action автоматически логируется."""
    
    # Выполнение действия
    result = perform_some_action()
    
    # Логирование в audit_log
    audit = AuditLog(
        user_id=current_user.id,
        action="update",
        resource_type="course",
        resource_id=1,
        old_values={"title": "Old Title"},
        new_values={"title": "New Title"},
        ip_address=request.client.host,
        user_agent=request.headers.get("user-agent", ""),
        status_code=200,
        response_time_ms=45
    )
    db.add(audit)
    db.commit()
    
    return result

# Настройка JSON логирования для ELK стека
logger = logging.getLogger()
handler = logging.StreamHandler()
formatter = jsonlogger.JsonFormatter()
handler.setFormatter(formatter)
logger.addHandler(handler)
```

**Система логирования включает:**
- JSON логирование для интеграции с ELK (Elasticsearch, Logstash, Kibana)
- Отслеживание всех действий пользователей (audit trail)
- Мониторинг производительности (slow query detection)
- Анализ ошибок и исключений
- Отслеживание API запросов (метод, endpoint, время отклика)
- Сохранение IP адреса и User-Agent для безопасности
- Автоматическое создание алертов при критических ошибках

---

### 15. Система тестирования (Unit, Integration, E2E)

#### Unit тесты для критических функций

```python
# backend/tests/test_auth.py
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models import User

client = TestClient(app)

class TestAuthentication:
    
    def test_user_registration_success(self, db_session):
        """Успешная регистрация пользователя."""
        response = client.post(
            "/auth/register",
            json={
                "email": "test@example.com",
                "password": "SecurePassword123!",
                "full_name": "Test User"
            }
        )
        assert response.status_code == 201
        assert response.json()["email"] == "test@example.com"
    
    def test_user_registration_weak_password(self):
        """Отклонение слабого пароля."""
        response = client.post(
            "/auth/register",
            json={
                "email": "test@example.com",
                "password": "123",  # слишком короткий
                "full_name": "Test User"
            }
        )
        assert response.status_code == 422
    
    def test_login_invalid_credentials(self):
        """Ошибка при неверных учетных данных."""
        response = client.post(
            "/auth/login",
            json={
                "email": "nonexistent@example.com",
                "password": "password"
            }
        )
        assert response.status_code == 401
    
    def test_token_expiration(self):
        """Проверка истечения токена."""
        # Создание токена с очень коротким временем жизни
        token = create_access_token(
            {"sub": "1"},
            expires_delta=timedelta(seconds=1)
        )
        time.sleep(2)
        
        response = client.get(
            "/api/protected",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 401

@pytest.mark.asyncio
async def test_concurrent_requests():
    """Тестирование обработки параллельных запросов."""
    tasks = [
        client.get("/api/dashboard/stats"),
        client.get("/api/dashboard/stats"),
        client.get("/api/dashboard/stats"),
    ]
    responses = await asyncio.gather(*tasks)
    assert all(r.status_code == 200 for r in responses)
```

#### Integration тесты для API

```python
# backend/tests/test_integration.py
class TestDashboardIntegration:
    
    def test_complete_learning_flow(self, db_session):
        """Полный цикл: регистрация -> запись на курс -> прохождение -> сертификат."""
        
        # 1. Регистрация
        user_resp = client.post("/auth/register", json={...})
        user_id = user_resp.json()["id"]
        token = user_resp.json()["access_token"]
        
        # 2. Запись на курс
        enroll_resp = client.post(
            "/courses/1/enroll",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert enroll_resp.status_code == 200
        
        # 3. Прохождение теста
        test_resp = client.post(
            "/tests/1/submit",
            json={"answers": {...}},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert test_resp.json()["score"] >= 80
        
        # 4. Получение сертификата
        cert_resp = client.get(
            "/certificates",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert len(cert_resp.json()) > 0
    
    def test_ai_chat_with_rate_limiting(self):
        """Проверка лимитирования AI-чата."""
        for i in range(6):  # Free пользователь может только 5
            response = client.post(
                "/ai/chat",
                json={"message": "test"},
                headers={"Authorization": f"Bearer {token}"}
            )
            if i < 5:
                assert response.status_code == 200
            else:
                assert response.status_code == 429
```

#### E2E тесты с Playwright

```javascript
// frontend/tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('Complete user registration and login', async ({ page }) => {
    // Регистрация
    await page.goto('/register');
    await page.fill('input[name="email"]', 'testuser@example.com');
    await page.fill('input[name="password"]', 'SecurePass123!');
    await page.fill('input[name="fullName"]', 'Test User');
    await page.click('button[type="submit"]');
    
    // Проверка редиректа на логин
    await page.waitForURL('/login');
    
    // Логин
    await page.fill('input[name="email"]', 'testuser@example.com');
    await page.fill('input[name="password"]', 'SecurePass123!');
    await page.click('button[type="submit"]');
    
    // Проверка успешного входа
    await page.waitForURL('/dashboard');
    const heading = await page.locator('h1').textContent();
    expect(heading).toContain('Добро пожаловать');
  });
  
  test('AI chat functionality', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Открытие чата
    await page.click('button[class*="MessageCircle"]');
    
    // Отправка сообщения
    await page.fill('input[placeholder*="сообщение"]', 'Что такое API?');
    await page.press('input', 'Enter');
    
    // Проверка получения ответа
    await page.waitForSelector('text=API', { timeout: 5000 });
    const response = await page.locator('text=API').textContent();
    expect(response).toBeTruthy();
  });
});
```

**Стратегия тестирования:**
- Unit тесты для критических функций (auth, payments, scoring)
- Integration тесты для полных пользовательских сценариев
- E2E тесты для основных user flows
- Покрытие тестами минимум 80% кода
- Автоматический запуск тестов при каждом commit

---

### 16. CI/CD Pipeline и Deployment

#### GitHub Actions Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy LMS Platform

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: lms_test
          POSTGRES_PASSWORD: testpass
        options: >-
          --health-cmd pg_isready
          --health-interval 10s

    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install pytest pytest-cov pytest-asyncio
      
      - name: Run backend tests
        run: |
          pytest backend/tests --cov=app --cov-report=xml
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
      
      - name: Set up Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install frontend dependencies
        run: cd frontend && npm ci
      
      - name: Run frontend tests
        run: cd frontend && npm run test
      
      - name: Build frontend
        run: cd frontend && npm run build
      
      - name: E2E tests
        run: cd frontend && npx playwright test
  
  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to production
        env:
          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
        run: |
          mkdir -p ~/.ssh
          echo "$DEPLOY_KEY" > ~/.ssh/deploy_key
          chmod 600 ~/.ssh/deploy_key
          ssh -i ~/.ssh/deploy_key deploy@prod-server.com "cd /app && git pull && ./deploy.sh"
```

#### Docker Deployment

```dockerfile
# Dockerfile.backend
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:8000/health')"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```yaml
# docker-compose.yml
version: '3.9'

services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: lms_db
      POSTGRES_USER: lms_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    depends_on:
      - db
      - redis
    environment:
      DATABASE_URL: postgresql://lms_user:${DB_PASSWORD}@db:5432/lms_db
      REDIS_URL: redis://redis:6379
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
  
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://backend:8000
    depends_on:
      - backend
```

---

### 17. Система кэширования и оптимизация производительности

#### Redis Caching Strategy

```python
# backend/app/core/cache.py
import redis
import json
from functools import wraps
from datetime import timedelta

redis_client = redis.Redis(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    db=0,
    decode_responses=True
)

def cache_response(expire_time: int = 3600):
    """Декоратор для кэширования ответов API."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Генерация ключа кэша на основе параметров функции
            cache_key = f"{func.__name__}:{args}:{kwargs}"
            
            # Попытка получить из кэша
            cached = redis_client.get(cache_key)
            if cached:
                return json.loads(cached)
            
            # Вызов оригинальной функции
            result = await func(*args, **kwargs)
            
            # Сохранение в кэш
            redis_client.setex(
                cache_key,
                expire_time,
                json.dumps(result, default=str)
            )
            
            return result
        return wrapper
    return decorator

@router.get("/courses/{course_id}")
@cache_response(expire_time=1800)  # 30 минут
async def get_course(course_id: int, db: Session = Depends(get_db)):
    """Получение курса с кэшированием."""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404)
    return course

class CacheInvalidator:
    """Управление инвалидацией кэша при изменении данных."""
    
    @staticmethod
    def invalidate_course_cache(course_id: int):
        """Инвалидация кэша курса при его изменении."""
        keys_to_delete = redis_client.keys(f"get_course:{course_id}*")
        if keys_to_delete:
            redis_client.delete(*keys_to_delete)
    
    @staticmethod
    def invalidate_user_stats(user_id: int):
        """Инвалидация статистики пользователя."""
        keys_to_delete = redis_client.keys(f"get_dashboard_stats:({user_id},*")
        if keys_to_delete:
            redis_client.delete(*keys_to_delete)

@router.patch("/courses/{course_id}")
async def update_course(
    course_id: int,
    body: CourseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Обновление курса с инвалидацией кэша."""
    course = db.query(Course).filter(Course.id == course_id).first()
    # ... обновление данных ...
    
    # Инвалидация кэша
    CacheInvalidator.invalidate_course_cache(course_id)
    
    return course
```

#### Database Query Optimization

```python
# backend/app/api/routes/dashboard.py
from sqlalchemy.orm import joinedload
from sqlalchemy import select, func

@router.get("/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Оптимизированный запрос к БД с использованием joinedload."""
    
    # Неправильно: N+1 query problem
    # enrollments = db.query(CourseEnrollment).filter(...).all()
    # for e in enrollments:
    #     print(e.course.title)  # Дополнительный запрос за каждую запись
    
    # Правильно: используем joinedload для загрузки связанных данных
    enrollments = db.query(CourseEnrollment).options(
        joinedload(CourseEnrollment.course),
        joinedload(CourseEnrollment.user)
    ).filter(CourseEnrollment.user_id == current_user.id).all()
    
    # Используем single query для подсчета
    courses_completed = db.query(func.count(Certificate.id)).filter(
        Certificate.user_id == current_user.id
    ).scalar()
    
    total_progress = db.query(
        func.round(
            func.count(StudentProgress.id) * 100.0 /
            func.max(func.count(CourseTopic.id)),
            1
        )
    ).filter(
        StudentProgress.user_id == current_user.id,
        StudentProgress.is_completed == True
    ).scalar() or 0
    
    return {
        "courses_completed": courses_completed,
        "points": current_user.points,
        "progress_percent": total_progress,
        "total_courses": len(enrollments),
    }
```

#### Frontend Performance Optimization

```typescript
// frontend/app/hooks/useOptimizedQuery.ts
import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { useCallback } from 'react';

interface OptimizedQueryOptions<T> extends UseQueryOptions<T> {
  staleTime?: number;
  gcTime?: number;
  enabled?: boolean;
}

export function useOptimizedQuery<T>(
  queryKey: string[],
  queryFn: () => Promise<T>,
  options: OptimizedQueryOptions<T> = {}
) {
  // Оптимальные значения для различных типов данных
  const defaultOptions = {
    staleTime: 5 * 60 * 1000, // 5 минут
    gcTime: 10 * 60 * 1000, // 10 минут (ранее cacheTime)
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    enabled: true,
    ...options,
  };

  return useQuery({
    queryKey,
    queryFn,
    ...defaultOptions,
  });
}

// frontend/app/components/DashboardStats.tsx
import { useMemo } from 'react';

export function DashboardStats() {
  const { data: stats, isLoading } = useOptimizedQuery(
    ['dashboard', 'stats'],
    () => api.get('/api/dashboard/stats'),
    { staleTime: 10 * 60 * 1000 } // Более долгий кэш для статистики
  );

  // Мемоизация вычисленных значений
  const progressPercentage = useMemo(() => {
    if (!stats) return 0;
    return Math.round(stats.progress_percent * 10) / 10;
  }, [stats?.progress_percent]);

  return (
    <div className="space-y-4">
      <StatCard 
        title="Прогресс" 
        value={progressPercentage} 
        loading={isLoading}
      />
    </div>
  );
}
```

---

### 18. Email и Push-уведомления

#### Email Notification System

```python
# backend/app/services/email.py
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from jinja2 import Environment, FileSystemLoader

conf = ConnectionConfig(
    mail_server=settings.MAIL_SERVER,
    mail_port=settings.MAIL_PORT,
    mail_from=settings.MAIL_FROM,
    mail_password=settings.MAIL_PASSWORD,
    mail_from_name=settings.MAIL_FROM_NAME,
)

fm = FastMail(conf)

# Загрузка шаблонов писем
env = Environment(loader=FileSystemLoader("app/templates/emails"))

class EmailService:
    
    @staticmethod
    async def send_welcome_email(user: User):
        """Отправка приветственного письма."""
        template = env.get_template("welcome.html")
        html = template.render(
            user_name=user.full_name,
            activation_link=f"{settings.FRONTEND_URL}/verify/{user.id}"
        )
        
        message = MessageSchema(
            subject="Добро пожаловать на LMS платформу!",
            recipients=[user.email],
            body=html,
            subtype="html",
        )
        await fm.send_message(message)
    
    @staticmethod
    async def send_course_completion_email(user: User, course: Course):
        """Отправка уведомления об окончании курса."""
        template = env.get_template("course_completed.html")
        html = template.render(
            user_name=user.full_name,
            course_title=course.title,
            certificate_link=f"{settings.FRONTEND_URL}/certificates/{user.id}"
        )
        
        message = MessageSchema(
            subject=f"Поздравляем! Вы завершили курс {course.title}",
            recipients=[user.email],
            body=html,
            subtype="html",
            attachments=[f"certificates/{user.id}_{course.id}.pdf"]
        )
        await fm.send_message(message)
    
    @staticmethod
    async def send_achievement_email(user: User, achievement: str, points: int):
        """Отправка уведомления об достижении."""
        template = env.get_template("achievement.html")
        html = template.render(
            user_name=user.full_name,
            achievement=achievement,
            points=points
        )
        
        message = MessageSchema(
            subject=f"🎉 Новое достижение: {achievement}",
            recipients=[user.email],
            body=html,
            subtype="html",
        )
        await fm.send_message(message)

# Использование в endpoints
@router.post("/courses/{course_id}/complete")
async def complete_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # ... логика завершения курса ...
    
    # Отправка email
    await EmailService.send_course_completion_email(current_user, course)
    
    return {"status": "completed"}
```

#### Push-уведомления через WebSocket и Service Worker

```python
# backend/app/api/routes/notifications.py
from fastapi import WebSocket, WebSocketDisconnect
import json

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[int, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: int):
        if user_id in self.active_connections:
            self.active_connections[user_id].remove(websocket)

    async def broadcast_to_user(self, user_id: int, message: dict):
        """Отправка уведомления конкретному пользователю."""
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

    async def broadcast_to_all(self, message: dict):
        """Отправка уведомления всем активным пользователям."""
        for connections in self.active_connections.values():
            for connection in connections:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

manager = ConnectionManager()

@router.websocket("/ws/notifications/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int):
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Обработка сообщений от клиента
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)

# Отправка уведомления при новом достижении
async def award_achievement(user_id: int, achievement: str, points: int):
    """Отправка real-time уведомления об достижении."""
    await manager.broadcast_to_user(user_id, {
        "type": "achievement",
        "title": achievement,
        "points": points,
        "timestamp": datetime.utcnow().isoformat()
    })
```

```javascript
// frontend/app/services/notificationService.ts
export class NotificationService {
  private ws: WebSocket | null = null;
  private userId: number;

  constructor(userId: number) {
    this.userId = userId;
  }

  connect() {
    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL}/ws/notifications/${this.userId}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'achievement') {
        this.showNotification(message);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      // Попытка переподключения через 3 секунды
      setTimeout(() => this.connect(), 3000);
    };
  }

  private showNotification(message: any) {
    // Push-уведомление через Service Worker
    if ('serviceWorker' in navigator && 'Notification' in window) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(message.title, {
          body: `+${message.points} баллов`,
          icon: '/achievement-icon.png',
          badge: '/badge.png',
          tag: 'achievement',
        });
      });
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}
```

---

### 19. Система платежей и Premium подписка

#### Payment Integration with Stripe

```python
# backend/app/services/payment.py
import stripe
from enum import Enum

stripe.api_key = settings.STRIPE_SECRET_KEY

class PlanType(str, Enum):
    MONTHLY = "monthly"
    YEARLY = "yearly"
    LIFETIME = "lifetime"

class PaymentService:
    
    PLANS = {
        PlanType.MONTHLY: {
            "amount": 4900,  # $49 в центах
            "currency": "usd",
            "interval": "month",
            "description": "Premium подписка (1 месяц)"
        },
        PlanType.YEARLY: {
            "amount": 49900,  # $499 в год
            "currency": "usd",
            "interval": "year",
            "description": "Premium подписка (1 год)"
        },
        PlanType.LIFETIME: {
            "amount": 99900,  # $999 один раз
            "currency": "usd",
            "description": "Lifetime Premium доступ"
        }
    }
    
    @staticmethod
    async def create_subscription(
        user: User,
        plan_type: PlanType,
        db: Session
    ) -> dict:
        """Создание платежной сессии для подписки."""
        
        plan = PaymentService.PLANS[plan_type]
        
        # Создание Stripe Session
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            customer_email=user.email,
            client_reference_id=str(user.id),
            line_items=[{
                'price_data': {
                    'currency': plan['currency'],
                    'product_data': {
                        'name': plan['description'],
                        'description': 'Доступ ко всем премиум возможностям'
                    },
                    'unit_amount': plan['amount'],
                },
                'quantity': 1,
            }],
            mode='subscription' if plan_type != PlanType.LIFETIME else 'payment',
            success_url=f"{settings.FRONTEND_URL}/premium/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{settings.FRONTEND_URL}/premium",
        )
        
        # Сохранение информации о платеже
        payment = Payment(
            user_id=user.id,
            stripe_session_id=session.id,
            plan_type=plan_type,
            status="pending",
            amount=plan['amount'],
            currency=plan['currency']
        )
        db.add(payment)
        db.commit()
        
        return {
            "session_id": session.id,
            "checkout_url": session.url
        }
    
    @staticmethod
    async def handle_webhook(event: dict, db: Session):
        """Обработка webhook от Stripe."""
        
        if event["type"] == "checkout.session.completed":
            session = event["data"]["object"]
            user_id = int(session["client_reference_id"])
            
            # Активация Premium подписки
            user = db.query(User).filter(User.id == user_id).first()
            user.is_premium = 1
            
            # Сохранение информации о платеже
            payment = db.query(Payment).filter(
                Payment.stripe_session_id == session["id"]
            ).first()
            payment.status = "completed"
            payment.stripe_customer_id = session["customer"]
            
            db.commit()
            
            # Отправка приветственного письма
            await EmailService.send_premium_welcome_email(user)
        
        elif event["type"] == "customer.subscription.deleted":
            # Отмена подписки
            session = event["data"]["object"]
            customer_id = session["customer"]
            
            # Поиск пользователя по Stripe customer_id
            payment = db.query(Payment).filter(
                Payment.stripe_customer_id == customer_id
            ).first()
            if payment:
                user = payment.user
                user.is_premium = 0
                db.commit()

# Model для сохранения информации о платежах
class Payment(Base):
    __tablename__ = "payments"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    stripe_session_id = Column(String(255), unique=True)
    stripe_customer_id = Column(String(255))
    plan_type = Column(String(50))
    status = Column(String(50))  # pending, completed, failed, cancelled
    amount = Column(Integer)
    currency = Column(String(3), default="usd")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", backref="payments")
```

#### Premium Features Comparison

```python
# backend/app/utils/premium.py
class PremiumFeatures:
    """Определение премиум функций платформы."""
    
    FEATURES = {
        "ai_chat_limit": {
            "free": 5,  # 5 запросов в день
            "premium": None  # Без ограничений
        },
        "course_access": {
            "free": ["free_courses"],
            "premium": ["free_courses", "premium_courses"]
        },
        "advanced_analytics": {
            "free": False,
            "premium": True
        },
        "certificate_download": {
            "free": False,
            "premium": True
        },
        "offline_mode": {
            "free": False,
            "premium": True
        },
        "priority_support": {
            "free": False,
            "premium": True
        },
        "ad_free": {
            "free": False,
            "premium": True
        }
    }
    
    @staticmethod
    def check_feature_access(user: User, feature: str) -> bool:
        """Проверка доступа пользователя к функции."""
        is_premium = user.is_premium == 1
        tier = "premium" if is_premium else "free"
        
        if feature not in PremiumFeatures.FEATURES:
            return False
        
        feature_config = PremiumFeatures.FEATURES[feature]
        feature_value = feature_config.get(tier)
        
        return bool(feature_value)

# Использование в endpoints
@router.get("/ai/chat")
async def ai_chat(
    body: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Проверка лимита AI-чата для Free пользователей
    if not PremiumFeatures.check_feature_access(current_user, "ai_chat_limit"):
        limit = PremiumFeatures.FEATURES["ai_chat_limit"]["free"]
        used = count_today_ai_requests(db, current_user.id)
        if used >= limit:
            raise HTTPException(status_code=429, detail=f"Лимит исчерпан ({used}/{limit})")
    
    # ... остальной код ...
```

---

### 20. Система рекомендаций курсов (Recommendation Engine)

#### ML-based Course Recommendation

```python
# backend/app/services/recommendation.py
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
from typing import List

class CourseRecommendationEngine:
    """Система рекомендации курсов на основе поведения пользователя."""
    
    @staticmethod
    def get_user_profile(user_id: int, db: Session) -> dict:
        """Создание профиля пользователя на основе его активности."""
        
        # Получение всех пройденных курсов
        completed_courses = db.query(Certificate).filter(
            Certificate.user_id == user_id
        ).all()
        
        # Получение оценок пользователя
        scores = db.query(StudentProgress).filter(
            StudentProgress.user_id == user_id
        ).all()
        
        # Извлечение признаков курсов
        course_features = []
        for course in completed_courses:
            features = CourseRecommendationEngine._extract_course_features(
                course.course, 
                db
            )
            course_features.append(features)
        
        # Агрегирование признаков в профиль пользователя
        if course_features:
            user_profile = np.mean(course_features, axis=0)
        else:
            user_profile = np.zeros(20)  # 20 признаков
        
        return {
            "profile": user_profile,
            "completed_course_ids": [c.course_id for c in completed_courses],
            "skill_level": CourseRecommendationEngine._estimate_skill_level(scores)
        }
    
    @staticmethod
    def _extract_course_features(course: Course, db: Session) -> np.ndarray:
        """Извлечение признаков курса (difficulty, category, duration и т.д.)."""
        features = []
        
        # Difficulty level (0-1)
        features.append(course.difficulty_level / 100)
        
        # Category (one-hot encoded для основных категорий)
        categories = ['programming', 'mathematics', 'languages', 'business']
        for cat in categories:
            features.append(1 if course.category == cat else 0)
        
        # Duration in hours (нормализованы)
        features.append(min(course.duration_hours / 100, 1))
        
        # Average rating (0-5)
        avg_rating = db.query(func.avg(CourseReview.rating)).filter(
            CourseReview.course_id == course.id
        ).scalar() or 0
        features.append(avg_rating / 5)
        
        # Number of students
        num_students = db.query(func.count(CourseEnrollment.id)).filter(
            CourseEnrollment.course_id == course.id
        ).scalar()
        features.append(min(num_students / 1000, 1))
        
        return np.array(features)
    
    @staticmethod
    def recommend_courses(
        user_id: int, 
        db: Session, 
        limit: int = 5
    ) -> List[dict]:
        """Получение рекомендованных курсов для пользователя."""
        
        user_profile = CourseRecommendationEngine.get_user_profile(user_id, db)
        
        # Получение всех доступных курсов
        all_courses = db.query(Course).filter(
            Course.is_active == 1,
            ~Course.id.in_(user_profile["completed_course_ids"])
        ).all()
        
        # Вычисление похожести каждого курса с профилем пользователя
        recommendations = []
        for course in all_courses:
            course_features = CourseRecommendationEngine._extract_course_features(
                course, 
                db
            )
            similarity = cosine_similarity(
                [user_profile["profile"]], 
                [course_features]
            )[0][0]
            
            # Учет уровня сложности
            difficulty_match = 1 - abs(
                course.difficulty_level - user_profile["skill_level"]
            ) / 100
            
            # Итоговый скор
            score = similarity * 0.7 + difficulty_match * 0.3
            
            recommendations.append({
                "course_id": course.id,
                "title": course.title,
                "score": float(score),
                "reason": f"Based on your {user_profile['skill_level']}% skill level"
            })
        
        # Сортировка по скору и возврат топ N
        recommendations.sort(key=lambda x: x["score"], reverse=True)
        return recommendations[:limit]

# API endpoint для рекомендаций
@router.get("/recommendations/courses")
async def get_course_recommendations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получение персонализированных рекомендаций курсов."""
    recommendations = CourseRecommendationEngine.recommend_courses(
        current_user.id,
        db,
        limit=5
    )
    return recommendations
```

---

### 21. Система сертификатов и верификации

#### Certificate Generation with Verification

```python
# backend/app/services/certificate.py
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from datetime import datetime
import hashlib
import uuid

class CertificateService:
    
    @staticmethod
    def generate_certificate(user: User, course: Course, db: Session) -> str:
        """Генерация PDF сертификата с уникальным кодом верификации."""
        
        # Генерация уникального кода верификации
        verification_code = str(uuid.uuid4())[:8].upper()
        verification_hash = hashlib.sha256(
            f"{user.id}{course.id}{verification_code}".encode()
        ).hexdigest()
        
        # Получение информации об результатах студента
        progress = db.query(StudentProgress).filter(
            StudentProgress.user_id == user.id,
            StudentProgress.course_id == course.id
        ).all()
        
        completion_date = datetime.utcnow()
        
        # Регистрация сертификата в БД
        certificate = Certificate(
            user_id=user.id,
            course_id=course.id,
            verification_code=verification_code,
            verification_hash=verification_hash,
            issued_date=completion_date,
            is_valid=True
        )
        db.add(certificate)
        db.commit()
        
        # Генерация PDF
        filename = f"certificates/{user.id}_{course.id}_{verification_code}.pdf"
        doc = SimpleDocTemplate(filename, pagesize=landscape(A4))
        styles = getSampleStyleSheet()
        
        # Кастомные стили
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=36,
            textColor=colors.HexColor('#2E5090'),
            spaceAfter=30,
            alignment=1
        )
        
        # Содержимое сертификата
        elements = [
            Spacer(1, 2*inch),
            Paragraph(f"Certificate of Completion", title_style),
            Spacer(1, 0.5*inch),
            Paragraph(f"This is to certify that<br/><b>{user.full_name}</b>", styles['Normal']),
            Spacer(1, 0.3*inch),
            Paragraph(f"has successfully completed the course<br/><b>{course.title}</b>", styles['Normal']),
            Spacer(1, 0.5*inch),
            Paragraph(f"Date of Completion: {completion_date.strftime('%B %d, %Y')}", styles['Normal']),
            Paragraph(f"Verification Code: {verification_code}", styles['Normal']),
        ]
        
        doc.build(elements)
        
        return filename
    
    @staticmethod
    def verify_certificate(verification_code: str, user_id: int, db: Session) -> bool:
        """Верификация сертификата по коду."""
        certificate = db.query(Certificate).filter(
            Certificate.verification_code == verification_code,
            Certificate.user_id == user_id,
            Certificate.is_valid == True
        ).first()
        
        return certificate is not None

# Model для сертификатов
class Certificate(Base):
    __tablename__ = "certificates"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    course_id = Column(Integer, ForeignKey("courses.id"))
    verification_code = Column(String(8), unique=True)
    verification_hash = Column(String(64))
    issued_date = Column(DateTime, default=datetime.utcnow)
    is_valid = Column(Boolean, default=True)
    pdf_url = Column(String(500))
    
    user = relationship("User", backref="certificates")
    course = relationship("Course")

# API для скачивания и верификации сертификатов
@router.get("/certificates/{cert_id}/download")
async def download_certificate(
    cert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Скачивание сертификата."""
    certificate = db.query(Certificate).filter(
        Certificate.id == cert_id,
        Certificate.user_id == current_user.id
    ).first()
    
    if not certificate:
        raise HTTPException(status_code=404)
    
    return FileResponse(certificate.pdf_url, filename=f"certificate_{cert_id}.pdf")

@router.post("/certificates/verify")
async def verify_certificate(code: str, db: Session = Depends(get_db)):
    """Публичная верификация сертификата."""
    certificate = db.query(Certificate).filter(
        Certificate.verification_code == code,
        Certificate.is_valid == True
    ).first()
    
    if not certificate:
        raise HTTPException(status_code=404, detail="Сертификат не найден")
    
    return {
        "valid": True,
        "student_name": certificate.user.full_name,
        "course_title": certificate.course.title,
        "issued_date": certificate.issued_date
    }
```

---

### 22. Интеграция с внешними сервисами

#### Интеграция с Календарем, видео-платформой и аналитикой

```python
# backend/app/integrations/calendar.py
import google.auth
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

class GoogleCalendarIntegration:
    """Интеграция с Google Calendar для синхронизации сроков курсов."""
    
    SCOPES = ['https://www.googleapis.com/auth/calendar']
    
    @staticmethod
    def create_course_event(user_email: str, course: Course, db: Session):
        """Создание события календаря для начала курса."""
        
        # Получение credentials пользователя
        service = build('calendar', 'v3')
        
        event = {
            'summary': f'Start Course: {course.title}',
            'description': course.description,
            'start': {
                'dateTime': course.start_date.isoformat(),
                'timeZone': 'UTC',
            },
            'end': {
                'dateTime': (course.start_date + timedelta(hours=1)).isoformat(),
                'timeZone': 'UTC',
            },
            'reminders': {
                'useDefault': False,
                'overrides': [
                    {'method': 'email', 'minutes': 24 * 60},  # За день
                    {'method': 'popup', 'minutes': 30},  # За 30 минут
                ],
            },
        }
        
        event = service.events().insert(calendarId='primary', body=event).execute()
        return event['id']

# backend/app/integrations/video.py
import requests

class VideoIntegration:
    """Интеграция с Vimeo для хостинга видео."""
    
    API_BASE = "https://api.vimeo.com"
    
    @staticmethod
    def upload_course_video(
        file_path: str, 
        course: Course
    ) -> dict:
        """Загрузка видео на Vimeo."""
        
        headers = {
            "Authorization": f"Bearer {settings.VIMEO_ACCESS_TOKEN}",
            "Content-Type": "application/json",
        }
        
        # Инициирование загрузки
        data = {
            "upload": {
                "approach": "tus",
                "size": os.path.getsize(file_path)
            },
            "name": f"{course.title} - Video",
            "description": course.description,
            "privacy": {"view": "private"}
        }
        
        response = requests.post(
            f"{VideoIntegration.API_BASE}/me/videos",
            json=data,
            headers=headers
        )
        
        return response.json()
    
    @staticmethod
    def get_video_analytics(vimeo_video_id: str) -> dict:
        """Получение аналитики просмотров видео."""
        
        headers = {
            "Authorization": f"Bearer {settings.VIMEO_ACCESS_TOKEN}",
        }
        
        response = requests.get(
            f"{VideoIntegration.API_BASE}/videos/{vimeo_video_id}/stats",
            headers=headers
        )
        
        return response.json()

# backend/app/integrations/analytics.py
class AnalyticsIntegration:
    """Интеграция с Google Analytics для отслеживания поведения пользователей."""
    
    @staticmethod
    def track_event(
        user_id: int,
        event_name: str,
        event_category: str,
        event_value: int = 1
    ):
        """Отправка события в Google Analytics."""
        
        # Подготовка Measurement Protocol запроса
        payload = {
            "v": "1",
            "tid": settings.GA_TRACKING_ID,
            "cid": user_id,
            "t": "event",
            "ec": event_category,
            "ea": event_name,
            "ev": event_value,
        }
        
        requests.post(
            "https://www.google-analytics.com/collect",
            data=payload
        )
    
    @staticmethod
    def track_page_view(user_id: int, page_path: str):
        """Отправка просмотра страницы в Google Analytics."""
        
        payload = {
            "v": "1",
            "tid": settings.GA_TRACKING_ID,
            "cid": user_id,
            "t": "pageview",
            "dp": page_path,
        }
        
        requests.post(
            "https://www.google-analytics.com/collect",
            data=payload
        )
```

---

### 23. Мобильное приложение (React Native)

#### Core Structure для мобильного приложения

```javascript
// mobile/app.json
{
  "expo": {
    "name": "LMS Platform",
    "slug": "lms-platform",
    "version": "1.0.0",
    "assetBundlePatterns": ["**/*"],
    "plugins": [
      "expo-camera",
      "expo-document-picker",
      "expo-file-system"
    ]
  }
}

// mobile/App.tsx
import React, { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SecureStore from 'expo-secure-store';

import { AuthStack } from './navigation/AuthStack';
import { AppStack } from './navigation/AppStack';
import { useAuthStore } from './store/auth';

const Stack = createNativeStackNavigator();

export default function App() {
  const { token, setAuth } = useAuthStore();
  const [isReady, setIsReady] = React.useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        await SplashScreen.preventAutoHideAsync();
        
        // Восстановление сессии
        const savedToken = await SecureStore.getItemAsync('token');
        if (savedToken) {
          // Верификация токена
          const response = await fetch(
            `${process.env.EXPO_PUBLIC_API_URL}/api/auth/me`,
            { headers: { Authorization: `Bearer ${savedToken}` } }
          );
          
          if (response.ok) {
            const user = await response.json();
            setAuth(user, savedToken);
          }
        }
      } catch (e) {
        console.warn(e);
      } finally {
        setIsReady(true);
        await SplashScreen.hideAsync();
      }
    }

    prepare();
  }, []);

  if (!isReady) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {token ? <AppStack /> : <AuthStack />}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// mobile/screens/DashboardScreen.tsx
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { StatCard } from '../components/StatCard';
import { CourseCard } from '../components/CourseCard';
import { api } from '../services/api';

export function DashboardScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => api.get('/api/dashboard/stats'),
  });

  const { data: courses } = useQuery({
    queryKey: ['dashboard', 'courses'],
    queryFn: () => api.get('/api/dashboard/courses'),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Refresh queries
    setRefreshing(false);
  }, []);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <StatCard
          title="Progress"
          value={`${stats?.progress_percent || 0}%`}
          icon="🎯"
        />
        <StatCard
          title="Points"
          value={stats?.points || 0}
          icon="⭐"
        />
      </View>

      {courses?.map((course) => (
        <CourseCard key={course.id} course={course} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    padding: 16,
    gap: 16,
  },
});

// mobile/services/offlineSync.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

class OfflineSyncService {
  private queue: Array<{
    method: string;
    endpoint: string;
    data: any;
    timestamp: number;
  }> = [];

  async syncOfflineActions() {
    const isConnected = (await NetInfo.fetch()).isConnected;
    
    if (!isConnected) return;

    const savedQueue = await AsyncStorage.getItem('offline_queue');
    if (!savedQueue) return;

    const actions = JSON.parse(savedQueue);
    
    for (const action of actions) {
      try {
        await api({
          method: action.method,
          url: action.endpoint,
          data: action.data,
        });
      } catch (error) {
        console.error('Sync failed:', error);
        break; // Stop syncing if one fails
      }
    }

    // Очистка очереди после успешной синхронизации
    await AsyncStorage.removeItem('offline_queue');
  }

  async queueOfflineAction(method: string, endpoint: string, data: any) {
    const queue = await AsyncStorage.getItem('offline_queue');
    const actions = queue ? JSON.parse(queue) : [];
    
    actions.push({
      method,
      endpoint,
      data,
      timestamp: Date.now(),
    });

    await AsyncStorage.setItem('offline_queue', JSON.stringify(actions));
  }
}

export const offlineSyncService = new OfflineSyncService();
```

---

### 24. Документация API и Developer Portal

#### OpenAPI/Swagger Documentation

```python
# backend/app/main.py
from fastapi.openapi.utils import get_openapi

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title="LMS Platform API",
        version="1.0.0",
        description="""
        API для образовательной платформы LMS с AI-помощником и геймификацией.
        
        ## Авторизация
        Используйте JWT токены для авторизации. Получите токен через endpoint `/auth/login`.
        
        ## Rate Limiting
        - Free пользователи: 100 запросов в минуту
        - Premium пользователи: 1000 запросов в минуту
        
        ## Версионирование API
        API использует URL-based версионирование: `/api/v1/...`
        """,
        routes=app.routes,
    )
    
    openapi_schema["info"]["x-logo"] = {
        "url": "https://example.com/logo.png"
    }
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

# Использование decorators для автодокументирования
@router.post(
    "/courses/{course_id}/enroll",
    summary="Запись на курс",
    description="Запись текущего пользователя на указанный курс",
    responses={
        200: {"description": "Успешная запись"},
        400: {"description": "Пользователь уже записан"},
        404: {"description": "Курс не найден"},
    }
)
async def enroll_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Запись пользователя на курс."""
    # Implementation...
```

---

### 25. Обработка ошибок и fallback механизмы

#### Comprehensive Error Handling

```python
# backend/app/core/exceptions.py
class LMSException(Exception):
    """Базовое исключение для LMS приложения."""
    
    def __init__(
        self,
        message: str,
        status_code: int = 400,
        error_code: str = "UNKNOWN_ERROR",
        details: dict = None
    ):
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        self.details = details or {}

class CourseNotFoundError(LMSException):
    def __init__(self, course_id: int):
        super().__init__(
            f"Course with ID {course_id} not found",
            status_code=404,
            error_code="COURSE_NOT_FOUND",
            details={"course_id": course_id}
        )

class InsufficientPointsError(LMSException):
    def __init__(self, required: int, available: int):
        super().__init__(
            f"Insufficient points. Required: {required}, Available: {available}",
            status_code=400,
            error_code="INSUFFICIENT_POINTS",
            details={"required": required, "available": available}
        )

# Error handler middleware
@app.exception_handler(LMSException)
async def lms_exception_handler(request: Request, exc: LMSException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "message": exc.message,
                "code": exc.error_code,
                "details": exc.details,
                "timestamp": datetime.utcnow().isoformat(),
                "path": str(request.url)
            }
        },
    )

# Использование
@router.post("/courses/{course_id}/enroll")
async def enroll_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise CourseNotFoundError(course_id)
    
    return {"status": "enrolled"}
```

---

## ЗАКЛЮЧЕНИЕ (Обновленное)

Расширенный отчет охватывает полный жизненный цикл разработки образовательной LMS платформы, включая:

### Основные компоненты:
1. **Backend архитектура** на FastAPI с REST API
2. **Frontend** на Next.js 16 с React 19
3. **AI интеграция** (OpenAI/Gemini)
4. **Система геймификации** с награми и рейтингом
5. **Платежи** и Premium подписка
6. **Мобильное приложение** на React Native
7. **Безопасность** и защита данных
8. **Мониторинг** и логирование
9. **Тестирование** (Unit, Integration, E2E)
10. **CI/CD Pipeline**

### Технологический стек (обновленный):
- **Backend**: Python, FastAPI, SQLAlchemy, PostgreSQL, Redis
- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Mobile**: React Native, Expo
- **Infrastructure**: Docker, Docker Compose, GitHub Actions
- **Databases**: PostgreSQL (production), Redis (caching), SQLite (dev)
- **External Services**: Stripe, Google Analytics, Vimeo, Google Calendar
- **Testing**: Pytest, React Testing Library, Playwright
- **Monitoring**: ELK Stack, Sentry

### Ключевые особенности:
- Защита от списывания через AI-чат
- Система рекомендаций на основе ML
- Интеграция с платежами (Stripe)
- Оффлайн режим для мобильного приложения
- Real-time уведомления через WebSocket
- Полная аудит-история всех действий
- Масштабируемая архитектура

Проект демонстрирует production-ready подход к разработке современных веб-приложений с интеграцией AI, обеспечивая безопасность, производительность и лучший пользовательский опыт.
