import type { Messages } from "./messages/en";

type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

/** Every translatable key, e.g. "nav.students". Typos fail type-checking. */
export type MessageKey = Leaves<Messages>;
export type TranslateVars = Record<string, string | number>;
export type Translator = (key: MessageKey, vars?: TranslateVars) => string;

export function createTranslator(messages: Messages, fallback?: Messages): Translator {
  return (key, vars) => {
    const lookup = (source: Messages | undefined) =>
      key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], source);
    const template = lookup(messages) ?? lookup(fallback);
    if (typeof template !== "string") return key;
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
  };
}
