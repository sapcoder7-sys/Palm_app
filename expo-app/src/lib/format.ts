export const money = (paise: number = 0) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paise / 100);
export const title = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
export const errorText = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please retry.';
export const validAmount = (value: string) => /^\d+(\.\d{1,2})?$/.test(value) && Number(value) > 0 && Number(value) <= 100000000;
