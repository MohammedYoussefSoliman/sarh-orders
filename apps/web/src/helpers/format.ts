const currency = new Intl.NumberFormat('en-SA', {
  style: 'currency',
  currency: 'SAR',
  minimumFractionDigits: 2,
});

const dateTime = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export const formatCurrency = (value: number): string => currency.format(value);

/** Timestamps arrive as UTC ISO strings and are shown in the viewer's zone. */
export const formatDateTime = (iso: string): string => dateTime.format(new Date(iso));
