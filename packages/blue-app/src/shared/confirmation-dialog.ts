export const NATIVE_CONFIRMATION_CHANNEL = 'blue:native-confirmation:show';

export type NativeConfirmationType = 'none' | 'info' | 'error' | 'question' | 'warning';

export type NativeConfirmationActionRole = 'accept' | 'cancel' | 'destructive' | 'secondary' | string;

export interface NativeConfirmationAction {
  id: string;
  label: string;
  role?: NativeConfirmationActionRole;
}

export interface NativeConfirmationCheckbox {
  label: string;
  checked?: boolean;
}

export interface NativeConfirmationRequest {
  id: string;
  type: NativeConfirmationType;
  title: string;
  message: string;
  detail?: string;
  actions: NativeConfirmationAction[];
  defaultActionId: string;
  cancelActionId: string;
  noLink?: boolean;
  checkbox?: NativeConfirmationCheckbox;
}

export type NativeConfirmationOutcome = 'selected' | 'dismissed' | 'owner-unavailable' | 'failed';

export interface NativeConfirmationResult {
  actionId: string;
  checkboxChecked?: boolean;
  outcome: NativeConfirmationOutcome;
}

export type InAppConfirmationIntent = 'cancel' | 'secondary' | 'primary' | 'destructive';

export interface InAppConfirmationAction {
  id: string;
  label: string;
  intent?: InAppConfirmationIntent;
  disabled?: boolean;
  dataAttributes?: Record<string, string | boolean>;
}

const MAX_ID_LENGTH = 128;
const MAX_TITLE_LENGTH = 500;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_DETAIL_LENGTH = 8000;
const MAX_LABEL_LENGTH = 200;

const VALID_TYPES = new Set<NativeConfirmationType>(['none', 'info', 'error', 'question', 'warning']);
const VALID_OUTCOMES = new Set<NativeConfirmationOutcome>(['selected', 'dismissed', 'owner-unavailable', 'failed']);

export interface ValidationResult<T> {
  valid: boolean;
  value?: T;
  errors: string[];
}

