// ─── Types ───────────────────────────────────────────────────────────────────

export interface Module {
  id: number;
  name: string;
  description: string;
  sectionId: number;
  canEdit: boolean;
  position?: number;
  instanceId?: string;
}

export interface Section {
  id: number;
  title: string;
  description?: string;
  position?: number;
  compact?: boolean;
  docType?: string;
}

export interface DragItem {
  type: "SECTION" | "MODULE";
  data: { section?: Section; module?: Module; sectionId?: number };
}

export interface DocumentSection extends Section {
  modules: Module[];
}

export type SowSize = "full" | "small" | "proposal";