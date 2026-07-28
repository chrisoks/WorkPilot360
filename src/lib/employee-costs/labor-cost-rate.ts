export type LaborCostAllocation = {
  hourlyCostRate: number;
  allocationShare: number;
};

export type WeightedLaborCostRate = {
  weightedCostTotal: number;
  allocationTotal: number;
  averageHourlyCostRate: number;
  contributingPersonCount: number;
};

function finiteNonNegative(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function calculateWeightedLaborCostRate(
  allocations: readonly LaborCostAllocation[]
): WeightedLaborCostRate {
  const validAllocations = allocations
    .map((allocation) => ({
      hourlyCostRate: finiteNonNegative(allocation.hourlyCostRate),
      allocationShare: finiteNonNegative(allocation.allocationShare),
    }))
    .filter((allocation) => allocation.allocationShare > 0);
  const weightedCostTotal = validAllocations.reduce(
    (sum, allocation) =>
      sum + allocation.hourlyCostRate * allocation.allocationShare,
    0
  );
  const allocationTotal = validAllocations.reduce(
    (sum, allocation) => sum + allocation.allocationShare,
    0
  );

  return {
    weightedCostTotal,
    allocationTotal,
    averageHourlyCostRate:
      allocationTotal > 0 ? weightedCostTotal / allocationTotal : 0,
    contributingPersonCount: validAllocations.length,
  };
}
