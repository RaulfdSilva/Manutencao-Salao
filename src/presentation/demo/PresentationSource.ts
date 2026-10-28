import type { MaintenanceCategory } from '../../domain/maintenance/MaintenanceTypes';
import type { VerificationStatus } from '../../domain/checklists/ChecklistTypes';
import type { MemberRole } from '../../domain/members/Member';

export interface MaintenancePreview {
  readonly id: string;
  readonly title: string;
  readonly category: MaintenanceCategory;
  readonly date: string;
  readonly time: string;
  readonly timeZone: string;
  readonly status: 'scheduled' | 'completed' | 'cancelled';
  readonly equipment: readonly {
    readonly id: string;
    readonly name: string;
    readonly checks: readonly {
      readonly key: string;
      readonly description: string;
      readonly status: VerificationStatus;
    }[];
  }[];
}
export interface ProblemPreview {
  readonly id: string;
  readonly maintenanceId: string;
  readonly description: string;
  readonly equipmentName: string;
  readonly verificationDescription: string;
  readonly status: 'pending' | 'resolved';
  readonly recordedOn: string;
}
export interface TeamPreview {
  readonly id: string;
  readonly name: string;
  readonly role: MemberRole;
}
export interface PresentationSnapshot {
  readonly maintenances: readonly MaintenancePreview[];
  readonly problems: readonly ProblemPreview[];
  readonly team: readonly TeamPreview[];
}
/** Read-only presentation boundary. Future adapters must return authorized/minimized DTOs. */
export interface PresentationSource {
  load(): Promise<PresentationSnapshot>;
}
