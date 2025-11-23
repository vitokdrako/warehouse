/**
 * Правила розрахунку збитків для кожної категорії товарів
 * 
 * Типи полів:
 * - min: мінімальна сума
 * - max: максимальна сума або 'full' для повного відшкодування
 * - range: [min, max] діапазон
 * - percent: відсоток від повного збитку (0-1)
 * - percentOf: 'full' - базова сума для обчислення відсотку
 */

export const DAMAGE_RULES = {
  'Меблі': {
    groups: [
      {code:'dirty_upholstery', label:'Брудна оббивка / сидіння / каркас', min:1000},
      {code:'chips_cracks_missing', label:'Скол, подряпини, тріщини, втрата деталей', min:800, max:'full'},
      {code:'burn_or_hole', label:'Пропал або дірка', min:5000},
      {code:'dirty_legs', label:'Ніжки брудні в землі/глині/піску', min:800},
      {code:'liquid_spill', label:'Залито рідиною (вода, вино, сік та інше)', range:[1000,2500]},
      {code:'wet', label:'Мокрі або вологі (вода)', range:[1000,2000]},
      {code:'no_brand_bag', label:'Немає фірмового чохла', min:1400},
      {code:'no_stretch', label:'Немає пакування в стрейч', min:800}
    ]
  },
  
  'Столики': {
    groups:[
      {code:'dirty', label:'Брудні', min:500},
      {code:'chips', label:'Сколи або подряпини', range:[1600,3000]},
      {code:'top_missing', label:'Відсутня або пошкоджена столешня', min:1500},
      {code:'no_stretch_pct', label:'Без стрейчування', percentOf:'full', percent:0.30},
      {code:'no_native_pack_pct', label:'Без власного пакування (фірмові чохли, «рідні коробки»)', percentOf:'full', percent:0.50}
    ]
  },
  
  'Пуфи та стільці з текстилем (шкірою)': {
    groups:[
      {code:'dirty_upholstery', label:'Брудна оббивка або сидіння', range:[1200,2000]},
      {code:'frame_damage', label:'Пошкоджений каркас', min:700},
      {code:'dirty_legs', label:'Ніжки брудні в землі/глині/піску', min:800},
      {code:'burn_or_hole', label:'Пропал або дірка', max:'full'},
      {code:'liquid_spill', label:'Залито рідиною (вода, вино, сік та інше)', range:[1200,2000]},
      {code:'wet', label:'Мокрі або вологі (вода)', range:[1000,2000]},
      {code:'no_brand_or_box', label:'Немає фірмового чохла або рідної коробки', min:3000},
      {code:'no_stretch', label:'Немає пакування в стрейч', min:1500}
    ]
  },
  
  'Стільці': {
    groups:[
      {code:'dirty', label:'Брудні', min:700},
      {code:'chips', label:'Сколи або подряпини', min:1500},
      {code:'no_stretch', label:'Без стрейчування', min:1000},
      {code:'wet', label:'Мокрі або вологі', min:1000},
      {code:'broken_full', label:'Зламані, пошкодження які унеможливлюють використання', max:'full'}
    ]
  },
  
  'Тумби / постаменти': {
    groups:[
      {code:'dirty', label:'Брудні', min:800},
      {code:'chips_cracks', label:'Скол, подряпини, тріщини, втрата деталей', min:500, max:'full'},
      {code:'adhesive', label:'З залишками оракалу або інших наліпок', min:500},
      {code:'paint', label:'В фарбі', min:800},
      {code:'no_native_box', label:'Без власного пакування (деревʼяний бокс, чохол)', min:2800},
      {code:'no_stretch_protect', label:'Без пакування в стрейч і захисних елементів (кутики)', min:1600},
      {code:'broken_unusable', label:'Пошкодження, що унеможливлюють використання', max:'full'},
      {code:'wet', label:'Мокрі або вологі', min:200}
    ]
  },
  
  'Свічники (h: до 30 см)': {
    groups:[
      {code:'dirty_wax', label:'Брудні (віск, залишки свічок, сліди горіння)', range:[50,400]},
      {code:'chips', label:'Скол або подряпини', min:100, max:'full'},
      {code:'broken', label:'Зламані, пошкодження які унеможливлюють використання', max:'full'},
      {code:'no_stretch', label:'Без пакування в стрейч', min:60},
      {code:'no_native_pack', label:'Без рідного пакування', min:200},
      {code:'wet', label:'Мокрі або вологі', min:100}
    ]
  },
  
  'Свічники / канделябри (h: 30 см – 1 м)': {
    groups:[
      {code:'dirty_wax', label:'Брудні (віск, залишки свічок, сліди горіння)', range:[100,800]},
      {code:'chips', label:'Скол або подряпини', min:100, max:'full'},
      {code:'broken', label:'Зламані, пошкодження які унеможливлюють використання', max:'full'},
      {code:'no_stretch', label:'Без пакування в стрейч', min:300},
      {code:'no_native_pack', label:'Без рідного пакування', range:[400,800]},
      {code:'wet', label:'Мокрі або вологі', min:200}
    ]
  },
  
  'Канделябри (h: 1,2 м – 1,8 м)': {
    groups:[
      {code:'dirty_wax', label:'Брудні (віск, залишки свічок, сліди горіння)', range:[800,1800]},
      {code:'chips', label:'Скол або подряпини', min:500, max:'full'},
      {code:'broken', label:'Зламані, пошкодження які унеможливлюють використання', max:'full'},
      {code:'no_stretch', label:'Без пакування в стрейч', min:400},
      {code:'no_native_pack', label:'Без рідного пакування', range:[600,1200]},
      {code:'wet', label:'Мокрі або вологі', min:400}
    ]
  },
  
  'Канделябри скляні (можна використовувати тільки LED свічки)': {
    groups:[
      {code:'dirty_fire', label:'Брудні (включаючи сліди живого вогню, віск тощо)', min:6000},
      {code:'chips', label:'Скол або подряпини', min:300, max:'full'},
      {code:'no_stretch_pct', label:'Без пакування в стрейч', percentOf:'full', percent:0.30},
      {code:'no_native_pack_pct', label:'Без рідного пакування', percentOf:'full', percent:0.50},
      {code:'wet', label:'Мокрі або вологі', min:400}
    ]
  },
  
  'Латунь та мідь': {
    groups:[
      {code:'dirty_wax', label:'Брудні (віск, залишки свічок, сліди горіння)', range:[50,800]},
      {code:'chips', label:'Скол', max:'full'},
      {code:'broken', label:'Зламані, пошкодження які унеможливлюють використання', max:'full'},
      {code:'no_stretch_pct', label:'Без пакування в стрейч', percentOf:'full', percent:0.30},
      {code:'no_native_pack_pct', label:'Без рідного пакування', percentOf:'full', percent:0.50},
      {code:'wet', label:'Мокрі або вологі', min:50},
      {code:'oxidation', label:'Окислення від використання хімічних засобів', max:'full'},
      {code:'coating_damage', label:'Пошкоджене покриття', max:'full'}
    ]
  },
  
  'Ліхтарі / флораріуми': {
    groups:[
      {code:'dirty_floral', label:'Брудні (оазис, залишки квітів, їжі, фарба, віск, флористичні матеріали)', range:[100,2000]},
      {code:'chips', label:'Скол або подряпини', min:300, max:'full'},
      {code:'wet_inside', label:'З водою всередині, мокрі, не натерті', range:[400,2000]},
      {code:'no_stretch_pct', label:'Без пакування в стрейч', percentOf:'full', percent:0.30},
      {code:'no_native_pack_pct', label:'Без рідного пакування', percentOf:'full', percent:0.50}
    ]
  },
  
  'Кришталь': {
    groups:[
      {code:'dirty', label:'Брудний', range:[100,500]},
      {code:'chips', label:'Скол або подряпини', min:200, max:'full'},
      {code:'wet_inside', label:'З водою всередині, мокрі, не натерті', range:[50,200]},
      {code:'no_stretch_pct', label:'Без пакування в стрейч', percentOf:'full', percent:0.30},
      {code:'no_native_pack_pct', label:'Без рідного пакування', percentOf:'full', percent:0.50}
    ]
  },
  
  'Підставки під композиції': {
    groups:[
      {code:'dirty', label:'Брудні', range:[200,1000]},
      {code:'chips', label:'Сколи або подряпини', min:700, max:'full'},
      {code:'missing_part', label:'Відсутній або пошкоджений зйомний фрагмент', min:1000, max:'full'},
      {code:'no_stretch_pct', label:'Без стрейчування', percentOf:'full', percent:0.30},
      {code:'no_native_pack_pct', label:'Без власного пакування (фірмові чохли, «рідні коробки»)', percentOf:'full', percent:0.50}
    ]
  },
  
  'Вази': {
    groups:[
      {code:'dirty_floral', label:'Брудні (оазис, залишки квітів, їжі, фарба, віск, флористичні матеріали)', range:[50,2000]},
      {code:'chips', label:'Скол або подряпини', min:200, max:'full'},
      {code:'wet_inside', label:'З водою всередині, мокрі, не натерті', range:[50,800]},
      {code:'broken', label:'Зламані, пошкодження які унеможливлюють використання', max:'full'},
      {code:'no_stretch', label:'Без пакування в стрейч', min:200},
      {code:'no_native_pack', label:'Без рідного пакування', range:[200,800]}
    ]
  },
  
  'Посуд': {
    groups:[
      {code:'dirty_floral', label:'Брудні (оазис, залишки квітів, їжі, фарба, віск, флористичні матеріали)', range:[60,800]},
      {code:'chips', label:'Скол або подряпини', min:200, max:'full'},
      {code:'wet_inside', label:'З водою всередині, мокрі, не натерті', range:[60,200]},
      {code:'no_stretch', label:'Без пакування в стрейч', min:200},
      {code:'no_native_pack', label:'Без рідного пакування', min:400}
    ]
  },
  
  'Підвісні обʼєкти': {
    groups:[
      {code:'dirty', label:'Брудні', range:[500,1000]},
      {code:'chips_integrity', label:'Скол, порушення цілісності, подряпини', min:300, max:'full'},
      {code:'wet_inside', label:'З водою всередині, мокрі, не натерті', range:[100,800]},
      {code:'no_stretch_pct', label:'Без пакування в стрейч', percentOf:'full', percent:0.30},
      {code:'no_native_pack_pct', label:'Без рідного пакування', percentOf:'full', percent:0.50}
    ]
  },
  
  'Акрилові куби': {
    groups:[
      {code:'dirty', label:'Брудні', min:800},
      {code:'chips', label:'Сколи або подряпини', min:6000},
      {code:'adhesive', label:'З залишками оракалу або інших наліпок', min:900},
      {code:'paint', label:'В фарбі', min:1200},
      {code:'no_stretch_protect', label:'Без пакування в стрейч і захисні елементи', min:2000},
      {code:'broken', label:'Зламані', max:'full'},
      {code:'wet', label:'Мокрі або вологі', min:200}
    ]
  },
  
  'Дзеркальні кулі': {
    groups:[
      {code:'dirty', label:'Брудні', range:[500,1000]},
      {code:'chips_missing', label:'Скол, подряпини або втрата деталей', range:[300,3000]},
      {code:'broken_unusable', label:'Бій, пошкодження які унеможливлюють використання', max:'full'},
      {code:'structure_damage', label:'Порушення цілісності конструкції', range:[1000,15000]},
      {code:'wet', label:'Вологі або мокрі', range:[500,3000]},
      {code:'no_package', label:'Без пакування (чохол, бокс, фірмова коробка)', min:2000}
    ]
  },
  
  'Світлові декорації': {
    groups:[
      {code:'dirty', label:'Брудні', range:[500,5000]},
      {code:'chips', label:'Скол або подряпини', min:200, max:'full'},
      {code:'broken_unusable', label:'Бій, зламані, пошкодження які унеможливлюють використання', max:'full'},
      {code:'wet', label:'Вологі або мокрі (вода)', min:100, max:'full'},
      {code:'disassembled', label:'Розібрані (гірлянди не складені цоколь до цоколя, не скріплені стяжками)', min:500},
      {code:'needs_restore', label:'Пошкодження які потребують подальшого реставрування', range:[2500,15000]},
      {code:'no_package_pct', label:'Без пакування (чохол, бокс, фірмова коробка)', percentOf:'full', percent:0.40}
    ]
  },
  
  'Фігури гіпс (бюст, голови)': {
    groups:[
      {code:'broken', label:'Бій', max:'full'},
      {code:'chips_restore', label:'Подряпини, скол (реставрація)', range:[1000,2000]},
      {code:'wet', label:'Вологі або мокрі (вода)', range:[500,1000]},
      {code:'no_package_pct', label:'Без пакування (чохол, бокс, фірмова коробка)', percentOf:'full', percent:0.40}
    ]
  },
  
  'Текстиль': {
    groups:[
      {code:'dirty_stains', label:'Брудні (плями від їжі, напоїв, віск)', range:[250,3500]},
      {code:'wet', label:'Вологі або мокрі (вода)', range:[300,3000]},
      {code:'burn_or_hole', label:'Пропал або дірка', max:'full'},
      {code:'no_bag_pct', label:'Скатертина / плед без фірмового пакування (текстильна сумка)', percentOf:'full', percent:0.30},
      {code:'tablecloth_no_stretch_pct', label:'Скатертина / плед без стрейчу', percentOf:'full', percent:0.10},
      {code:'napkins_no_stretch_pct', label:'Серветки без стрейчу', percentOf:'full', percent:0.50},
      {code:'no_stretch', label:'Без пакування в стрейч', min:300}
    ]
  },
  
  'Килими': {
    groups:[
      {code:'dirty', label:'Брудні', range:[2000,5000]},
      {code:'burn_or_hole', label:'Пропал або дірка', max:'full'},
      {code:'pull_damage', label:'Затяжка або інше пошкодження, яке потребує реставрації', min:1000, max:'full'},
      {code:'wet', label:'Вологі або мокрі (вода)', range:[1000,2500]},
      {code:'no_stretch', label:'Без пакування в стрейч', min:500}
    ]
  },
  
  'Техніка': {
    groups:[
      {code:'dirty', label:'Брудні (земля, глина, фарба, флористичний матеріал)', range:[200,1200]},
      {code:'wet', label:'Вологі або мокрі (вода)', range:[50,400]},
      {code:'chips', label:'Скол або подряпини', range:[500,1200]},
      {code:'malfunction', label:'Поломка або неналежне використання', min:1000, max:'full'}
    ]
  },
  
  'Етно': {
    groups:[
      {code:'dirty', label:'Брудний реквізит', range:[100,2000]},
      {code:'wet', label:'Вологий або мокрий (вода)', range:[100,2000]},
      {code:'damage', label:'Скол, подряпина або інший вид пошкодження', min:200, max:'full'},
      {code:'no_package_pct', label:'Відсутність пакування як при видачі', percentOf:'full', percent:0.20}
    ]
  },
  
  'Нумерація столів (рамки, тримачі карток)': {
    groups:[
      {code:'dirty', label:'Брудні', range:[100,500]},
      {code:'wet', label:'Вологі або мокрі (вода)', range:[50,300]},
      {code:'damaged', label:'Пошкоджені', max:'full'},
      {code:'no_stretch_pct', label:'Без пакування в стрейч', percentOf:'full', percent:0.30},
      {code:'no_envelope', label:'Без рідного пакування (конверт, коробка)', min:200}
    ]
  },
  
  'Декоративна квітка': {
    groups:[
      {code:'dirty', label:'Брудні', range:[50,1000]},
      {code:'wet', label:'Вологі або мокрі (вода)', min:50},
      {code:'damaged_restore', label:'Пошкоджені (можлива реставрація)', range:[100,1000]},
      {code:'no_package_pct', label:'Відсутність пакування (чохол або пластиковий бокс)', percentOf:'full', percent:0.50}
    ]
  },
  
  'Дзеркала / рамки': {
    groups:[
      {code:'dirty', label:'Брудні', range:[400,2000]},
      {code:'adhesive', label:'З залишками оракалу або інших наліпок', range:[400,2000]},
      {code:'wet', label:'Вологі або мокрі (вода)', range:[200,800]},
      {code:'damaged_missing', label:'Пошкоджені, втрата деталей та елементів', min:1000, max:'full'},
      {code:'no_package_pct', label:'Без пакування (гофрокартон та стрейч-плівка)', percentOf:'full', percent:0.30}
    ]
  },
  
  'Скриньки': {
    groups:[
      {code:'dirty', label:'Брудні', range:[100,600]},
      {code:'wet', label:'Вологі або мокрі (вода)', min:100, max:'full'},
      {code:'damaged_restore', label:'Пошкоджені (можлива реставрація), відсутність комплектації (повна / часткова)', min:300, max:'full'},
      {code:'broken_loss', label:'Пошкоджені (експлуатація неможлива), втрата', max:'full'},
      {code:'no_stretch_pct', label:'Без пакування в стрейч', percentOf:'full', percent:0.30},
      {code:'no_envelope_pct', label:'Без рідного пакування (конверт, коробка)', percentOf:'full', percent:0.50}
    ]
  },
  
  'Ігри': {
    groups:[
      {code:'dirty', label:'Брудні', min:100, max:'full'},
      {code:'wet', label:'Вологі або мокрі (вода)', min:100, max:'full'},
      {code:'damaged_incomplete', label:'Пошкоджені (можлива реставрація), відсутність комплектації (повна / часткова)', min:500, max:'full'},
      {code:'broken_loss', label:'Пошкоджені (експлуатація неможлива), втрата', max:'full'},
      {code:'no_package_pct', label:'Відсутність пакування як при видачі', percentOf:'full', percent:0.35}
    ]
  },
  
  'Клітки': {
    groups:[
      {code:'dirty', label:'Брудні', range:[100,1500]},
      {code:'wet', label:'Вологі або мокрі (вода)', range:[100,500]},
      {code:'damaged_incomplete', label:'Пошкоджені (можлива реставрація), відсутність комплектації (повна / часткова)', min:800, max:'full'},
      {code:'broken_loss', label:'Пошкоджені (експлуатація неможлива), втрата', max:'full'},
      {code:'no_package_pct', label:'Відсутність пакування як при видачі', percentOf:'full', percent:0.25}
    ]
  },
  
  'Конструктиви': {
    groups:[
      {code:'dirty', label:'Брудні', range:[300,4000]},
      {code:'wet', label:'Вологі або мокрі (вода)', min:200, max:'full'},
      {code:'damaged_incomplete', label:'Пошкоджені (можлива реставрація), відсутність комплектації (повна / часткова)', min:1500, max:'full'},
      {code:'broken_loss', label:'Пошкоджені (експлуатація неможлива), втрата', max:'full'},
      {code:'no_package_pct', label:'Відсутність пакування як при видачі', percentOf:'full', percent:0.35}
    ]
  },
  
  'Реквізит': {
    groups:[
      {code:'dirty', label:'Брудний', range:[100,3000]},
      {code:'wet', label:'Вологий або мокрий (вода)', range:[50,2000]},
      {code:'damaged_incomplete', label:'Пошкоджений (можлива реставрація), відсутність комплектації (повна / часткова)', range:[200,3000]},
      {code:'broken_loss', label:'Пошкоджений (експлуатація неможлива), втрата', max:'full'},
      {code:'no_package_pct', label:'Відсутність пакування як при видачі', percentOf:'full', percent:0.35}
    ]
  },
  
  'Новий рік': {
    groups:[
      {code:'dirty', label:'Брудний', range:[100,5000]},
      {code:'wet', label:'Вологий або мокрий (вода)', range:[50,4000]},
      {code:'damaged_incomplete', label:'Пошкоджений (можлива реставрація), відсутність комплектації (повна / часткова)', min:200, max:'full'},
      {code:'broken_loss', label:'Пошкоджені (експлуатація неможлива), втрата', max:'full'},
      {code:'no_package_pct', label:'Відсутність пакування як при видачі', percentOf:'full', percent:0.35}
    ]
  },
  
  'Розкладний чорний бокс': {
    groups:[
      {code:'dirty', label:'Брудний', range:[100,400]},
      {code:'wet', label:'Мокрий', range:[50,200]},
      {code:'loss_or_damage', label:'Втрата або пошкодження', min:800}
    ]
  }
};

export function defaultFeeFor(kindObj) {
  if (!kindObj) return 0;
  if (typeof kindObj.min === 'number') return kindObj.min;
  if (Array.isArray(kindObj.range)) return kindObj.range[0];
  return 0;
}
