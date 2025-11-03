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

/*
Esempi:

"Devo prendere il farmaco una volta al giorno per 10 giorni alle 8:00 del mattino"
day = 0 // il giorno in cui inizia la terapia e.g. se fosse "inzia tra 5 giorni" -> day = 5
hours = ["08:00"] // orario di default in cui si prende il farmaco
duration = 10
 
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
period_duration = 7 // ciclicità settimanale
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
period_duration = 7 // ciclicità settimanale
period_days = [
  { day: 0, hours: ["08:00"] }, // lunedì alle 8:00
  { day: 3, hours: ["20:00"] }  // giovedì alle 20:00
];
*/

export type TherapyDrug = {
  // drug (almeno uno tra drug_name e drug_api deve essere specificato)
  drug_name?: string; // nome commerciale completo
  drug_api?: string; // principio attivo
  schedule: DaySchedule<{
    dose: number; // dosi per assunzione (es. "2 compresse")
    times?: number; // numero di volte al giorno (es. "3 volte al giorno")
    hours_text?: string; // indicazioni libere sugli orari (es. "mattina e sera", "dopo i pasti", ecc.)
  }>;
  optional?: boolean; // se il farmaco è opzionale (es. al bisogno)
  notes?: string; // indicazioni aggiuntive da seguire se non specificate altrove, quali: condizioni particolari, informazioni sui giorni.. (es. "in presenza di X..", 2 volte a settimana")
};

/*

Note:
- se period_duration è maggiore di 1, period_days deve contenere almeno un elemento, e viceversa
- se duration è definito, il calcolo dello schedule termina dopo "day + duration" giorni
- day è il giorno di inizio della terapia (giorno 0)
- se manca hours, times è obbligatorio (es 2 volte al giorno) -> times: 2
- problema: se manca il day nel caso di period_days (es 2 volte a settimana) -> day: -1 oppure undefined ??

*/
