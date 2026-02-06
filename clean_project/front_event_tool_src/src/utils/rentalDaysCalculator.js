/**
 * Rental Days Calculator
 * Калькулятор діб оренди за правилами FarForRent
 * 
 * Правила:
 * 2 доби:
 * - понеділок видача → четвер повернення до 17:00
 * - вівторок видача → п'ятниця повернення до 17:00
 * - середа видача → субота повернення до 17:00
 * - п'ятниця видача → вівторок повернення до 17:00
 * - субота видача → вівторок повернення до 17:00
 * 
 * 1 доба:
 * - понеділок видача → середа повернення до 17:00
 * - вівторок видача → четвер повернення до 17:00
 * - середа видача → п'ятниця повернення до 17:00
 * - четвер видача → субота повернення до 17:00
 * - п'ятниця видача → субота повернення до 17:00
 * - субота видача → понеділок повернення до 17:00
 */

// День тижня: 0 = неділя, 1 = понеділок, ..., 6 = субота

const TWO_DAYS_PATTERNS = [
  { issue: 1, return: 4 },  // пн → чт
  { issue: 2, return: 5 },  // вт → пт
  { issue: 3, return: 6 },  // ср → сб
  { issue: 5, return: 2 },  // пт → вт (через вихідні)
  { issue: 6, return: 2 },  // сб → вт (через вихідні)
];

const ONE_DAY_PATTERNS = [
  { issue: 1, return: 3 },  // пн → ср
  { issue: 2, return: 4 },  // вт → чт
  { issue: 3, return: 5 },  // ср → пт
  { issue: 4, return: 6 },  // чт → сб
  { issue: 5, return: 6 },  // пт → сб
  { issue: 6, return: 1 },  // сб → пн
];

/**
 * Розрахувати кількість діб оренди за правилами
 * @param {Date|string} issueDate - Дата видачі
 * @param {Date|string} returnDate - Дата повернення
 * @returns {Object} { days: number, isApproximate: boolean, explanation: string }
 */
export const calculateRentalDays = (issueDate, returnDate) => {
  if (!issueDate || !returnDate) {
    return { days: 0, isApproximate: true, explanation: 'Вкажіть дати' };
  }
  
  const issue = new Date(issueDate);
  const return_ = new Date(returnDate);
  
  // Базова різниця в днях
  const diffTime = return_.getTime() - issue.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 0) {
    return { days: 0, isApproximate: false, explanation: 'Некоректні дати' };
  }
  
  const issueDay = issue.getDay();
  const returnDay = return_.getDay();
  
  // Перевіряємо чи це патерн 2 доби
  const isTwoDays = TWO_DAYS_PATTERNS.some(
    p => p.issue === issueDay && p.return === returnDay
  );
  
  if (isTwoDays && diffDays >= 3 && diffDays <= 4) {
    return { 
      days: 2, 
      isApproximate: true, 
      explanation: 'Розрахунок за правилами вихідних' 
    };
  }
  
  // Перевіряємо чи це патерн 1 доба
  const isOneDay = ONE_DAY_PATTERNS.some(
    p => p.issue === issueDay && p.return === returnDay
  );
  
  if (isOneDay && diffDays >= 1 && diffDays <= 2) {
    return { 
      days: 1, 
      isApproximate: true, 
      explanation: 'Стандартна оренда 1 доба' 
    };
  }
  
  // Для більш довгих періодів - приблизний розрахунок
  // Враховуємо що вихідні рахуються як 2 доби
  let calculatedDays = 0;
  let currentDate = new Date(issue);
  
  while (currentDate < return_) {
    const dayOfWeek = currentDate.getDay();
    
    // П'ятниця або субота - це "вихідний" день (рахується як частина 2-денного періоду)
    if (dayOfWeek === 5 || dayOfWeek === 6) {
      // Перевіряємо чи це повний вихідний період
      if (dayOfWeek === 5) {
        // П'ятниця - додаємо 2 за пт-сб-нд-пн
        calculatedDays += 2;
        currentDate.setDate(currentDate.getDate() + 4); // До вівторка
      } else {
        // Субота - додаємо 2 за сб-нд-пн
        calculatedDays += 2;
        currentDate.setDate(currentDate.getDate() + 3); // До вівторка
      }
    } else {
      // Будній день - 1 доба = 2 календарних дні
      calculatedDays += 1;
      currentDate.setDate(currentDate.getDate() + 2);
    }
  }
  
  // Мінімум 1 доба
  calculatedDays = Math.max(1, calculatedDays);
  
  return { 
    days: calculatedDays, 
    isApproximate: true, 
    explanation: 'Приблизний розрахунок. Менеджер уточнить.' 
  };
};

/**
 * Простий розрахунок для UI (без складної логіки)
 * Використовується коли потрібен швидкий приблизний результат
 */
export const calculateSimpleRentalDays = (issueDate, returnDate) => {
  if (!issueDate || !returnDate) return 1;
  
  const issue = new Date(issueDate);
  const return_ = new Date(returnDate);
  
  const diffTime = return_.getTime() - issue.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 0) return 1;
  if (diffDays <= 2) return 1;
  if (diffDays <= 4) return 2;
  
  // Для довших періодів - приблизно 1 доба за 2 календарних дні
  return Math.max(1, Math.ceil(diffDays / 2));
};

/**
 * Отримати день тижня українською
 */
export const getDayName = (date) => {
  const days = ['неділя', 'понеділок', 'вівторок', 'середа', 'четвер', "п'ятниця", 'субота'];
  return days[new Date(date).getDay()];
};

/**
 * Форматувати діапазон дат
 */
export const formatDateRange = (issueDate, returnDate) => {
  if (!issueDate || !returnDate) return '';
  
  const issue = new Date(issueDate);
  const return_ = new Date(returnDate);
  
  const formatDate = (d) => d.toLocaleDateString('uk-UA', { 
    day: 'numeric', 
    month: 'short' 
  });
  
  return `${formatDate(issue)} (${getDayName(issue)}) → ${formatDate(return_)} (${getDayName(return_)})`;
};

export default {
  calculateRentalDays,
  calculateSimpleRentalDays,
  getDayName,
  formatDateRange
};
