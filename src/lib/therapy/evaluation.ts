import { mean } from "../../utils";
import { TherapyDrug, DaySchedule, DayTimetable } from "./interfaces";

export type TherapyErrors = {
    delta_therapy: number;
    missing: number;
    incorrect: number;
    extra: number;
    total: number;
};

type Counts = Pick<TherapyErrors, "missing" | "incorrect" | "extra">;

const zeroCounts = (): Counts => ({ missing: 0, incorrect: 0, extra: 0 });

function addCounts(base: Counts, inc: Counts) {
    base.missing += inc.missing;
    base.incorrect += inc.incorrect;
    base.extra += inc.extra;
}

/**
 * Confronto generico per valori primitivi o undefined.
 * - missing: expected definito, candidate undefined
 * - extra:   expected undefined, candidate definito
 * - incorrect: entrambi definiti ma con valore diverso
 */
function comparePrimitive<T>(
    expected: T | undefined,
    candidate: T | undefined
): Counts {
    const c = zeroCounts();
    const eU = expected == undefined;
    const cU = candidate == undefined;

    if (!eU && cU) {
        c.missing += 1;
    } else if (eU && !cU) {
        c.extra += 1;
    } else if (!eU && !cU && expected != candidate) {
        c.incorrect += 1;
    }
    return c;
}

/**
 * Timetable entry: { dose: number; hour?: string; hour_text?: string }
 * Confronto campo-per-campo.
 */
type TimetableEntry = {
    dose: number;
    hour?: string;
    hour_text?: string;
};

function compareTimetableEntry(
    expected: TimetableEntry,
    candidate: TimetableEntry
): Counts {
    const c = zeroCounts();
    addCounts(c, comparePrimitive(expected.dose, candidate.dose));
    addCounts(c, comparePrimitive(expected.hour, candidate.hour));
    addCounts(c, comparePrimitive(expected.hour_text, candidate.hour_text));
    return c;
}

/**
 * Confronto fra array di timetable entries.
 * - Confronto posizionale degli elementi comuni (campo-per-campo)
 * - Differenza di lunghezza conteggiata come missing/extra (1 per elemento mancante/in più)
 */
function compareTimetableArray(
    expected?: TimetableEntry[],
    candidate?: TimetableEntry[]
): Counts {
    const c = zeroCounts();

    if (!expected && !candidate) return c;
    if (expected && !candidate) {
        c.missing += expected.length;
        return c;
    }
    if (!expected && candidate) {
        c.extra += candidate.length;
        return c;
    }

    // Entrambi definiti
    const minLen = Math.min(expected!.length, candidate!.length);
    for (let i = 0; i < minLen; i++) {
        addCounts(c, compareTimetableEntry(expected![i], candidate![i]));
    }
    if (expected!.length > candidate!.length) {
        c.missing += expected!.length - candidate!.length;
    } else if (candidate!.length > expected!.length) {
        c.extra += candidate!.length - expected!.length;
    }
    return c;
}

/**
 * Confronto DayTimetable<TimetableEntry>:
 * - day (numero)
 * - timetable (array di TimetableEntry)
 */
function compareDayTimetable(
    expected: DayTimetable<TimetableEntry>,
    candidate: DayTimetable<TimetableEntry>
): Counts {
    const c = zeroCounts();
    addCounts(c, comparePrimitive(expected.day, candidate.day));
    addCounts(c, compareTimetableArray(expected.timetable, candidate.timetable));
    return c;
}

/**
 * Confronto fra array di period_days (DayTimetable<TimetableEntry>[])
 * - Confronto posizionale degli elementi comuni:
 *     - day
 *     - timetable interno
 * - Differenza di lunghezza conteggiata come missing/extra (1 per elemento)
 */
