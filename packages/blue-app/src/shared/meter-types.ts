export interface MeterChannelBindingEntry {
  readonly kind: 'source' | 'sub' | 'master';
  readonly csdKey: string;
  readonly stripId: string;
  readonly displayName: string;
}

export interface MeterBindingMapPayload {
  readonly entries: readonly MeterChannelBindingEntry[];
  readonly nchnls: number;
}

export interface ChannelMeterReadingPayload {
  readonly csdKey: string;
  readonly rms: readonly number[];
  readonly peak: readonly number[];
}

export interface MeterFramePayload {
  readonly sequence: number;
  readonly channels: readonly ChannelMeterReadingPayload[];
}
