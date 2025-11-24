import { z } from 'zod';

/**
 * RIDE MATCHING SYSTEM TYPES
 * 
 * Concept: Students post ride requests when they need to travel.
 * The system matches students going in the same direction at similar times
 * so they can share a commercial ride (Uber/Pathao) and split the cost.
 */

// ==================== RIDE REQUEST ====================
// A student's request for finding ride partners

export const RideRequestSchema = z.object({
  id: z.string(),
  userId: z.string(),
  
  // User info (populated from users collection)
  user: z.object({
    firstName: z.string(),
    lastName: z.string(),
    phoneNumber: z.string().optional(),
    department: z.string().optional(),
    studentId: z.string().optional(),
    isStudentVerified: z.boolean(),
    profileImageUrl: z.string().optional(),
    rating: z.number(),
  }).optional(),
  
  // Location details
  origin: z.object({
    latitude: z.number(),
    longitude: z.number(),
    address: z.string(),
    geohash: z.string(), // For geo-queries
  }),
  destination: z.object({
    latitude: z.number(),
    longitude: z.number(),
    address: z.string(),
    geohash: z.string(),
  }),
  
  // Timing details
  departureTime: z.date(),
  flexibility: z.number().min(0).max(120), // Minutes of flexibility (0, 15, 30, 60)
  
  // Matching preferences
  maxWalkDistance: z.number().min(0).max(2000), // Meters willing to walk to meetup point
  lookingForSeats: z.number().min(1).max(3), // How many seats they need
  maxPricePerSeat: z.number().min(0), // Maximum willing to pay per seat
  
  // Social preferences
  preferences: z.object({
    genderPreference: z.enum(['any', 'female_only', 'male_only']),
    studentVerifiedOnly: z.boolean(), // Only match with verified students
    sameDepartmentPreferred: z.boolean(), // Prefer same department
  }),
  
  // Status tracking
  status: z.enum(['searching', 'matched', 'riding', 'completed', 'cancelled']),
  matchedWith: z.array(z.string()).default([]), // User IDs of matched students
  matchId: z.string().optional(), // Active match ID
  
  // Metadata
  createdAt: z.date(),
  updatedAt: z.date(),
  expiresAt: z.date(), // Auto-expire after departure + flexibility
});

export type RideRequestType = z.infer<typeof RideRequestSchema>;

// ==================== RIDE MATCH ====================
// A group of matched students sharing a ride

export const RideMatchSchema = z.object({
  id: z.string(),
  
  // Matched requests
  requestIds: z.array(z.string()), // All ride request IDs in this match
  
  // Participants
  participants: z.array(z.object({
    userId: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    phoneNumber: z.string().optional(),
    profileImageUrl: z.string().optional(),
    pickupLocation: z.object({
      latitude: z.number(),
      longitude: z.number(),
      address: z.string(),
    }),
    dropoffLocation: z.object({
      latitude: z.number(),
      longitude: z.number(),
      address: z.string(),
    }),
    seats: z.number(), // Number of seats this person needs
    isStudentVerified: z.boolean(),
    department: z.string().optional(),
  })),
  
  // Shared route
  meetingPoint: z.object({
    latitude: z.number(),
    longitude: z.number(),
    address: z.string(),
    description: z.string().optional(), // e.g., "In front of main gate"
  }),
  dropoffPoint: z.object({
    latitude: z.number(),
    longitude: z.number(),
    address: z.string(),
    description: z.string().optional(),
  }),
  
  // Timing
  departureTime: z.date(),
  estimatedArrivalTime: z.date().optional(),
  
  // Cost calculation
  estimatedTotalCost: z.number(), // Total ride cost from Uber/Pathao
  costPerPerson: z.number(), // Split cost
  totalSeats: z.number(), // Total seats needed
  
  // Ride details
  rideProvider: z.enum(['uber', 'pathao', 'obhai', 'other']).optional(),
  vehicleType: z.string().optional(), // e.g., "UberGo", "Pathao Bike"
  bookingId: z.string().optional(), // If booked through app integration
  driverInfo: z.object({
    name: z.string(),
    phone: z.string(),
    vehicleNumber: z.string(),
    rating: z.number(),
  }).optional(),
  
  // Communication
  chatRoomId: z.string(), // For group chat
  
  // Status
  status: z.enum(['pending', 'confirmed', 'riding', 'completed', 'cancelled']),
  confirmations: z.array(z.string()).default([]), // User IDs who confirmed
  
  // Safety
  liveLocations: z.record(z.string(), z.object({
    latitude: z.number(),
    longitude: z.number(),
    timestamp: z.date(),
  })).optional(), // Real-time location of each participant
  
  // Metadata
  createdAt: z.date(),
  updatedAt: z.date(),
  completedAt: z.date().optional(),
});

export type RideMatchType = z.infer<typeof RideMatchSchema>;

// ==================== CHAT MESSAGE ====================
// Messages within a match's chat room

export const ChatMessageSchema = z.object({
  id: z.string(),
  matchId: z.string(),
  senderId: z.string(),
  senderName: z.string(),
  message: z.string(),
  type: z.enum(['text', 'location', 'system', 'image']),
  imageUrl: z.string().optional(),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }).optional(),
  timestamp: z.date(),
  readBy: z.array(z.string()).default([]),
});

export type ChatMessageType = z.infer<typeof ChatMessageSchema>;

// ==================== MATCHING ALGORITHM TYPES ====================

export interface MatchingCriteria {
  maxOriginDistance: number; // meters (e.g., 500m)
  maxDestinationDistance: number; // meters (e.g., 1000m)
  maxTimeDifference: number; // minutes (e.g., 30min)
  minMatchScore: number; // 0-100 (e.g., 60)
}

export interface MatchScore {
  requestId: string;
  score: number; // 0-100
  breakdown: {
    originDistance: number;
    destinationDistance: number;
    timeDifference: number;
    preferencesMatch: boolean;
    departmentMatch: boolean;
  };
}

// ==================== FORM SCHEMAS ====================

export const PostRideRequestFormSchema = z.object({
  originAddress: z.string().min(1, 'Pickup location is required'),
  destinationAddress: z.string().min(1, 'Drop-off location is required'),
  departureTime: z.date().min(new Date(), 'Departure time must be in the future'),
  flexibility: z.number().min(0).max(120),
  maxWalkDistance: z.number().min(0).max(2000),
  lookingForSeats: z.number().min(1).max(3),
  maxPricePerSeat: z.number().min(0),
  genderPreference: z.enum(['any', 'female_only', 'male_only']),
  studentVerifiedOnly: z.boolean(),
  sameDepartmentPreferred: z.boolean(),
});

export type PostRideRequestForm = z.infer<typeof PostRideRequestFormSchema>;

// ==================== NAVIGATION TYPES ====================

export type RideMatchingStackParamList = {
  Home: undefined; // Search/browse ride requests
  PostRequest: undefined; // Create new ride request
  MyRequests: undefined; // View your ride requests
  FindMatches: { requestId: string }; // Find matches for a request
  MatchDetails: { matchId: string }; // View match details
  Chat: { matchId: string }; // Group chat with matched students
  RequestDetails: { requestId: string }; // View someone else's request
};

// ==================== HELPER TYPES ====================

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export interface DistanceCalculation {
  distance: number; // in meters
  duration: number; // in seconds
  distanceText: string; // "2.5 km"
  durationText: string; // "5 mins"
}

export interface CostEstimate {
  provider: 'uber' | 'pathao' | 'obhai';
  vehicleType: string;
  estimatedCost: number;
  estimatedTime: number; // minutes
  costPerPerson: number;
  available: boolean;
}
