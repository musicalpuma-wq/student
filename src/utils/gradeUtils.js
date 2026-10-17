// Normalizes a typed grade into the canonical "X.Y" form.
// Digits typed without a dot are shorthand: "5" -> "5.0", "45" -> "4.5".
// Values containing a dot (or comma) are parsed as-is. Returns '' for empty
// input (clears the grade) and null when the input is not a number.
export const formatGradeInput = (raw) => {
    const text = String(raw ?? '').trim().replace(',', '.');
    if (text === '') return '';
    let value;
    if (/^\d{1,2}$/.test(text)) {
        value = text.length === 1 ? Number(text) : Number(`${text[0]}.${text[1]}`);
    } else {
        value = Number(text);
        if (isNaN(value)) return null;
    }
    const clamped = Math.min(5, Math.max(0, value));
    return clamped.toFixed(1);
};

// Allowed ±25% window around the heteroevaluation grade.
// Max is capped at 5.0 since no grade can exceed it.
export const evaluationBounds = (hetero) => ({
    min: hetero * 0.75,
    max: Math.min(5, hetero * 1.25)
});

export const isWithinEvaluationBounds = (value, hetero) => {
    const { min, max } = evaluationBounds(hetero);
    return value >= min - 1e-9 && value <= max + 1e-9;
};

// Compact display for range bounds (1.5, 2.5, 3.75)
export const formatBound = (n) => String(Number(n.toFixed(2)));
