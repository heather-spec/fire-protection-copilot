import type { CompletenessResult } from "@/lib/validation/types";

export type DeskStage = "review" | "combine" | "file" | "done";

export interface DeskItem {
  id: string;
  customer: string;
  site: string;
  jobNumber: string;
  inspectionType: string;
  formName: string;
  showpiecePdf: string;
  sourcePdfs: string[];
  requiredFields: string[];
}

export type FileDestinationStatus = "real" | "simulated";

export interface FileDestination {
  name: string;
  status: FileDestinationStatus;
  detail: string;
}

export interface DeskItemState {
  stage: DeskStage;
  combinedPacketUrl: string | null;
  combinedPageCount: number | null;
  completeness: CompletenessResult | null;
  bounceNote: string | null;
  destinations: FileDestination[] | null;
  error: string | null;
}

export interface DeskItemWithState extends DeskItem {
  state: DeskItemState;
}