function comparePeriodDays(
    expected?: DayTimetable<TimetableEntry>[],
    candidate?: DayTimetable<TimetableEntry>[]
): Counts {
    const c = zeroCounts();

    if (!expected && !candidate) return c;
    if (expected && !candidate) {
        c.missing += expected.length;
        return c;
    }
    if (!expected && candidate) {
        c.extra += candidate.length;
        return c;
    }

    const minLen = Math.min(expected!.length, candidate!.length);
    for (let i = 0; i < minLen; i++) {
        addCounts(c, compareDayTimetable(expected![i], candidate![i]));
    }
    if (expected!.length > candidate!.length) {
        c.missing += expected!.length - candidate!.length;
    } else if (candidate!.length > expected!.length) {
        c.extra += candidate!.length - expected!.length;
    }
    return c;
}

/**
 * Confronto profondo di DaySchedule<TimetableEntry>
 * - day, duration, period_duration (primitivi/undefined)
 * - timetable (array di TimetableEntry)
 * - period_days (array di DayTimetable<TimetableEntry>)
 */
function compareSchedule(
    expected: DaySchedule<TimetableEntry>,
    candidate: DaySchedule<TimetableEntry>
): Counts {
    const c = zeroCounts();
    addCounts(c, comparePrimitive(expected.day, candidate?.day));
    addCounts(c, comparePrimitive(expected.duration, candidate?.duration));
    addCounts(
        c,
        comparePrimitive(expected.period_duration, candidate?.period_duration)
    );
    addCounts(c, compareTimetableArray(expected.timetable, candidate?.timetable));
    addCounts(c, comparePeriodDays(expected.period_days, candidate?.period_days));
    return c;
}

/**
 * Confronto profondo di TherapyDrug
 * - drug_name, drug_api, optional, notes
 * - schedule (deep)
 *
 * Nota: "missing/extra" sono conteggiati quando un campo è presente in expected e mancante in candidate (missing)
 * o viceversa (extra). "incorrect" quando entrambi sono presenti ma con valore diverso.
 */
function compareTherapyDrug(
    expected: TherapyDrug,
    candidate: TherapyDrug
): Counts {
    const c = zeroCounts();

    addCounts(c, comparePrimitive(expected.drug_name, candidate?.drug_name));
    addCounts(c, comparePrimitive(expected.drug_api, candidate?.drug_api));

    addCounts(c, compareSchedule(expected.schedule, candidate.schedule));

    addCounts(c, comparePrimitive(expected.optional, candidate?.optional));
    addCounts(c, comparePrimitive(expected.notes, candidate?.notes));

    return c;
}

export const evaluate = async ({
    results,
}: {
    results: {
        input: string;
        expected_output: TherapyDrug[];
        candidate: TherapyDrug[];
    }[];
}) => {
    
    const tests: {
        test: {
            input: string;
            expected_output: TherapyDrug[];
            candidate: TherapyDrug[];
        };
        metrics: { errors: TherapyErrors };
    }[] = [];

    for (let i = 0; i <results.length; i++) {
        const test = results[i];

        const delta_therapy = Math.abs(test.expected_output.length - test.candidate.length);

        let missing = 0;
        let incorrect = 0;
        let extra = 0;

        const minLen = Math.min(test.expected_output.length, test.candidate.length);
        for (let j = 0; j < minLen; j++) {
            const r = compareTherapyDrug(test.expected_output[j], test.candidate[j]);
            missing += r.missing;
            incorrect += r.incorrect;
            extra += r.extra;
        }

        // Nota: le terapie non allineate oltre minLen NON vengono valutate per missing/extra campo-per-campo,
        // perché la differenza numerica è già contabilizzata in delta_therapy secondo specifica.

        const errors: TherapyErrors = {
            delta_therapy,
            missing,
            incorrect,
            extra,
            total: delta_therapy + missing + incorrect + extra,
        };

        tests.push({
            test,
            metrics: { errors },
        });
    }

    const summary = {
        delta_therapy: mean(tests.map((t) => t.metrics.errors.delta_therapy)),
        missing: mean(tests.map((t) => t.metrics.errors.missing)),
        incorrect: mean(tests.map((t) => t.metrics.errors.incorrect)),
        extra: mean(tests.map((t) => t.metrics.errors.extra)),
        total: mean(tests.map((t) => t.metrics.errors.total)),
    };

    return { tests, scores: { summary } };
};
