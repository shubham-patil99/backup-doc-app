export type Module = {
  id: string;
  name: string;
  editable: boolean;
};

export type Section = {
  id: string;
  name: string;
  droppable: boolean;
  allowedModules: string[]; // ✅ only these modules can be dropped
};
