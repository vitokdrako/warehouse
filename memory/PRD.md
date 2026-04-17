# RentalHub PRD

## Architecture
- **Frontend**: React (CRA) -> `/app/clean_project/frontend_build/`
- **Backend**: FastAPI on port 8001
- **Database**: MySQL (OpenCart DB + RentalHub DB)
- **Production**: Frontend `rentalhub.farforrent.com.ua`, Backend `backrentalhub.farforrent.com.ua`

## Completed Features (2026-04-17)
- **Image Project (Іміджевий проєкт)** feature:
  - `POST /api/orders/{id}/mark-image-project` — marks order, sets 100% discount, cancels all pending transactions
  - `POST /api/orders/{id}/unmark-image-project` — reverts to normal
  - Uses existing `deal_mode` DB field (`rent` → `image_project`)
  - Badge "Іміджевий проєкт" on order workspace header (violet)
  - Button in footer actions when order status = `returned`
  - "Скасувати іміджевий" button when already marked
  - Order 7464 fixed: deal_mode=image_project, discount=100%, transactions cleared
- **Bulk Product Editor** (22 columns, drag&drop, inline editing, filters)
- **Product image URL fix** (getImageUrl wrapper + COALESCE SQL)
- **Incassation 55000 UAH deleted** from both fin_transactions and fin_expenses

## Key Files Modified
- `/app/backend/routes/orders.py` — image project endpoints + deal_mode in response
- `/app/frontend/src/pages/NewOrderViewWorkspace.jsx` — button + dealMode prop
- `/app/frontend/src/components/order-workspace/OrderWorkspaceLayout.jsx` — badge
- `/app/backend/routes/bulk_products.py` — bulk editor API
- `/app/frontend/src/components/admin/BulkProductEditor.jsx` — bulk editor UI

## Pending
- P1: `invoice_legal` template fix
- P2: `convert-to-order` instability, Moodboard, Calendar timezone
- P2: Finmap API (postponed)
- P3: WebSockets, RBAC, HR/Ops, Telegram bot
