export type DayHourSchedule<T extends object = object> = T & {
  /** Day starting from 0 */
  day: number;
  /** Hours in "HH:MM" format */
  hours?: string[];
};

export type DaySchedule<T extends object = object> = DayHourSchedule<T> & {
  /** Duration in days */
  duration?: number;  // durata del trattamento in giorni
  /** Duration of the period in days */
  period_duration?: number; // periodicità ciclica *
  /** Specific days within the period */
  period_days?: DayHourSchedule<T>[];
};

// *= se io segno che period_duration = 1 -> devo prendere il farmaco ogni giorno -> dentro period_days metto gli orari specifici
// se io segno che period_duration = 2 -> devo prendere il farmaco ogni due giorni

/*
Altri esempi:

"Devo prendere il farmaco una volta al giorno per 10 giorni alle 8:00 del mattino"
day = 0 // il giorno in cui inizia la terapia e.g. se fosse "inzia tra 5 giorni" -> day = 5
hours = ["08:00"] // orario di default in cui si prende il farmaco
duration = 10
period_duration = 1 // una volta al giorno
period_days = undefined // se sono specificati qui degli orari, questi sovrascrivono l'orario di default
 
"Devo prendere il farmaco ogni 2 giorni per 14 giorni per due volte al giorno alle 9:00 e alle 21:00"
day = 0
hours = ["09:00", "21:00"]
duration = 14
period_duration = 2 // una volta ogni due giorni
period_days = [{ day: 0 }]

"Devo prendere un farmaco lunedì mercoledì e venerdì alle 12:00"
day = 0
hours = ["12:00"]
duration = undefined
period_duration = 7 // una volta alla settimana (ciclicità)
period_days = [
  { day: 0 }, // lunedì
  { day: 2 }, // mercoledì
  { day: 4 }  // venerdì
];

"Devo prendere un farmaco una volta al mese - devo iniziare tra 3 giorni"
day = 3
hours = undefined
duration = undefined
period_duration = 30 // una volta al mese
period_days = [{ day: 0 }] // il primo giorno del periodo (giorno 0)

"Devo prendere un farmaco il lunedì alle 8:00 e il giovedì alle 20:00 per 8 settimane"
day = 0
hours = undefined
duration = 56 // 8 settimane
period_duration = 7 // una volta alla settimana
period_days = [
  { day: 0, hours: ["08:00"] }, // lunedì alle 8:00
  { day: 3, hours: ["20:00"] }  // giovedì alle 20:00
];
*/

export type TherapyDrug = {
  drug: string; // nome farmaco
  notes?: string; // "da prendere a stomaco pieno", "da prendere dopo i pasti", ecc. (note che non hanno a che fare con lo schedule)
  schedule: DaySchedule<{
    dose: number;
  }>;
};

// test con dosi e durata
// test con orari
// test con periodi
