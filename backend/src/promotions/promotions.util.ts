export function personalizePromotionMessage(template: string, nome?: string | null) {
  const name = nome?.trim() || 'cliente';
  return template.replace(/\{nome\}/gi, name);
}