export function validateNativeConfirmationRequest(raw: unknown): ValidationResult<NativeConfirmationRequest> {
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, errors: ['Request must be a non-null object'] };
  }

  const rec = raw as Record<string, unknown>;

  if (typeof rec.id !== 'string' || !rec.id.trim()) {
    errors.push('id must be a non-empty string');
  } else if (rec.id.length > MAX_ID_LENGTH) {
    errors.push(`id length exceeds maximum of ${MAX_ID_LENGTH}`);
  }

  if (typeof rec.type !== 'string' || !VALID_TYPES.has(rec.type as NativeConfirmationType)) {
    errors.push('type must be one of: none, info, error, question, warning');
  }

  if (typeof rec.title !== 'string' || !rec.title.trim()) {
    errors.push('title must be a non-empty string');
  } else if (rec.title.length > MAX_TITLE_LENGTH) {
    errors.push(`title length exceeds maximum of ${MAX_TITLE_LENGTH}`);
  }

  if (typeof rec.message !== 'string' || !rec.message.trim()) {
    errors.push('message must be a non-empty string');
  } else if (rec.message.length > MAX_MESSAGE_LENGTH) {
    errors.push(`message length exceeds maximum of ${MAX_MESSAGE_LENGTH}`);
  }

  let detail: string | undefined;
  if (rec.detail !== undefined && rec.detail !== null) {
    if (typeof rec.detail !== 'string') {
      errors.push('detail must be a string if provided');
    } else if (rec.detail.length > MAX_DETAIL_LENGTH) {
      errors.push(`detail length exceeds maximum of ${MAX_DETAIL_LENGTH}`);
    } else {
      detail = rec.detail;
    }
  }

  if (!Array.isArray(rec.actions) || rec.actions.length === 0) {
    errors.push('actions must be a non-empty array');
  }

  const actions: NativeConfirmationAction[] = [];
  const actionIds = new Set<string>();

  if (Array.isArray(rec.actions)) {
    for (let i = 0; i < rec.actions.length; i++) {
      const actionRaw = rec.actions[i];
      if (!actionRaw || typeof actionRaw !== 'object' || Array.isArray(actionRaw)) {
        errors.push(`action at index ${i} must be an object`);
        continue;
      }
      const actRec = actionRaw as Record<string, unknown>;
      if (typeof actRec.id !== 'string' || !actRec.id.trim()) {
        errors.push(`action at index ${i} has empty or missing id`);
      } else if (actRec.id.length > MAX_ID_LENGTH) {
        errors.push(`action at index ${i} id exceeds max length`);
      } else if (actionIds.has(actRec.id)) {
        errors.push(`duplicate action id: ${actRec.id}`);
      } else {
        actionIds.add(actRec.id);
      }

      if (typeof actRec.label !== 'string' || !actRec.label.trim()) {
        errors.push(`action at index ${i} has empty or missing label`);
      } else if (actRec.label.length > MAX_LABEL_LENGTH) {
        errors.push(`action at index ${i} label exceeds max length`);
      }

      let role: NativeConfirmationActionRole | undefined;
      if (actRec.role !== undefined && actRec.role !== null) {
        if (typeof actRec.role !== 'string' || !actRec.role.trim()) {
          errors.push(`action at index ${i} role must be a non-empty string if provided`);
        } else {
          role = actRec.role;
        }
      }

      if (typeof actRec.id === 'string' && typeof actRec.label === 'string') {
        const actionItem: NativeConfirmationAction = {
          id: actRec.id,
          label: actRec.label,
        };
        if (role) {
          actionItem.role = role;
        }
        actions.push(actionItem);
      }
    }
  }

  if (typeof rec.defaultActionId !== 'string' || !rec.defaultActionId.trim()) {
    errors.push('defaultActionId must be a non-empty string');
  } else if (!actionIds.has(rec.defaultActionId)) {
    errors.push(`defaultActionId "${rec.defaultActionId}" is not in declared actions`);
  }

  if (typeof rec.cancelActionId !== 'string' || !rec.cancelActionId.trim()) {
    errors.push('cancelActionId must be a non-empty string');
  } else if (!actionIds.has(rec.cancelActionId)) {
    errors.push(`cancelActionId "${rec.cancelActionId}" is not in declared actions`);
  }

  let checkbox: NativeConfirmationCheckbox | undefined;
  if (rec.checkbox !== undefined && rec.checkbox !== null) {
    if (typeof rec.checkbox !== 'object' || Array.isArray(rec.checkbox)) {
      errors.push('checkbox must be an object if provided');
    } else {
      const cbRec = rec.checkbox as Record<string, unknown>;
      if (typeof cbRec.label !== 'string' || !cbRec.label.trim()) {
        errors.push('checkbox label must be a non-empty string');
      } else if (cbRec.label.length > MAX_LABEL_LENGTH) {
        errors.push(`checkbox label exceeds maximum length of ${MAX_LABEL_LENGTH}`);
      } else {
        checkbox = {
          label: cbRec.label,
          checked: typeof cbRec.checked === 'boolean' ? cbRec.checked : false,
        };
      }
    }
  }

  let noLink: boolean | undefined;
  if (rec.noLink !== undefined) {
    if (typeof rec.noLink !== 'boolean') {
      errors.push('noLink must be a boolean if provided');
    } else {
      noLink = rec.noLink;
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const cleanRequest: NativeConfirmationRequest = {
    id: rec.id as string,
    type: rec.type as NativeConfirmationType,
    title: rec.title as string,
    message: rec.message as string,
    actions,
    defaultActionId: rec.defaultActionId as string,
    cancelActionId: rec.cancelActionId as string,
  };

  if (detail !== undefined) {
    cleanRequest.detail = detail;
  }
  if (checkbox !== undefined) {
    cleanRequest.checkbox = checkbox;
  }
  if (noLink !== undefined) {
    cleanRequest.noLink = noLink;
  }

  return { valid: true, value: cleanRequest, errors: [] };
}

export function decodeNativeConfirmationRequest(raw: unknown): NativeConfirmationRequest | null {
  const result = validateNativeConfirmationRequest(raw);
  return result.valid && result.value ? result.value : null;
}

export function createSafeCancellationResult(
  request: NativeConfirmationRequest | null | undefined,
  outcome: NativeConfirmationOutcome = 'dismissed',
  fallbackCancelId = 'cancel',
): NativeConfirmationResult {
  const safeCancelId = request?.cancelActionId ?? fallbackCancelId;
  const result: NativeConfirmationResult = {
    actionId: safeCancelId,
    outcome: VALID_OUTCOMES.has(outcome) ? outcome : 'dismissed',
  };
  if (request?.checkbox) {
    result.checkboxChecked = Boolean(request.checkbox.checked);
  }
  return result;
}
