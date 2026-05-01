declare module "bcryptjs" {
  export function hash(data: string, saltOrRounds: string | number): Promise<string>;
}
