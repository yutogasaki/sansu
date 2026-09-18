/** Adopted Sansu v0.2 simulation boundaries. */
export type Id = string;
export type CellPos = readonly [number, number];
export type Weather = 'clear' | 'cloud' | 'rain';
export type Capability =
  | 'path' | 'bridge' | 'home' | 'hub' | 'farm' | 'tree'
  | 'flowers' | 'bench' | 'irrigation' | 'handcart';

export interface Cell {
  readonly position: CellPos;
  terrain: 'ground' | 'water';
  elevation: number;
  moisture: number;        // 0..1
  shade: number;           // 0..1
  traffic: number;         // >=0, not population
  path: boolean;
  bridge: boolean;
  channel: boolean;
}

export interface Chunk {
  id: Id;
  coordinate: CellPos;
  terrainVersion: string;
  opened: boolean;
  cells: Cell[];
}

export interface Inventory {
  food: number;            // Physical ownership; excludes reservations.
  capacity: number;
  outgoingReserved: number;
  incomingReserved: number;
}

interface PropBase {
  id: Id;
  position: CellPos;
  rotation: 0 | 90 | 180 | 270;
  stored: boolean;
}
export type Prop =
  | (PropBase & { kind: 'farm'; entrance: CellPos; growth: number; inventory: Inventory })
  | (PropBase & { kind: 'hub'; entrance: CellPos; inventory: Inventory;
      transportPolicy: 'hand' | 'cart_if_connected' })
  | (PropBase & { kind: 'home'; entrance: CellPos; beds: number; hubId: Id })
  | (PropBase & { kind: 'bench'; entrance: CellPos; occupantId?: Id; reservedById?: Id })
  | (PropBase & { kind: 'tree' | 'flowers' });

export interface Resident {
  id: Id;
  templateId: Id;
  appearanceRef: string;   // Resolver key, not an assumed existing file path.
  homeId: Id;
  hubId: Id;
  position: CellPos;
  naturePreference: number;
  socialPreference: number;
  state: 'idle' | 'planning' | 'moving' | 'using' | 'reacting';
  targetId?: Id;
  path: CellPos[];
  edgeProgress: number;
  carriedFood: number;
  jobId?: Id;
  recentTargetIds: Id[];
  dwellUntil?: number;
}

export interface DeliveryJob {
  id: Id;
  sourceId: Id;
  hubId: Id;
  residentId: Id;
  quantity: number;
  usingCart: boolean;
  phase: 'reserved' | 'toSource' | 'pickup' | 'toHub' | 'dropoff';
  createdTick: number;
  lastProgressTick: number;
}

export interface ServiceSample {
  tick: number;
  requested: number;
  served: number;
  delivered: number;
}
export interface HubMetrics {
  hubId: Id;
  historyStartedTick: number;
  history: ServiceSample[]; // Keep required 240-tick window, not album limits.
  eligibleStreak: number;
}
export interface SettlementOffer {
  id: Id;
  templateId: Id;
  preferredHubId: Id;
  createdTick: number;
  status: 'pending' | 'accepted';
  admittedResidentId?: Id;
}
export interface InsectVisit {
  id: Id;
  chunkId: Id;
  position: CellPos;
  variant: 'ordinary' | 'unusual';
  createdTick: number;
  expiresTick: number;
}
export interface Observation {
  id: Id;
  type: 'visit' | 'delivery' | 'settlement' | 'expansion' | 'new_tool';
  tick: number;
  subjectIds: Id[];
  position: CellPos;
  observedConditions: Record<string, string | number | boolean>;
  // No `provenCause`, `masteryAward`, or inferred child understanding.
}

