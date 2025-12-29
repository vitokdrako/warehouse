from fastapi import FastAPI, APIRouter
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path

# Load environment variables FIRST
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Import route modules AFTER loading env
from routes import inventory, clients, orders, tasks, damages, finance, test_orders, settings, pdf, users, issue_cards, return_cards, photos, qr_codes, email, catalog, archive, warehouse, extended_catalog, audit, products, auth, image_proxy, price_sync, damage_cases, admin, product_damage_history, product_reservations, inventory_adjustments, sync, product_cleaning, migrations, product_images, event_tool_integration, user_tracking, laundry, documents, analytics, product_sets, expense_management, export, template_admin, order_modifications, order_internal_notes

# Create the main app
app = FastAPI(title="Rental Hub API")

# Налаштувати статичні файли для завантажених зображень
UPLOAD_ROOT = ROOT_DIR / "uploads"
UPLOAD_ROOT.mkdir(exist_ok=True)
(UPLOAD_ROOT / "products").mkdir(exist_ok=True)
(UPLOAD_ROOT / "photos").mkdir(exist_ok=True)
(UPLOAD_ROOT / "qr").mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_ROOT)), name="uploads")

# Налаштувати статичні файли для мігрованих зображень товарів
STATIC_ROOT = ROOT_DIR / "static"
STATIC_ROOT.mkdir(exist_ok=True)
(STATIC_ROOT / "images").mkdir(exist_ok=True)
(STATIC_ROOT / "images" / "products").mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_ROOT)), name="static")

# Add CORS middleware (MUST be before routers)
cors_origins = os.environ.get('CORS_ORIGINS', '*')
if cors_origins == '*':
    cors_origins_list = ["*"]
    allow_cred = False  # Cannot use credentials with wildcard origin
else:
    cors_origins_list = [o.strip() for o in cors_origins.split(',')]
    allow_cred = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins_list,
    allow_credentials=allow_cred,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept"],
    expose_headers=["*"],
    max_age=600,
)

# Include routers
app.include_router(inventory.router)
app.include_router(clients.router)
app.include_router(orders.router)
app.include_router(orders.decor_router)  # ✅ Додано для сумісності з /api/decor-orders
app.include_router(test_orders.router)
app.include_router(auth.router)
app.include_router(tasks.router)
app.include_router(damages.router)
app.include_router(finance.router)
app.include_router(finance.manager_router)  # /api/manager/finance/* для ManagerDashboard
app.include_router(settings.router)
app.include_router(pdf.router)
app.include_router(users.router)
app.include_router(issue_cards.router)
app.include_router(return_cards.router)
app.include_router(photos.router)
app.include_router(qr_codes.router)
app.include_router(email.router)
app.include_router(catalog.router)
app.include_router(archive.router)
app.include_router(warehouse.router)
app.include_router(extended_catalog.router)
app.include_router(audit.router)
app.include_router(products.router)
app.include_router(image_proxy.router)
app.include_router(price_sync.router)
app.include_router(damage_cases.router)
app.include_router(admin.router)
app.include_router(product_damage_history.router)
app.include_router(product_reservations.router)
app.include_router(inventory_adjustments.router)
app.include_router(sync.router)
app.include_router(product_cleaning.router)
app.include_router(migrations.router)
app.include_router(product_images.router)
app.include_router(event_tool_integration.router)
app.include_router(user_tracking.router)
app.include_router(laundry.router)
app.include_router(documents.router)
app.include_router(analytics.router)
app.include_router(product_sets.router)
app.include_router(expense_management.router)
app.include_router(export.router)
app.include_router(template_admin.router)
app.include_router(order_modifications.router)
app.include_router(order_internal_notes.router)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Health check
@app.get("/api/")
async def root():
    return {"message": "Rental Hub API is running", "status": "ok"}

@app.get("/api/health")
async def health():
    return {"status": "healthy", "database": "mysql"}


# OPTIONS handler для CORS preflight
@app.options("/{full_path:path}")
async def options_handler(full_path: str):
    return {"message": "OK"}
