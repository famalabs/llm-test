export type DayTimetable<T extends object = object> = {
  /** Day starting from 0 */
  day: number;
  /** Timetable data */
  timetable?: T[];
};

export type DaySchedule<T extends object = object> = DayTimetable<T> & {
  /** Duration in days */
  duration?: number;  // durata del trattamento in giorni
  /** Duration of the period in days */
  period_duration?: number; // periodicità ciclica *
  /** Specific days within the period */
  period_days?: DayTimetable<T>[];
};

export type TherapyDrug = {
  // drug (almeno uno tra drug_name e drug_api deve essere specificato)
  drug_name?: string; // nome commerciale completo
  drug_api?: string; // principio attivo
  schedule: DaySchedule<{
    dose: number; // dosi per assunzione (es. "2 compresse")
    /** Hour in "HH:MM" format */
    hour?: string;
    hour_text?: string; // indicazione libera sull'orario (es. "mattina e sera", "dopo i pasti", ecc.)
  }>;
  optional?: boolean; // se il farmaco è opzionale (es. al bisogno)
  notes?: string; // indicazioni aggiuntive da seguire se non specificate altrove, quali: condizioni particolari (es. "in presenza di X.."), modalità di assunzione (es. "con acqua"), attenzioni particolari (es. "dopo l'assunzione non guidare per 2 ore"), ecc.
};

/*

Note:
- se period_duration è maggiore di 1, period_days deve contenere almeno un elemento, e viceversa
- day è il giorno di inizio della terapia (giorno 0)
Per piattaforma (non per la generazione da llm):
- se duration è definito, il calcolo dello schedule termina dopo "day + duration" giorni
*/
