/** The database stores money as integer paise; the API and UI use rupees. */
export const toRupees = (paise: number | null): number => Number(((paise ?? 0) / 100).toFixed(2));
export const toRupeesOrNull = (paise: number | null): number | null => (paise === null ? null : toRupees(paise));
export const toPaise = (rupees: number): number => Math.round(rupees * 100);
