export type Role = 'organizer' | 'exhibitor' | 'attendee';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl: string | null;
  consentGiven: boolean;
  notificationPrefs: { email: boolean };
  createdAt: string;
}

/** every backend response follows this shape. */
export interface ApiResponse<T> {
  success: true;
  data: T;
  message: string;
}

export interface ApiErrorBody {
  success: false;
  message: string;
  errors?: { field: string; message: string }[];
}

export interface AuthPayload {
  user: User;
  accessToken: string;
  expiresIn: number;
}

export const ROLE_LABELS: Record<Role, string> = {
  organizer: 'Organizer',
  exhibitor: 'Exhibitor',
  attendee: 'Attendee',
};

export const ROLE_HOME: Record<Role, string> = {
  organizer: '/organizer',
  exhibitor: '/exhibitor',
  attendee: '/attendee',
};

// expos, exhibitors, sessions, registrations

export type ExpoStatus = 'draft' | 'published' | 'ongoing' | 'completed' | 'cancelled';

/**
 * the statuses anyone other than the owning organizer may read.
 */
export const PUBLIC_EXPO_STATUSES: ExpoStatus[] = ['published', 'ongoing', 'completed'];

export const isPubliclyVisible = (status: ExpoStatus) => PUBLIC_EXPO_STATUSES.includes(status);

export interface FloorPlanConfig {
  gridWidth: number;
  gridHeight: number;
}

