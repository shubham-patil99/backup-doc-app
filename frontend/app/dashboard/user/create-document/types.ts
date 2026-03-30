export interface Module {
  sectionId: number;
  id: number;
  name: string;
  description: string;
  section_id: number | null;
  created_by: number | string;
  editable: boolean;
}

export interface Section {
  id: number;
  title: string;
  createdAt?: string;
  updatedAt?: string;
}
