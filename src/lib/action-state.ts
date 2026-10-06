/** Result returned by form server actions; error/message are i18n keys. */
export interface ActionState {
  ok?: boolean;
  error?: string;
  message?: string;
  vars?: Record<string, string | number>;
  data?: Record<string, unknown>;
}

export const fail = (error: string, vars?: ActionState["vars"]): ActionState => ({ ok: false, error, vars });
export const done = (message?: string, vars?: ActionState["vars"], data?: ActionState["data"]): ActionState => ({ ok: true, message, vars, data });