export interface Expo {
  id: string;
  organizerRef: string | Pick<User, 'id' | 'name' | 'email'>;
  title: string;
  description: string;
  theme: string;
  location: string;
  startDate: string;
  endDate: string;
  status: ExpoStatus;
  floorPlanConfig: FloorPlanConfig;
  createdAt: string;
  updatedAt: string;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ExhibitorProduct {
  _id?: string;
  name: string;
  category: string;
  description?: string;
}

export interface ExhibitorStaff {
  _id?: string;
  name: string;
  role?: string;
  email?: string;
}

export interface ExhibitorDocument {
  _id: string;
  url: string;
  filename: string;
  mimeType: string;
  bytes: number;
  resourceType: string;
  uploadedAt: string;
}

export interface ExhibitorProfile {
  id: string;
  userRef: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'> | string;
  /**
   * null when the expo this application was for has since been deleted.
   */
  expoRef: Pick<Expo, 'id' | 'title' | 'startDate' | 'endDate' | 'location' | 'status'> | string | null;
  companyName: string;
  description: string;
  category: string;
  logoUrl: string | null;
  documents: ExhibitorDocument[];
  products: ExhibitorProduct[];
  staff: ExhibitorStaff[];
  contact: { email: string; phone: string; website: string };
  approvalStatus: ApprovalStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  expoRef: string;
  title: string;
  speaker: string;
  topic: string;
  location: string;
  description: string;
  startTime: string;
  endTime: string;
  capacity: number | null;
  registeredCount: number;
  seatsRemaining: number | null;
  isFull: boolean;
  reminderSent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Registration {
  id: string;
  attendeeRef: string;
  expoRef: Pick<Expo, 'id' | 'title' | 'location' | 'startDate' | 'endDate' | 'status'> | string;
  sessionRef: Session | string | null;
  status: 'registered' | 'waitlisted' | 'cancelled';
  bookmarked: boolean;
  registeredAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface Paginated<T> {
  items: T[];
  pagination: Pagination;
}

export const EXPO_STATUS_LABELS: Record<ExpoStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  ongoing: 'Ongoing',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

/** badge variant per expo status, so status colour is consistent everywhere. */
export const EXPO_STATUS_VARIANTS: Record<ExpoStatus, 'muted' | 'success' | 'warning' | 'destructive' | 'default'> = {
  draft: 'muted',
  published: 'success',
  ongoing: 'default',
  completed: 'muted',
  cancelled: 'destructive',
};

export const APPROVAL_LABELS: Record<ApprovalStatus, string> = {
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const APPROVAL_VARIANTS: Record<ApprovalStatus, 'warning' | 'success' | 'destructive'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'destructive',
};

// floor plan + real-time

export type BoothStatus = 'available' | 'reserved' | 'assigned';

/** minimal exhibitor shape populated onto a booth. */
export interface BoothOccupant {
  id: string;
  companyName: string;
  category: string;
  logoUrl: string | null;
  approvalStatus: ApprovalStatus;
}

export interface Booth {
  id: string;
  expoRef: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  status: BoothStatus;
  exhibitorRef: BoothOccupant | string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/** a booth on the builder canvas — `id` is absent until it is first saved. */
export interface DraftBooth {
  id?: string;
  /** stable key for React while a booth has no server id yet. */
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  status: BoothStatus;
  exhibitorRef: BoothOccupant | string | null;
}

export interface FloorPlanResponse {
  items: Booth[];
  expo: {
    id: string;
    title: string;
    status: ExpoStatus;
    floorPlanConfig: FloorPlanConfig;
  };
  myProfile: { id: string; approvalStatus: ApprovalStatus } | null;
}

/** payload of the `booth:updated` socket event. */
export interface BoothUpdatedEvent {
  boothId: string;
  expoId: string;
  status?: BoothStatus;
  exhibitorRef?: string | null;
  booth?: Booth;
  action: 'created' | 'updated' | 'deleted' | 'reserved' | 'released' | 'assigned';
  at: string;
}

export const BOOTH_STATUS_LABELS: Record<BoothStatus, string> = {
  available: 'Available',
  reserved: 'Reserved',
  assigned: 'Assigned',
};

export const BOOTH_STATUS_VARIANTS: Record<BoothStatus, 'success' | 'warning' | 'default'> = {
  available: 'success',
  reserved: 'warning',
  assigned: 'default',
};

// messaging, notifications, feedback

export interface Participant {
  id: string;
  _id?: string;
  name: string;
  role: Role;
  avatarUrl?: string | null;
}

export type ThreadKind = 'attendee-exhibitor' | 'exhibitor-organizer' | 'exhibitor-exhibitor';

export interface MessageThread {
  id: string;
  participants: Participant[];
  counterpart: Participant | null;
  expoRef: { id: string; title: string } | string | null;
  kind: ThreadKind;
  subject: string;
  lastMessageAt: string;
  lastMessagePreview: string;
  unreadCount: number;
}

export interface ChatMessage {
  id: string;
  threadRef: string;
  senderRef: Participant;
  body: string;
  readBy: string[];
  createdAt: string;
}

/** payload of the `message:new` socket event. */
export interface MessageNewEvent {
  threadId: string;
  message: ChatMessage;
  expoId: string | null;
}

export interface Contact {
  userId: string;
  name: string;
  subtitle: string;
  avatarUrl: string | null;
  group: string;
}

export type NotificationType =
  | 'exhibitor-approved'
  | 'exhibitor-rejected'
  | 'booth-reserved'
  | 'booth-assigned'
  | 'session-reminder'
  | 'schedule-changed'
  | 'message'
  | 'feedback';

export interface AppNotification {
  id: string;
  type: NotificationType;
  message: string;
  link: string;
  read: boolean;
  createdAt: string;
}

export type FeedbackStatus = 'new' | 'reviewed' | 'resolved';
export type FeedbackCategory = 'general' | 'session' | 'exhibitor' | 'venue' | 'technical';

export interface Feedback {
  id: string;
  userRef: Pick<User, 'id' | 'name' | 'email' | 'role'> | string;
  expoRef: { id: string; title: string } | string | null;
  content: string;
  category: FeedbackCategory;
  rating: number | null;
  aiSentiment: 'positive' | 'neutral' | 'negative' | null;
  aiCategory: string | null;
  status: FeedbackStatus;
  organizerNote: string;
  createdAt: string;
}

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  general: 'General',
  session: 'A session',
  exhibitor: 'An exhibitor',
  venue: 'The venue',
  technical: 'Something technical',
};

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: 'New',
  reviewed: 'Reviewed',
  resolved: 'Resolved',
};

export const FEEDBACK_STATUS_VARIANTS: Record<FeedbackStatus, 'warning' | 'default' | 'success'> = {
  new: 'warning',
  reviewed: 'default',
  resolved: 'success',
};

// AI layer 

/** whether a result came from a live Gemini call or the offline fallback. */
export type AiSource = 'ai' | 'fallback';

export interface AiEnvelope {
  source: AiSource;
  reason?: 'not-configured' | 'error';
}

export interface ItineraryItem {
  sessionId: string;
  reason: string;
  session: {
    id: string;
    title: string;
    topic: string;
    speaker: string;
    location: string;
    startTime: string;
    endTime: string;
    isFull: boolean;
  };
}

export interface AiScheduleResult extends AiEnvelope {
  itinerary: ItineraryItem[];
  summary: string;
}

export interface ExhibitorMatch {
  exhibitorId: string;
  score: number;
  reason: string;
  exhibitor: {
    id: string;
    companyName: string;
    category: string;
    description: string;
    logoUrl: string | null;
    products: ExhibitorProduct[];
  };
}

export interface AiMatchResult extends AiEnvelope {
  matches: ExhibitorMatch[];
}

export interface SemanticResult {
  exhibitorId: string;
  reason: string;
  exhibitor: ExhibitorMatch['exhibitor'];
}

export interface AiSearchResult extends AiEnvelope {
  results: SemanticResult[];
  interpretation: string;
}

export interface AiInsight {
  title: string;
  detail: string;
  sentiment: string;
}

export interface AiSummaryResult extends AiEnvelope {
  headline: string;
  insights: AiInsight[];
  recommendations: string[];
  data: Record<string, unknown>;
}

export interface AiDescriptionResult extends AiEnvelope {
  description: string;
  tagline: string;
}

export interface AiTriageResult extends AiEnvelope {
  sentiment: 'positive' | 'neutral' | 'negative';
  category: string;
  summary: string;
  urgent: boolean;
}

// analytics

export type AnalyticsEventType = 'boothView' | 'sessionBookmark' | 'profileView' | 'search';

export interface EngagementPoint {
  date: string;
  boothView: number;
  sessionBookmark: number;
  profileView: number;
  search: number;
  total: number;
}

export interface BoothTrafficRow {
  id: string;
  label: string;
  status: BoothStatus;
  views: number;
  visitors: number;
}

export interface SessionPopularityRow {
  id: string;
  title: string;
  bookmarks: number;
  registrations: number;
  capacity: number | null;
  fillRate: number | null;
}

export interface ExhibitorViewRow {
  id: string;
  companyName: string;
  category: string;
  views: number;
}

export interface AnalyticsDashboard {
  generatedAt: string;
  windowDays: number;
  expo: { id: string; title: string; status: ExpoStatus };
  totals: {
    boothView: number;
    sessionBookmark: number;
    profileView: number;
    search: number;
    allEvents: number;
    uniqueVisitors: number;
    registrations: number;
  };
  engagement: EngagementPoint[];
  boothTraffic: BoothTrafficRow[];
  sessionPopularity: SessionPopularityRow[];
  exhibitorViews: ExhibitorViewRow[];
  topSearches: { query: string; count: number }[];
  booths: { total: number; available: number; reserved: number; assigned: number; occupancy: number };
  exhibitors: Record<ApprovalStatus, number>;
  sessions: { total: number; totalRegistrations: number; full: number };
  feedback: {
    total: number;
    averageRating: number | null;
    sentiments: { positive: number; neutral: number; negative: number };
  };
}

export interface AnalyticsLogEntry {
  id: string;
  type: AnalyticsEventType;
  targetRef: string | null;
  userRef: { id: string; name: string; role: Role } | null;
  query: string;
  createdAt: string;
}

export const EVENT_TYPE_LABELS: Record<AnalyticsEventType, string> = {
  boothView: 'Booth views',
  sessionBookmark: 'Session bookmarks',
  profileView: 'Profile views',
  search: 'Searches',
};

// user & role management

export type OrganizerApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl: string | null;
  consentGiven: boolean;
  /** only meaningful for organizers; null for other roles and legacy accounts. */
  organizerApprovalStatus: OrganizerApprovalStatus | null;
  organizerReviewedAt: string | null;
  createdAt: string;
}

export interface UserDirectory {
  items: ManagedUser[];
  counts: Record<Role, number> & { pendingOrganizers: number };
  pagination: Pagination;
}

export const ORGANIZER_APPROVAL_LABELS: Record<OrganizerApprovalStatus, string> = {
  pending: 'Awaiting approval',
  approved: 'Active',
  rejected: 'Refused',
};

export const ORGANIZER_APPROVAL_VARIANTS: Record<OrganizerApprovalStatus, 'warning' | 'success' | 'destructive'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'destructive',
};

export const ROLE_LABELS_PLURAL: Record<Role, string> = {
  organizer: 'Organizers',
  exhibitor: 'Exhibitors',
  attendee: 'Attendees',
};
