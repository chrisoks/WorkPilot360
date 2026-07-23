export function normalizeWinterServiceIdentity(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("de")
    .replace(/[^a-z0-9äöüß]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isWinterServicePackageForSelection(input: {
  packageName: string;
  packageDescription: string;
  packageMatchcode: string;
  projectNumber: string;
  customerId: string;
  customerDisplayName: string;
}) {
  const projectMarker = `projekt ${input.projectNumber}.`.toLocaleLowerCase("de");
  const customerMarker = normalizeWinterServiceIdentity(input.customerDisplayName);
  const customerIdMarker = `winter:${input.customerId.toLocaleLowerCase("de")}:`;
  return (
    input.packageDescription.toLocaleLowerCase("de").includes(projectMarker) ||
    input.packageMatchcode.trim().toLocaleLowerCase("de").startsWith(customerIdMarker) ||
    (customerMarker.length > 2 &&
      normalizeWinterServiceIdentity(input.packageName).includes(customerMarker))
  );
}
