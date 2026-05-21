export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
  label?: string;
}

export interface WatermarkDetectionResponse {
  watermarks: BoundingBox[];
}

export type AppState = 'idle' | 'uploading' | 'detecting' | 'refining' | 'removing' | 'completed' | 'batch_processing' | 'error';

export interface BoxSelection extends BoundingBox {
  selected: boolean;
  id: string;
}

export interface ProcessedImage {
  id: string;
  originalUrl: string;
  processedUrl: string;
  name: string;
  size: number;
  type: string;
  detectedBoxes: BoxSelection[];
  status: 'pending' | 'processing' | 'completed' | 'error';
  replacementLogoUrl?: string;
}
