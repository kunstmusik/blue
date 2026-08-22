import { describe, expect, it } from 'vitest';
import {
  createSafeCancellationResult,
  decodeNativeConfirmationRequest,
  NativeConfirmationRequest,
  validateNativeConfirmationRequest,
} from './confirmation-dialog';

describe('confirmation-dialog shared contracts', () => {
  const validSampleRequest: NativeConfirmationRequest = {
    id: 'test-flow',
    type: 'warning',
    title: 'Confirm Operation',
    message: 'Are you sure you want to proceed?',
    detail: 'This cannot be undone.',
    actions: [
      { id: 'proceed', label: 'Proceed', role: 'destructive' },
      { id: 'cancel', label: 'Cancel', role: 'cancel' },
    ],
    defaultActionId: 'cancel',
    cancelActionId: 'cancel',
    checkbox: {
      label: 'Do not ask again',
      checked: false,
    },
  };

  it('validates a well-formed request successfully', () => {
    const result = validateNativeConfirmationRequest(validSampleRequest);
    expect(result.valid).toBe(true);
    expect(result.value).toEqual(validSampleRequest);
    expect(result.errors).toHaveLength(0);

    const decoded = decodeNativeConfirmationRequest(validSampleRequest);
    expect(decoded).toEqual(validSampleRequest);
  });

  it('rejects invalid top-level inputs', () => {
    expect(validateNativeConfirmationRequest(null).valid).toBe(false);
    expect(validateNativeConfirmationRequest(undefined).valid).toBe(false);
    expect(validateNativeConfirmationRequest([]).valid).toBe(false);
    expect(validateNativeConfirmationRequest('string').valid).toBe(false);
  });

  it('rejects missing or invalid id, type, title, message', () => {
    const req1 = { ...validSampleRequest, id: '' };
    expect(validateNativeConfirmationRequest(req1).valid).toBe(false);

    const req2 = { ...validSampleRequest, type: 'invalid-type' };
    expect(validateNativeConfirmationRequest(req2).valid).toBe(false);

    const req3 = { ...validSampleRequest, title: '  ' };
    expect(validateNativeConfirmationRequest(req3).valid).toBe(false);

    const req4 = { ...validSampleRequest, message: '' };
    expect(validateNativeConfirmationRequest(req4).valid).toBe(false);
  });

  it('enforces action array validity and action ID uniqueness', () => {
    const reqEmptyActions = { ...validSampleRequest, actions: [] };
    expect(validateNativeConfirmationRequest(reqEmptyActions).valid).toBe(false);

    const reqDuplicateActions = {
      ...validSampleRequest,
      actions: [
        { id: 'save', label: 'Save' },
        { id: 'save', label: 'Duplicate Save' },
      ],
      defaultActionId: 'save',
      cancelActionId: 'save',
    };
    const dupResult = validateNativeConfirmationRequest(reqDuplicateActions);
    expect(dupResult.valid).toBe(false);
    expect(dupResult.errors.some((e) => e.includes('duplicate action id'))).toBe(true);
  });

  it('ensures defaultActionId and cancelActionId reference declared actions', () => {
    const invalidDefault = { ...validSampleRequest, defaultActionId: 'non-existent' };
    const defaultRes = validateNativeConfirmationRequest(invalidDefault);
    expect(defaultRes.valid).toBe(false);
    expect(defaultRes.errors.some((e) => e.includes('defaultActionId "non-existent" is not in declared actions'))).toBe(
      true,
    );

    const invalidCancel = { ...validSampleRequest, cancelActionId: 'non-existent' };
    const cancelRes = validateNativeConfirmationRequest(invalidCancel);
    expect(cancelRes.valid).toBe(false);
    expect(cancelRes.errors.some((e) => e.includes('cancelActionId "non-existent" is not in declared actions'))).toBe(
      true,
    );
  });

  it('validates optional checkbox and bounds', () => {
    const invalidCheckbox = {
      ...validSampleRequest,
      checkbox: { label: '' },
    };
    expect(validateNativeConfirmationRequest(invalidCheckbox).valid).toBe(false);

    const validNoCheckbox = { ...validSampleRequest };
    delete validNoCheckbox.checkbox;
    const resNoCheckbox = validateNativeConfirmationRequest(validNoCheckbox);
    expect(resNoCheckbox.valid).toBe(true);
    expect(resNoCheckbox.value?.checkbox).toBeUndefined();
  });

  it('normalizes safe cancellation results for dismissal, owner loss, and failures', () => {
    const dismissal = createSafeCancellationResult(validSampleRequest, 'dismissed');
    expect(dismissal).toEqual({
      actionId: 'cancel',
      outcome: 'dismissed',
      checkboxChecked: false,
    });

    const ownerUnavailable = createSafeCancellationResult(validSampleRequest, 'owner-unavailable');
    expect(ownerUnavailable).toEqual({
      actionId: 'cancel',
      outcome: 'owner-unavailable',
      checkboxChecked: false,
    });

    const failed = createSafeCancellationResult(validSampleRequest, 'failed');
    expect(failed).toEqual({
      actionId: 'cancel',
      outcome: 'failed',
      checkboxChecked: false,
    });

    // When request is missing or null, falls back safely
    const fallback = createSafeCancellationResult(null, 'failed', 'custom-cancel');
    expect(fallback).toEqual({
      actionId: 'custom-cancel',
      outcome: 'failed',
    });
  });
});
