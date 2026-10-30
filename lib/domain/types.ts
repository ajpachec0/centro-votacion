export const ROLES = [
  "JEFE_CENTRO",
  "DELEGADO_JEM",
  "SUPERVISOR",
  "ORIENTADOR",
  "MIEMBRO_MESA",
  "VIGILANTE",
] as const;

export type Role = (typeof ROLES)[number];

export const ASSIGNMENT_TYPES = ["TITULAR", "SUPLENTE"] as const;

export type AssignmentType = (typeof ASSIGNMENT_TYPES)[number];

export const REVIEW_STATUSES = ["PENDING", "CONFIRMED"] as const;

export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const CENTER_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED"] as const;

export type CenterStatus = (typeof CENTER_STATUSES)[number];

export const IMAGE_STATUSES = ["PENDING", "PROCESSED", "ERROR"] as const;

export type ImageProcessingStatus = (typeof IMAGE_STATUSES)[number];

export type Center = {
  id: string;
  department: string;
  municipality: string;
  name: string;
  code: string;
  jrvCount: number;
  supervisorCount: number | null;
  createdAt: string;
  updatedAt: string;
  status: CenterStatus;
};

export type Assignment = {
  id: string;
  centerId: string;
  role: Role;
  reference: string;
  assignmentType: AssignmentType;
  name: string;
  dui: string;
  phone: string;
  observations: string;
  sourceImageId?: string;
  reviewStatus: ReviewStatus;
  createdAt: string;
  updatedAt: string;
};

export type SourceImage = {
  id: string;
  centerId: string;
  originalFileName: string;
  mimeType: string;
  size: number;
  processingStatus: ImageProcessingStatus;
  createdAt: string;
};

export type ExpectedSlot = {
  role: Role;
  reference: string;
  assignmentType: AssignmentType;
  required: boolean;
};
