"""
Обновляет средний балл студента на первом месте (Асель Дәулет, student2@edu.kz) до 98.9.
Запуск: cd backend && python update_student_score.py
"""
import sys
sys.path.insert(0, '.')

from app.core.database import SessionLocal
from app.models import User, StudentProgress
from decimal import Decimal

def update_score():
    db = SessionLocal()
    try:
        # Находим студента Асель Дәулет (student2@edu.kz)
        student = db.query(User).filter(User.email == "student2@edu.kz").first()
        if not student:
            print("Студент student2@edu.kz не найден.")
            return

        # Получаем все записи прогресса для этого студента
        progress_records = db.query(StudentProgress).filter(
            StudentProgress.user_id == student.id,
            StudentProgress.is_completed == True
        ).all()

        if not progress_records:
            print(f"У студента {student.full_name} нет записей прогресса.")
            return

        # Обновляем баллы так, чтобы средний был точно 98.9
        target_avg = Decimal("98.9")
        num_records = len(progress_records)
        
        if num_records == 0:
            print("Нет записей прогресса для обновления.")
            return
        
        # Вычисляем общую сумму баллов для получения среднего 98.9
        total_needed = target_avg * num_records
        
        # Устанавливаем все баллы на 98.9, кроме последнего
        base_score = Decimal("98.9")
        total_set = Decimal("0")
        
        for idx, progress in enumerate(progress_records):
            if idx < num_records - 1:
                # Для всех кроме последнего устанавливаем 98.9
                score = base_score
            else:
                # Последний балл корректируем так, чтобы сумма была точно target_avg * num_records
                score = total_needed - total_set
                # Округляем до 2 знаков после запятой
                score = score.quantize(Decimal("0.01"))
            
            progress.test_score = score
            total_set += score
        
        db.commit()
        
        # Проверяем результат
        avg_score = float(total_set) / num_records
        print(f"Обновлено {num_records} записей прогресса для {student.full_name}")
        print(f"Новый средний балл: {avg_score:.2f}")
    finally:
        db.close()


if __name__ == "__main__":
    update_score()
