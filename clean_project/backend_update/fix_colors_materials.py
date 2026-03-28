#!/usr/bin/env python3
"""
Очистка кольорів та матеріалів в БД products
- Приведення до нижнього регістру
- Виправлення друкарських помилок
- Об'єднання дублів
"""
import sys
sys.path.insert(0, '/app/backend')
from database_rentalhub import RHSessionLocal
from sqlalchemy import text

# === МАППІНГ КОЛЬОРІВ ===
COLOR_MAP = {
    # Регістр
    'Чорний': 'чорний',
    'Білий': 'білий',
    'Червоний': 'червоний',
    'Рожевий': 'рожевий',
    'Зелений': 'зелений',
    'Коричневий': 'коричневий',
    'Блакитний': 'блакитний',
    'Синій': 'синій',
    'Бежевий': 'бежевий',
    # Дублі → канонічна форма
    'бордо': 'бордовий',
    'золотий': 'золото',
    'срібний': 'срібло',
    'мідний': 'мідь',
    'теракотовий': 'теракот',
    'різнокольорове': 'різнокольоровий',
    # Друкарські помилки
    'помаранччевий': 'помаранчевий',
    'помаренчевий': 'помаранчевий',
    'светло-сірий': 'світло-сірий',
    # Складені → розділити (обробимо окремо)
    'чорний білий': 'чорний, білий',
    'білий чорний': 'білий, чорний',
    'темно синій': 'темно-синій',
    'темно рожевий': 'темно-рожевий',
    'ніжно-рожевий': 'ніжно-рожевий',  # ok
    'синій перламутр': 'синій перламутр',  # ok
    'з квітами': 'різнокольоровий',
    'стально-блакитний': 'стально-блакитний',  # ok
    'кольоровий': 'різнокольоровий',
}

# === МАППІНГ МАТЕРІАЛІВ ===
MATERIAL_MAP = {
    # Регістр
    'Габардин': 'габардин',
    'Блекаут': 'блекаут',
    'Текстиль': 'текстиль',
    'Шкіра': 'шкіра',
    'Плюш': 'плюш',
    'Плівка': 'плівка',
    'Метал': 'метал',
    # Друкарські помилки
    'ддзеркало': 'дзеркало',
    'металл': 'метал',
    'водоросли': 'водорості',
    'водоросли': 'водорості',
    'джуг': 'джут',
    'джгут': 'джут',
    'пенополістерол': 'пенополістирол',
    'универсал': 'універсал',
    'чугун': 'чавун',
    # Дублі чинчила
    'чин-чила': 'чинчила',
    'чін-чіла': 'чинчила',
    'чінчіла': 'чинчила',
    # Складені
    'метал и скло': 'метал, скло',
    'еко шкіра': 'екошкіра',
}


def fix_field(db, field_name, mapping):
    """Виправити значення поля в products"""
    fixed = 0
    for old_val, new_val in mapping.items():
        # Exact match
        result = db.execute(
            text(f"SELECT COUNT(*) FROM products WHERE {field_name} = :old"),
            {"old": old_val}
        ).fetchone()
        if result[0] > 0:
            db.execute(
                text(f"UPDATE products SET {field_name} = :new WHERE {field_name} = :old"),
                {"old": old_val, "new": new_val}
            )
            print(f"  '{old_val}' → '{new_val}' ({result[0]} записів)")
            fixed += result[0]
        
        # Also fix within comma-separated values
        # e.g. "золотий, білий" → "золото, білий"
        like_result = db.execute(
            text(f"SELECT product_id, {field_name} FROM products WHERE {field_name} LIKE :pattern AND {field_name} != :old"),
            {"pattern": f"%{old_val}%", "old": old_val}
        ).fetchall()
        for row in like_result:
            pid = row[0]
            current = row[1]
            parts = [p.strip() for p in current.split(',')]
            new_parts = []
            changed = False
            for p in parts:
                if p == old_val:
                    new_parts.append(new_val)
                    changed = True
                else:
                    new_parts.append(p)
            if changed:
                new_value = ', '.join(new_parts)
                db.execute(
                    text(f"UPDATE products SET {field_name} = :new WHERE product_id = :pid"),
                    {"new": new_value, "pid": pid}
                )
                print(f"  [{pid}] '{current}' → '{new_value}'")
                fixed += 1
    
    return fixed


def main():
    db = RHSessionLocal()
    
    print("=== ВИПРАВЛЕННЯ КОЛЬОРІВ ===")
    color_fixed = fix_field(db, 'color', COLOR_MAP)
    print(f"\nВиправлено кольорів: {color_fixed}")
    
    print("\n=== ВИПРАВЛЕННЯ МАТЕРІАЛІВ ===")
    material_fixed = fix_field(db, 'material', MATERIAL_MAP)
    print(f"\nВиправлено матеріалів: {material_fixed}")
    
    db.commit()
    print(f"\n✅ ГОТОВО! Кольорів: {color_fixed}, Матеріалів: {material_fixed}")
    
    # Verify
    print("\n=== ПЕРЕВІРКА ПІСЛЯ ВИПРАВЛЕННЯ ===")
    r = db.execute(text("""
        SELECT color, COUNT(*) as cnt FROM products 
        WHERE color IS NOT NULL AND color != '' AND status = 1
        GROUP BY color ORDER BY cnt DESC
    """)).fetchall()
    color_counts = {}
    for row in r:
        parts = [c.strip() for c in row[0].split(',') if c.strip()]
        for p in parts:
            color_counts[p] = color_counts.get(p, 0) + row[1]
    sorted_colors = sorted(color_counts.items(), key=lambda x: -x[1])
    print(f"\nКольори ({len(sorted_colors)}):")
    for c, n in sorted_colors:
        print(f"  {c} ({n})")
    
    r2 = db.execute(text("""
        SELECT material, COUNT(*) as cnt FROM products 
        WHERE material IS NOT NULL AND material != '' AND status = 1
        GROUP BY material ORDER BY cnt DESC
    """)).fetchall()
    mat_counts = {}
    for row in r2:
        parts = [m.strip() for m in row[0].split(',') if m.strip()]
        for p in parts:
            mat_counts[p] = mat_counts.get(p, 0) + row[1]
    sorted_mats = sorted(mat_counts.items(), key=lambda x: -x[1])
    print(f"\nМатеріали ({len(sorted_mats)}):")
    for m, n in sorted_mats:
        print(f"  {m} ({n})")
    
    db.close()


if __name__ == "__main__":
    main()
