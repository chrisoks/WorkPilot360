export type JarvisDialogChoice = {
  id: string;
  label: string;
  prompt: string;
};

export function createJarvisDialogChoice(
  id: string,
  label: string,
  prompt: string
): JarvisDialogChoice {
  return {
    id: id.trim().slice(0, 80),
    label: label.trim().slice(0, 80),
    prompt: prompt.trim().slice(0, 500),
  };
}
