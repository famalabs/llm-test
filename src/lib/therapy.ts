export type DayHourSchedule<T extends object = object> = T & {
  /** Day starting from 0 */
  day: number;
  /** Hours in "HH:MM" format */
  hours?: string[];
};

export type DaySchedule<T extends object = object> = DayHourSchedule<T> & {
  /** Duration in days */
  duration?: number;
  /** Duration of the period in days */
  period_duration?: number;
  /** Specific days within the period */
  period_days?: DayHourSchedule<T>[];
};

export type TherapyDrug = {
  drug: string;
  notes?: string;
  schedule: DaySchedule<{
    dose: number;
  }>;
};

// test con dosi e durata
// test con orari
// test con periodi
