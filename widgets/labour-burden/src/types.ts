export type SegmentKey = 'direct_tax' | 'rent' | 'corvee';

export interface SegmentData {
  low: number;
  central: number;
  high: number;
  citation: string;
  note: string;
}

export interface Bucket {
  id: string;
  label: string;
  era: string;
  region: string;
  caveat: string;
  modern?: boolean;
  segments: Record<SegmentKey, SegmentData>;
}

export interface Source {
  key: string;
  full: string;
  claim: string;
  caveat: string;
}

export interface Dataset {
  buckets: Bucket[];
  sources: Source[];
  methodology: string;
}

export const SEGMENT_ORDER: SegmentKey[] = ['direct_tax', 'rent', 'corvee'];

export const SEGMENT_LABEL: Record<SegmentKey, string> = {
  direct_tax: 'Direct tax',
  rent: 'Rent',
  corvee: 'Forced labour',
};

export interface Selection {
  bucket: Bucket;
  segmentKey?: SegmentKey;
}
