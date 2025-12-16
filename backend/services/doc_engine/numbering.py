"""
Document Numbering - генерація номерів документів
Формат: {SERIES}-{YEAR}-{SEQ:06d}
Приклад: INV-2025-000123
"""
from datetime import datetime
from sqlalchemy import text
from sqlalchemy.orm import Session

def generate_doc_number(db: Session, series: str) -> str:
    """
    Генерує унікальний номер документа.
    Використовує таблицю doc_number_sequences для атомарної генерації.
    """
    year = datetime.now().year
    
    # Спробуємо оновити існуючу серію
    result = db.execute(text("""
        UPDATE doc_number_sequences 
        SET current_seq = current_seq + 1,
            updated_at = NOW()
        WHERE series = :series AND year = :year
        RETURNING current_seq
    """), {"series": series, "year": year})
    
    row = result.fetchone()
    
    if row:
        seq = row[0]
    else:
        # Створюємо нову серію
        db.execute(text("""
            INSERT INTO doc_number_sequences (series, year, current_seq, created_at, updated_at)
            VALUES (:series, :year, 1, NOW(), NOW())
            ON CONFLICT (series, year) DO UPDATE SET current_seq = doc_number_sequences.current_seq + 1
            RETURNING current_seq
        """), {"series": series, "year": year})
        seq = 1
    
    db.commit()
    
    return f"{series}-{year}-{seq:06d}"

def parse_doc_number(doc_number: str) -> dict:
    """Розбирає номер документа на компоненти"""
    parts = doc_number.split("-")
    if len(parts) != 3:
        return None
    return {
        "series": parts[0],
        "year": int(parts[1]),
        "seq": int(parts[2])
    }
