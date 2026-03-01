export const biweeklyGrossFromAnnual = (annualSalaryCents: number): number => Math.floor(annualSalaryCents / 26);

export const biweeklyNetEstimate = (annualSalaryCents: number, extraWithholdingCents = 0): number => {
  const gross = biweeklyGrossFromAnnual(annualSalaryCents);
  const estimatedTax = Math.floor(gross * 0.22);
  const net = gross - estimatedTax - extraWithholdingCents;
  return Math.max(0, net);
};