export interface WorldState {
  schemaVersion: '0.2.0';
  engineVersion: string;
  balanceVersion: string;
  worldId: Id;
  profileId: Id;
  seed: string;
  tick: number;
  revision: number;
  weather: Weather;
  chunks: Chunk[];
  props: Prop[];
  residents: Resident[];
  jobs: DeliveryJob[];
  hubMetrics: HubMetrics[];
  offer?: SettlementOffer;
  nextOfferEligibleTick: number;
  insectVisits: InsectVisit[];
  randomEvaluationOrdinals: Record<string, number>;
  observations: Observation[];
  significantMilestones: Observation[];
  recentlyAppliedCommandIds: Id[];
  foodAccounting: {
    initialized: number;
    harvested: number;
    consumed: number;
  };
}

export interface LearningCheckpointCompleted {
  eventId: Id;
  profileId: Id;
  assignmentId: Id;
  checkpointId: Id;
  subject: 'math' | 'english';
  completion: 'independent' | 'supported';
  issuedUnits: number;      // Positive integer preassigned by learning side.
  learningRecordRef: string;
  issuerVersion: string;
  // Correctness, speed and timestamps do NOT change world probability.
}
export interface AwardRecord {
  eventId: Id;
  awardKey: string;         // profileId + assignmentId + checkpointId, canonicalized.
  units: number;
  learningRecordRef: string;
}
export interface UnlockRecord {
  transactionId: Id;
  capability: Capability;
  spentUnits: number;
  priceVersion: string;
}
export interface ProfileProgress {
  profileId: Id;
  revision: number;
  awards: AwardRecord[];
  unlocks: UnlockRecord[];
  initialCapabilities: Capability[];
  target?: { capability: Capability; quotedCost: number; priceVersion: string };
}

export type WorldCommandPayload =
  | { type: 'placeProp'; id: Id; kind: Prop['kind']; position: CellPos;
      rotation: 0 | 90 | 180 | 270 }
  | { type: 'moveProp'; propId: Id; position: CellPos; rotation: 0 | 90 | 180 | 270 }
  | { type: 'storeProp'; propId: Id }
  | { type: 'restoreProp'; propId: Id; position: CellPos; rotation: 0 | 90 | 180 | 270 }
  | { type: 'paintPath'; cells: CellPos[] }
  | { type: 'placeBridge'; cells: CellPos[] }
  | { type: 'paintChannel'; cells: CellPos[] }
  | { type: 'removeOverlay'; kind: 'path' | 'bridge' | 'channel'; cells: CellPos[] }
  | { type: 'openChunk'; coordinate: CellPos }
  | { type: 'assignHomeHub'; homeId: Id; hubId: Id }
  | { type: 'setHubTransportPolicy'; hubId: Id; policy: 'hand' | 'cart_if_connected' }
  | { type: 'acceptSettlement'; offerId: Id; homeId: Id };
export interface WorldCommand {
  commandId: Id;
  profileId: Id;
  worldId: Id;
  expectedRevision: number;
  payload: WorldCommandPayload;
}
export type ProgressCommand =
  | { type: 'applyCheckpoint'; event: LearningCheckpointCompleted }
  | { type: 'chooseTarget'; commandId: Id; profileId: Id; capability: Capability }
  | { type: 'unlock'; commandId: Id; profileId: Id; expectedRevision: number;
      capability: Capability };

/** Ephemeral committed-tick feedback; never part of a saved world. */
export interface DomainEvent {
  id: Id;
  type: 'FoodHarvested' | 'FoodTransferred' | 'MealServed' | 'VisitorArrived'
    | 'SettlementOffered' | 'ResidentAdmitted' | 'ChunkOpened' | 'CapabilityUnlocked';
  tick: number;
  subjectIds: Id[];
  quantity?: number;
  position?: CellPos;
  transfer?: { fromId: Id; toId: Id; from: CellPos; to: CellPos };
}
export type RandomAt = (
  seed: string, systemId: string, entityId: string, ordinal: number
) => number;
export interface EngineContext {
  capabilities: ReadonlySet<Capability>;
  config: typeof import('./balance.json');
  randomAt: RandomAt;
}
export interface Transition {
  state: WorldState;
  events: DomainEvent[];
  rejection?: { code: string; childMessage: string };
}

